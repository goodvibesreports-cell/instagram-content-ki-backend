const {
  registerUser,
  verifyUser,
  loginUser,
  getCurrentUser,
  updatePlatformMode,
  updatePassword,
  provisionTestAccount,
  refreshAuthSession,
  revokeSessions
} = require("../services/authService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

function getSessionMeta(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    || req.ip
    || "";
  return {
    ip,
    device: req.headers["user-agent"] || "unknown"
  };
}

function formatAuthResponse(payload, message) {
  const response = {
    success: true,
    ...(message ? { message } : {})
  };
  if (payload?.user) {
    response.user = {
      id: payload.user.id,
      email: payload.user.email
    };
  }
  if (payload?.tokens) {
    response.tokens = {
      accessToken: payload.tokens.accessToken,
      refreshToken: payload.tokens.refreshToken,
      expiresIn: payload.tokens.expiresIn,
      refreshExpiresAt: payload.tokens.refreshExpiresAt
    };
  }
  if (payload?.session) {
    response.session = payload.session;
  }
  return response;
}

function sanitizeUserPayload(user) {
  if (!user) return null;
  const source = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
  const id = source._id?.toString?.() ?? source.id;
  const credits = source.credits || 0;
  const bonusCredits = source.bonusCredits || 0;
  const totalCredits =
    typeof source.totalCredits === "number" ? source.totalCredits : credits + bonusCredits;
  return {
    id,
    email: source.email,
    verified: Boolean(source.verified),
    platformMode: source.platformMode || "tiktok",
    credits,
    bonusCredits,
    totalCredits,
    settings: source.settings || {},
    creatorProfile: source.creatorProfile || {}
  };
}

async function register(req, res, next) {
  try {
    const payload = await registerUser(req.validated, getSessionMeta(req));
    res.status(201).json(formatAuthResponse(payload, "Registrierung erfolgreich!"));
  } catch (err) {
    next(err);
  }
}

async function registerTestAccount(req, res, next) {
  try {
    const providedKey = req.header("x-test-key") || req.body.testKey;
    const allowedKey = process.env.TEST_ACCOUNT_KEY || "ic-ki-test-key";

    if (!providedKey || providedKey !== allowedKey) {
      const err = new Error("Test-Key ungültig");
      err.status = 403;
      throw err;
    }

    const payload = await provisionTestAccount({
      email: req.validated.email,
      password: req.validated.password,
      credits: req.validated.credits ?? 10000
    }, getSessionMeta(req));

    res.status(201).json(formatAuthResponse(payload, "Testaccount bereitgestellt"));
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const payload = await verifyUser(req.validated.token, getSessionMeta(req));
    res.json(createSuccessResponse(payload, "E-Mail bestätigt – du bist jetzt eingeloggt."));
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const payload = await loginUser(req.validated, getSessionMeta(req));
    res.json(formatAuthResponse(payload, "Login erfolgreich!"));
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const baseUser =
      req.userDoc ||
      req.user ||
      (req.user?.id ? await getCurrentUser(req.user.id) : null);

    if (!baseUser) {
      return res.status(401).json({
        success: false,
        message: "Nicht eingeloggt"
      });
    }

    const user = sanitizeUserPayload(baseUser);
    const accessToken =
      req.authToken ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.replace("Bearer ", "").trim()
        : null);

    res.json({
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken: null
      }
    });
  } catch (err) {
    next(err);
  }
}

async function setPlatformMode(req, res, next) {
  try {
    const user = await updatePlatformMode(req.user.id, req.validated.platform);
    res.json(createSuccessResponse(user, "Platform Mode aktualisiert"));
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await updatePassword(req.user.id, req.validated.currentPassword, req.validated.newPassword);
    res.json(createSuccessResponse(null, "Passwort erfolgreich geändert"));
  } catch (err) {
    next(err);
  }
}

async function refreshSession(req, res, next) {
  try {
    const payload = await refreshAuthSession(req.validated.refreshToken, getSessionMeta(req));
    res.json(formatAuthResponse(payload, "Session aktualisiert"));
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await revokeSessions(req.user.id, req.validated.refreshToken, req.validated.fromAllDevices);
    const message = req.validated.fromAllDevices ? "Alle Sessions beendet" : "Logout erfolgreich";
    res.json(createSuccessResponse(null, message));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  registerTestAccount,
  verify,
  login,
  me,
  setPlatformMode,
  changePassword,
  refreshSession,
  logout
};


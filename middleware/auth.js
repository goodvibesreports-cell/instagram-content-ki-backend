const jwt = require("jsonwebtoken");
const User = require("../models/User");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET ist nicht gesetzt");
  }
  return secret;
}

function buildSafeUser(userDoc) {
  if (!userDoc) return null;
  const plain = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };
  plain.id = plain._id?.toString?.() ?? plain.id;
  const totalCredits =
    typeof plain.totalCredits === "number"
      ? plain.totalCredits
      : (plain.credits || 0) + (plain.bonusCredits || 0);
  plain.totalCredits = totalCredits;
  return plain;
}

async function verifyRequestUser(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    const error = new Error("Kein gültiger Authorization Header vorhanden");
    error.status = 401;
    throw error;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    const error = new Error("Kein Token übermittelt");
    error.status = 401;
    throw error;
  }

  const decoded = jwt.verify(token, getJwtSecret());
  if (!decoded || !decoded.id) {
    const error = new Error("Token ungültig oder unvollständig");
    error.status = 401;
    throw error;
  }

  const userDoc = await User.findById(decoded.id).select("-password");
  if (!userDoc) {
    const error = new Error("Benutzer wurde nicht gefunden");
    error.status = 401;
    throw error;
  }

  const safeUser = buildSafeUser(userDoc);
  req.user = safeUser;
  req.userDoc = userDoc;
}

async function auth(req, res, next) {
  try {
    await verifyRequestUser(req);
    next();
  } catch (err) {
    console.error("[AUTH] Fehler bei der Token-Verarbeitung:", err);
    const status = err.status || (err.name === "TokenExpiredError" ? 401 : 401);
    return res.status(status).json({
      success: false,
      message: err.message || "Authentifizierung fehlgeschlagen"
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      await verifyRequestUser(req);
    }
  } catch (err) {
    console.warn("[AUTH][optional] Token konnte nicht verifiziert werden:", err.message);
  } finally {
    next();
  }
}

module.exports = auth;
module.exports.auth = auth;
module.exports.attachUser = auth;
module.exports.optionalAuth = optionalAuth;

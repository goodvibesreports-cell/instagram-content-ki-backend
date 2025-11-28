const jwt = require("jsonwebtoken");
const User = require("../models/User");

function ensureJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET ist nicht gesetzt");
  }
  return secret;
}

function buildSafeUser(userDoc) {
  if (!userDoc) return null;
  const plain = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };
  const credits = plain.credits || 0;
  const bonusCredits = plain.bonusCredits || 0;
  plain.totalCredits =
    typeof plain.totalCredits === "number" ? plain.totalCredits : credits + bonusCredits;
  plain.id = plain._id?.toString?.() ?? plain.id;
  return plain;
}

function missingAuthResponse(res, message) {
  return res.status(401).json({
    success: false,
    message: message || "Authentifizierung erforderlich"
  });
}

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return missingAuthResponse(res, "Kein gültiger Authorization Header vorhanden");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return missingAuthResponse(res, "Kein Token übermittelt");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, ensureJwtSecret());
    } catch (err) {
      const status = err.name === "TokenExpiredError" ? 401 : 401;
      return res.status(status).json({
        success: false,
        message: err.message || "Token ungültig"
      });
    }

    if (!decoded || !decoded.id) {
      return missingAuthResponse(res, "Token ungültig oder unvollständig");
    }

    const userDoc = await User.findById(decoded.id).select("-password");
    if (!userDoc) {
      return res.status(401).json({
        success: false,
        message: "Invalid token user"
      });
    }

    req.userDoc = userDoc;
    req.user = buildSafeUser(userDoc);
    next();
  } catch (err) {
    console.error("[AUTH] Fehler bei der Token-Verarbeitung:", err);
    res.status(500).json({
      success: false,
      message: "Authentifizierung fehlgeschlagen"
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, ensureJwtSecret());
    if (!decoded?.id) {
      return next();
    }

    const userDoc = await User.findById(decoded.id).select("-password");
    if (userDoc) {
      req.userDoc = userDoc;
      req.user = buildSafeUser(userDoc);
    }
  } catch (err) {
    console.warn("[AUTH][optional]", err.message);
  }
  next();
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;

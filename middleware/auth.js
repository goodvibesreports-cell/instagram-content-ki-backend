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
  if (typeof plain.totalCredits !== "number") {
    plain.totalCredits = credits + bonusCredits;
  }
  plain.id = plain._id?.toString?.() ?? plain.id;
  return plain;
}

async function attachUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Kein gültiger Authorization Header vorhanden"
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Kein Token übermittelt"
      });
    }

    const decoded = jwt.verify(token, ensureJwtSecret());
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Token ungültig oder unvollständig"
      });
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
    const status = err.status || (err.name === "TokenExpiredError" ? 401 : 401);
    res.status(status).json({
      success: false,
      message: err.message || "Authentifizierung fehlgeschlagen"
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      await attachUser(req, res, next);
      return;
    }
  } catch (err) {
    console.warn("[AUTH][optional]", err.message);
  }
  next();
}

module.exports = attachUser;
module.exports.auth = attachUser;
module.exports.optionalAuth = optionalAuth;

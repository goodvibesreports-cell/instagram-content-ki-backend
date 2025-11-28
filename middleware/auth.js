const jwt = require("jsonwebtoken");
const User = require("../models/User");

function ensureJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET ist nicht gesetzt");
  }
  return process.env.JWT_SECRET;
}

function extractBearerToken(header = "") {
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.replace("Bearer ", "").trim();
  return token || null;
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = extractBearerToken(header);
    if (!token) {
      return res.status(401).json({ success: false, message: "No token" });
    }
    const decoded = jwt.verify(token, ensureJwtSecret());
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }
    req.user = user;
    req.userDoc = user;
    req.userId = user._id?.toString();
    req.authToken = token;
    next();
  } catch (err) {
    console.error("[AUTH] Verification failed:", err.message);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = extractBearerToken(header);
    if (!token) {
      return next();
    }
    const decoded = jwt.verify(token, ensureJwtSecret());
    if (!decoded?.id) {
      return next();
    }
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
      req.userDoc = user;
      req.userId = user._id?.toString();
      req.authToken = token;
    }
  } catch (err) {
    console.warn("[AUTH][optional] Verification failed:", err.message);
  }
  next();
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;

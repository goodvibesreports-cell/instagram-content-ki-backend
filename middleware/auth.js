const jwt = require("jsonwebtoken");
const User = require("../models/User");

function sanitizeUserDoc(userDoc) {
  if (!userDoc) return null;
  const source = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };
  const id = source._id?.toString?.() || source.id;
  const credits = source.credits || 0;
  const bonusCredits = source.bonusCredits || 0;
  const totalCredits = typeof source.totalCredits === "number" ? source.totalCredits : credits + bonusCredits;
  return {
    id,
    email: source.email || "",
    tier: source.tier || source.plan || "basic",
    credits,
    bonusCredits,
    totalCredits,
    platformMode: source.platformMode || "tiktok",
    settings: source.settings || {},
    creatorProfile: source.creatorProfile || {},
    verified: Boolean(source.verified)
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const parts = header.split(" ");
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!process.env.JWT_SECRET) {
      console.error("Auth error: JWT_SECRET nicht gesetzt");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userDoc = await User.findById(decoded.id);
    if (!userDoc) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.userDoc = userDoc;
    req.user = sanitizeUserDoc(userDoc);
    req.userId = req.user?.id;
    req.authToken = token;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const parts = header.split(" ");
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token || !process.env.JWT_SECRET) {
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return next();
    }
    const userDoc = await User.findById(decoded.id);
    if (userDoc) {
      req.userDoc = userDoc;
      req.user = sanitizeUserDoc(userDoc);
      req.userId = req.user?.id;
      req.authToken = token;
    }
  } catch (err) {
    console.warn("Optional auth failed:", err.message);
  } finally {
    next();
  }
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;

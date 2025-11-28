const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const { createErrorResponse } = require("../utils/errorHandler.js");

async function attachUser(req, decoded) {
  const user = await User.findById(decoded.id);
  if (!user) {
    const err = new Error("User nicht gefunden");
    err.status = 401;
    throw err;
  }
  req.user = { id: user._id.toString(), email: user.email };
  req.userDoc = user;
}

async function auth(req, res, next) {
  try {
    const header = req.header("Authorization");
    if (!header) {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_MISSING"));
    }
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await attachUser(req, decoded);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_EXPIRED"));
    }
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.header("Authorization");
    if (header) {
      const token = header.replace("Bearer ", "");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await attachUser(req, decoded);
    }
  } catch {
    // ignorieren
  } finally {
    next();
  }
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;

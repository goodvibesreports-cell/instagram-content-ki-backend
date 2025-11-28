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

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("JWT_SECRET ist nicht gesetzt");
    error.status = 500;
    throw error;
  }
  return jwt.verify(token, secret);
}

async function auth(req, res, next) {
  try {
    const header = req.header("Authorization");
    if (!header) {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_MISSING"));
    }
    const token = header.replace("Bearer ", "");
    const decoded = verifyJwt(token);
    await attachUser(req, decoded);
    next();
  } catch (err) {
    if (err.message?.includes("JWT_SECRET")) {
      return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_EXPIRED"));
    }
    if (err.status) {
      return res.status(err.status).json(createErrorResponse("AUTH_TOKEN_INVALID", err.message));
    }
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.header("Authorization");
    if (header) {
      const token = header.replace("Bearer ", "");
      const decoded = verifyJwt(token);
      await attachUser(req, decoded);
    }
  } catch (err) {
    if (err.message?.includes("JWT_SECRET")) {
      console.error(err.message);
    }
    // optional auth should not block request
  } finally {
    next();
  }
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;

const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function attachUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !process.env.JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return next();
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next();
    }

    req.user = user;
    req.userDoc = user;
    req.userId = user._id?.toString?.();
  } catch (err) {
    console.error("Auth error:", err.message);
  }
  next();
}

module.exports = attachUser;
module.exports.optionalAuth = attachUser;

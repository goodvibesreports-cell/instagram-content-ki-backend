const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function attachUser(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return next();
    }

    const token = auth.replace("Bearer ", "").trim();
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return next();
    }

    const userDoc = await User.findById(decoded.id).lean();
    if (userDoc) {
      if (!userDoc.id && userDoc._id) {
        userDoc.id = userDoc._id.toString();
      }
      req.user = userDoc;
      req.userId = userDoc.id;
      req.userDoc = userDoc;
      req.authToken = token;
    }
  } catch (err) {
    console.error("Auth error:", err.message);
  }
  next();
}

module.exports = attachUser;
module.exports.optionalAuth = attachUser;

const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function attachUser(req, res, next) {
  let resolvedUser = null;
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const token = auth.replace("Bearer ", "").trim();
      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          const user = await User.findById(decoded.id).lean();
          if (user) {
            resolvedUser = {
              ...user,
              id: user._id?.toString?.() || user.id
            };
            req.userId = resolvedUser.id;
            req.authToken = token;
          }
        }
      }
    }
  } catch (err) {
    console.error("Auth error:", err.message);
  } finally {
    req.user = resolvedUser;
    req.userDoc = resolvedUser;
    next();
  }
}

module.exports = attachUser;
module.exports.optionalAuth = attachUser;

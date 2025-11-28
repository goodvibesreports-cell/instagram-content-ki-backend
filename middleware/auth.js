const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Kein Token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "JWT_SECRET fehlt" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Ungültiger Token" });
    }

    const user = await User.findById(decoded.id || decoded.sub).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Benutzer nicht gefunden" });
    }

    req.user = user;
    req.userDoc = user;
    req.user.id = user._id?.toString?.() || user.id;
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(500).json({ success: false, message: "Auth Middleware Fehler" });
  }
};

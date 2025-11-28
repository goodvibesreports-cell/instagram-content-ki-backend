const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("==============================================");
console.log(" Instagram Content KI – Backend Auth Installer ");
console.log("==============================================\n");

const base = process.cwd(); // aktueller Ordner
console.log("Backend root:", base);

// ------------------------------------------------
// Ordner anlegen
// ------------------------------------------------
const dirs = ["models", "routes", "middleware"];

dirs.forEach((d) => {
  const full = path.join(base, d);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full);
    console.log("📁 Ordner erstellt:", d);
  } else {
    console.log("✔ Ordner existiert bereits:", d);
  }
});

// ------------------------------------------------
// MODELS / User.js
// ------------------------------------------------
fs.writeFileSync(
  path.join(base, "models", "User.js"),
`const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
`
);
console.log("✔ models/User.js erstellt");

// ------------------------------------------------
// MIDDLEWARE / auth.js
// ------------------------------------------------
fs.writeFileSync(
  path.join(base, "middleware", "auth.js"),
`const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.header("Authorization");
  const token = header?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
`
);
console.log("✔ middleware/auth.js erstellt");

// ------------------------------------------------
// ROUTES / auth.js
// ------------------------------------------------
fs.writeFileSync(
  path.join(base, "routes", "auth.js"),
`const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const auth = require("../middleware/auth.js");

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "User exists" });

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed });

  res.json({ message: "User registered" });
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "Invalid login" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Invalid login" });

  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// ME
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

module.exports = router;
`
);
console.log("✔ routes/auth.js erstellt");

// ------------------------------------------------
// index.js patchen
// ------------------------------------------------
let index = fs.readFileSync(path.join(base, "index.js"), "utf8");

if (!index.includes("authRoutes")) {
  index =
    `const authRoutes = require("./routes/auth.js");\n` +
    index.replace("app.use(cors());", `app.use(cors());\napp.use("/auth", authRoutes);`);
}

fs.writeFileSync(path.join(base, "index.js"), index);
console.log("✔ index.js gepatcht\n");

// ------------------------------------------------
// Dependencies installieren
// ------------------------------------------------
console.log("📦 Installiere Pakete...");
execSync("npm install bcryptjs jsonwebtoken --save", { stdio: "inherit" });

console.log("\n🎉 Installation abgeschlossen!");
console.log("Bitte commit/pushen und Render neu deployen.");

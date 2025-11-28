const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  credits: { type: Number, default: 1000 },
  platformMode: { type: String, default: "tiktok" },
  creatorProfile: { type: Object, default: {} },
  settings: { type: Object, default: {} },
  sessions: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
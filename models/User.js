const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    credits: { type: Number, default: 999 },
    creatorProfile: { type: Object, default: {} },
    verified: { type: Boolean, default: false },
    platformMode: { type: String, default: "tiktok" },
    settings: { type: Object, default: {} },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
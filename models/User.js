const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    platformMode: { type: String, default: "tiktok" },
    creatorProfile: { type: Object, default: {} },
    settings: { type: Object, default: {} },
    credits: { type: Number, default: 1000 },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
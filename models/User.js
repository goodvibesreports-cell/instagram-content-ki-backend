const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    device: { type: String, default: "unknown" },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    tier: { type: String, default: "basic" },
    credits: {
      total: { type: Number, default: 1000 },
      used: { type: Number, default: 0 }
    },
    platformMode: { type: String, default: "tiktok" },
    creatorProfile: { type: Object, default: {} },
    settings: { type: Object, default: {} },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    organizationRole: { type: String, default: null },
    sessions: { type: [sessionSchema], default: [] }
  },
  { timestamps: true }
);

userSchema.virtual("creditsBalance").get(function () {
  const total = this.credits?.total || 0;
  const used = this.credits?.used || 0;
  return Math.max(total - used, 0);
});

module.exports = mongoose.model("User", userSchema);
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    tier: { type: String, default: "basic" },
    credits: { type: Number, default: 1000 },
    bonusCredits: { type: Number, default: 0 },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    platformMode: { type: String, default: "tiktok" },
    creatorProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    organizationRole: { type: String, default: null },
    usage: {
      analyses: { type: Number, default: 0 },
      prompts: { type: Number, default: 0 },
      scripts: { type: Number, default: 0 },
      series: { type: Number, default: 0 },
      tokens: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

userSchema.methods.getAvailableCredits = function () {
  return Math.max((this.credits || 0) + (this.bonusCredits || 0), 0);
};

userSchema.methods.useCredits = async function (amount) {
  if (this.getAvailableCredits() < amount) {
    const err = new Error("Nicht genügend Credits");
    err.status = 402;
    throw err;
  }
  let remaining = amount;
  const base = Math.min(this.credits, remaining);
  this.credits -= base;
  remaining -= base;
  if (remaining > 0) {
    this.bonusCredits = Math.max(this.bonusCredits - remaining, 0);
  }
  await this.save();
  return this.getAvailableCredits();
};

userSchema.methods.trackUsage = async function (action, tokens = 0) {
  this.usage = this.usage || {};
  if (action) {
    this.usage[action] = (this.usage[action] || 0) + 1;
  }
  if (tokens) {
    this.usage.tokens = (this.usage.tokens || 0) + tokens;
  }
  this.usage.lastActiveAt = new Date();
  await this.save();
  return this.usage;
};

userSchema.methods.getStylePrompt = function () {
  const style = this.settings?.style || {};
  const parts = [];
  if (style.tone) parts.push(`Ton: ${style.tone}`);
  if (style.voice) parts.push(`Stimme: ${style.voice}`);
  if (style.keywords?.length) parts.push(`Keywords: ${style.keywords.join(", ")}`);
  if (style.avoid?.length) parts.push(`Vermeide: ${style.avoid.join(", ")}`);
  return parts.length ? parts.join("\n") : "";
};

userSchema.virtual("totalCredits").get(function () {
  return this.getAvailableCredits();
});

module.exports = mongoose.model("User", userSchema);
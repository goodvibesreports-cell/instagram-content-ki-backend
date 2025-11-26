import mongoose from "mongoose";

const PLATFORM_MODES = ["instagram", "tiktok", "youtube", "twitter", "linkedin"];

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  password: { type: String, required: true },

  verified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },

  credits: { type: Number, default: 20 },
  bonusCredits: { type: Number, default: 0 },
  platformMode: { type: String, enum: PLATFORM_MODES, default: "instagram" },

  creatorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CreatorProfile",
    default: null
  },

  usage: {
    prompts: { type: Number, default: 0 },
    scripts: { type: Number, default: 0 },
    analyses: { type: Number, default: 0 },
    series: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    lastActiveAt: Date
  },

  settings: {
    timezone: { type: String, default: "Europe/Berlin" },
    language: { type: String, default: "de" },
    notifications: { type: Boolean, default: true }
  }
}, { timestamps: true });

userSchema.virtual("totalCredits").get(function() {
  return this.credits + this.bonusCredits;
});

userSchema.methods.useCredits = async function(amount) {
  if (this.totalCredits < amount) {
    throw new Error("Nicht genügend Credits");
  }

  if (this.bonusCredits >= amount) {
    this.bonusCredits -= amount;
  } else {
    const rest = amount - this.bonusCredits;
    this.bonusCredits = 0;
    this.credits -= rest;
  }
  await this.save();
};

userSchema.methods.trackUsage = async function(type, tokens = 0) {
  if (this.usage[type] !== undefined) {
    this.usage[type] += 1;
  }
  this.usage.tokens += tokens;
  this.usage.lastActiveAt = new Date();
  await this.save();
};

userSchema.methods.requireVerification = function() {
  if (!this.verified) {
    const err = new Error("E-Mail noch nicht verifiziert");
    err.status = 403;
    throw err;
  }
};

export default mongoose.model("User", userSchema);

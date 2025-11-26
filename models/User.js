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
  language: { type: String, default: "de" },
  outputLanguages: { type: [String], default: ["de"] },

  creatorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CreatorProfile",
    default: null
  },

  contentStyle: {
    toneOfVoice: { type: String, default: "locker" },
    writingStyle: { type: String, default: "prägnant" },
    targetAudience: { type: String, default: "" },
    niche: { type: String, default: "" },
    brandKeywords: { type: [String], default: [] },
    avoidWords: { type: [String], default: [] },
    emojiUsage: { type: String, default: "moderate" },
    hashtagStyle: { type: String, default: "balanced" },
    sampleContent: { type: [String], default: [] },
    customInstructions: { type: String, default: "" }
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
    notifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    autoSaveHistory: { type: Boolean, default: true },
    defaultLanguage: { type: String, default: "de" },
    defaultTone: { type: String, default: "casual" }
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

userSchema.methods.getStylePrompt = function() {
  const style = this.contentStyle || {};

  const sections = [];
  if (style.niche) sections.push(`Nische: ${style.niche}`);
  if (style.targetAudience) sections.push(`Zielgruppe: ${style.targetAudience}`);
  if (style.toneOfVoice) sections.push(`Tonfall: ${style.toneOfVoice}`);
  if (style.writingStyle) sections.push(`Schreibstil: ${style.writingStyle}`);
  if (style.emojiUsage) sections.push(`Emoji-Nutzung: ${style.emojiUsage}`);
  if (style.hashtagStyle) sections.push(`Hashtag-Stil: ${style.hashtagStyle}`);
  if (style.brandKeywords?.length) sections.push(`Marken-Keywords: ${style.brandKeywords.join(", ")}`);
  if (style.avoidWords?.length) sections.push(`Verbotene Wörter: ${style.avoidWords.join(", ")}`);
  if (style.customInstructions) sections.push(`Spezielle Anweisungen: ${style.customInstructions}`);
  if (style.sampleContent?.length) {
    sections.push(
      `Beispiel-Content:\n${style.sampleContent.slice(0, 3).map((sample, idx) => `(${idx + 1}) ${sample}`).join("\n")}`
    );
  }

  if (!sections.length) {
    return "Standard-Stil: Modern, direkt, klare Hook + Nutzenargument, Emojis moderat einsetzen.";
  }

  return `Creator-Stil:\n${sections.join("\n")}`;
};

userSchema.methods.requireVerification = function() {
  if (!this.verified) {
    const err = new Error("E-Mail noch nicht verifiziert");
    err.status = 403;
    throw err;
  }
};

export default mongoose.model("User", userSchema);

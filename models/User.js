import mongoose from "mongoose";
import CryptoJS from "crypto-js";

// Encryption key from env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default-key";

// Helper: Encrypt sensitive data
function encrypt(text) {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

// Helper: Decrypt sensitive data
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ==============================
// User Schema
// ==============================
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  
  // ==============================
  // Premium & Subscription
  // ==============================
  premium: { type: Boolean, default: false },
  premiumTier: {
    type: String,
    enum: ["free", "basic", "pro", "unlimited", "agency", "lifetime"],
    default: "free"
  },
  subscriptionId: String,
  subscriptionStatus: {
    type: String,
    enum: ["active", "cancelled", "expired", "trial", null],
    default: null
  },
  subscriptionEndsAt: Date,
  
  // ==============================
  // Credits System
  // ==============================
  credits: { type: Number, default: 10 },
  creditsUsed: { type: Number, default: 0 },
  creditsResetAt: Date,
  bonusCredits: { type: Number, default: 0 },
  
  // ==============================
  // User API Keys (encrypted)
  // ==============================
  apiKeys: {
    openai: { type: String, default: null }, // Encrypted
    anthropic: { type: String, default: null },
    runway: { type: String, default: null },
    elevenLabs: { type: String, default: null }
  },
  useOwnApiKeys: { type: Boolean, default: false },
  
  // ==============================
  // Persönlicher Assistent - Style Learning
  // ==============================
  contentStyle: {
    toneOfVoice: { 
      type: String, 
      enum: ["casual", "professional", "humorous", "inspirational", "educational", "edgy"],
      default: "casual"
    },
    writingStyle: {
      type: String,
      enum: ["short", "detailed", "storytelling", "listicle", "conversational"],
      default: "conversational"
    },
    targetAudience: { type: String, default: "" },
    niche: { type: String, default: "" },
    brandKeywords: [{ type: String }],
    avoidWords: [{ type: String }],
    emojiUsage: {
      type: String,
      enum: ["none", "minimal", "moderate", "heavy"],
      default: "moderate"
    },
    hashtagStyle: {
      type: String,
      enum: ["minimal", "moderate", "maximum"],
      default: "moderate"
    },
    sampleContent: [{ type: String }], // User's best performing content for learning
    customInstructions: { type: String, default: "" }
  },
  
  // ==============================
  // Team / Organization
  // ==============================
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null
  },
  organizationRole: {
    type: String,
    enum: ["owner", "admin", "member", "viewer", null],
    default: null
  },
  
  // ==============================
  // Language & Localization
  // ==============================
  language: {
    type: String,
    enum: ["de", "en", "es", "fr", "it", "pt", "nl"],
    default: "de"
  },
  outputLanguages: [{
    type: String,
    enum: ["de", "en", "es", "fr", "it", "pt", "nl", "tr", "pl", "ru", "ja", "ko", "zh"]
  }],
  
  // ==============================
  // Usage Tracking
  // ==============================
  usage: {
    promptsGenerated: { type: Number, default: 0 },
    scriptsGenerated: { type: Number, default: 0 },
    hooksGenerated: { type: Number, default: 0 },
    captionsGenerated: { type: Number, default: 0 },
    batchGenerations: { type: Number, default: 0 },
    uploadsCount: { type: Number, default: 0 },
    totalTokensUsed: { type: Number, default: 0 },
    lastActiveAt: Date
  },
  
  // ==============================
  // Settings
  // ==============================
  settings: {
    defaultLanguage: { type: String, default: "de" },
    defaultTone: { type: String, default: "engaging" },
    emailNotifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    autoSaveHistory: { type: Boolean, default: true }
  },
  
  // ==============================
  // Admin
  // ==============================
  role: {
    type: String,
    enum: ["user", "admin", "moderator"],
    default: "user"
  },
  isBlocked: { type: Boolean, default: false },
  blockReason: String
  
}, { timestamps: true });

// ==============================
// Indexes
// ==============================
userSchema.index({ email: 1 });
userSchema.index({ premiumTier: 1 });
userSchema.index({ organization: 1 });
userSchema.index({ "usage.lastActiveAt": -1 });

// ==============================
// Virtuals
// ==============================
userSchema.virtual("totalCredits").get(function() {
  return this.credits + this.bonusCredits;
});

userSchema.virtual("isPremium").get(function() {
  return this.premium || !["free"].includes(this.premiumTier);
});

userSchema.virtual("hasOwnApiKey").get(function() {
  return this.useOwnApiKeys && this.apiKeys.openai;
});

// ==============================
// Methods: API Keys (encrypted)
// ==============================
userSchema.methods.setApiKey = async function(provider, apiKey) {
  if (!["openai", "anthropic", "runway", "elevenLabs"].includes(provider)) {
    throw new Error("Ungültiger API Provider");
  }
  this.apiKeys[provider] = encrypt(apiKey);
  await this.save();
};

userSchema.methods.getApiKey = function(provider) {
  const encrypted = this.apiKeys[provider];
  return encrypted ? decrypt(encrypted) : null;
};

userSchema.methods.removeApiKey = async function(provider) {
  this.apiKeys[provider] = null;
  await this.save();
};

// ==============================
// Methods: Credits
// ==============================
userSchema.methods.useCredits = async function(amount) {
  // If user uses own API key, no credits needed
  if (this.useOwnApiKeys && this.apiKeys.openai) {
    return this.totalCredits;
  }
  
  if (this.totalCredits < amount) {
    throw new Error("Nicht genügend Credits");
  }
  
  if (this.bonusCredits >= amount) {
    this.bonusCredits -= amount;
  } else {
    const remaining = amount - this.bonusCredits;
    this.bonusCredits = 0;
    this.credits -= remaining;
  }
  
  this.creditsUsed += amount;
  await this.save();
  return this.totalCredits;
};

userSchema.methods.addCredits = async function(amount, isBonus = false) {
  if (isBonus) {
    this.bonusCredits += amount;
  } else {
    this.credits += amount;
  }
  await this.save();
  return this.totalCredits;
};

userSchema.methods.trackUsage = async function(type, tokens = 0) {
  const usageMap = {
    prompt: "promptsGenerated",
    script: "scriptsGenerated",
    hook: "hooksGenerated",
    caption: "captionsGenerated",
    batch: "batchGenerations",
    upload: "uploadsCount"
  };
  
  if (usageMap[type]) {
    this.usage[usageMap[type]] += 1;
  }
  if (tokens > 0) {
    this.usage.totalTokensUsed += tokens;
  }
  this.usage.lastActiveAt = new Date();
  await this.save();
};

// ==============================
// Methods: Style Prompt
// ==============================
userSchema.methods.getStylePrompt = function() {
  const style = this.contentStyle;
  if (!style.niche && !style.targetAudience) {
    return "";
  }
  
  let prompt = "\n\n--- USER STYLE PREFERENCES ---\n";
  
  if (style.niche) prompt += `Nische: ${style.niche}\n`;
  if (style.targetAudience) prompt += `Zielgruppe: ${style.targetAudience}\n`;
  if (style.toneOfVoice) prompt += `Ton: ${style.toneOfVoice}\n`;
  if (style.writingStyle) prompt += `Schreibstil: ${style.writingStyle}\n`;
  if (style.emojiUsage) prompt += `Emoji-Nutzung: ${style.emojiUsage}\n`;
  if (style.brandKeywords?.length) prompt += `Keywords: ${style.brandKeywords.join(", ")}\n`;
  if (style.avoidWords?.length) prompt += `Vermeide: ${style.avoidWords.join(", ")}\n`;
  if (style.customInstructions) prompt += `Spezielle Anweisungen: ${style.customInstructions}\n`;
  
  if (style.sampleContent?.length) {
    prompt += `\nBeispiel-Content des Users:\n`;
    style.sampleContent.slice(0, 3).forEach((sample, i) => {
      prompt += `${i + 1}. "${sample.substring(0, 200)}..."\n`;
    });
  }
  
  prompt += "--- END STYLE ---\n";
  return prompt;
};

// ==============================
// Statics
// ==============================
userSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        premiumUsers: { $sum: { $cond: ["$premium", 1, 0] } },
        totalCreditsUsed: { $sum: "$creditsUsed" },
        totalTokensUsed: { $sum: "$usage.totalTokensUsed" },
        totalPrompts: { $sum: "$usage.promptsGenerated" },
        totalScripts: { $sum: "$usage.scriptsGenerated" },
        usersWithOwnKeys: { $sum: { $cond: ["$useOwnApiKeys", 1, 0] } }
      }
    }
  ]);
  
  const byTier = await this.aggregate([
    { $group: { _id: "$premiumTier", count: { $sum: 1 } } }
  ]);
  
  const byLanguage = await this.aggregate([
    { $group: { _id: "$language", count: { $sum: 1 } } }
  ]);
  
  return { ...stats[0], byTier, byLanguage };
};

export default mongoose.model("User", userSchema);

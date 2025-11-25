import mongoose from "mongoose";

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
  
  // Premium & Subscription
  premium: {
    type: Boolean,
    default: false
  },
  premiumTier: {
    type: String,
    enum: ["free", "basic", "pro", "unlimited", "lifetime"],
    default: "free"
  },
  subscriptionId: String,
  subscriptionStatus: {
    type: String,
    enum: ["active", "cancelled", "expired", "trial"],
    default: null
  },
  subscriptionEndsAt: Date,
  
  // Credits System
  credits: {
    type: Number,
    default: 10 // Jeder neue User bekommt 10 Credits
  },
  creditsUsed: {
    type: Number,
    default: 0
  },
  creditsResetAt: Date,
  bonusCredits: {
    type: Number,
    default: 0
  },
  
  // Usage Tracking
  usage: {
    promptsGenerated: { type: Number, default: 0 },
    scriptsGenerated: { type: Number, default: 0 },
    hooksGenerated: { type: Number, default: 0 },
    captionsGenerated: { type: Number, default: 0 },
    uploadsCount: { type: Number, default: 0 },
    lastActiveAt: Date
  },
  
  // Settings
  settings: {
    defaultLanguage: { type: String, default: "de" },
    defaultTone: { type: String, default: "engaging" },
    emailNotifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false }
  },
  
  // Admin
  role: {
    type: String,
    enum: ["user", "admin", "moderator"],
    default: "user"
  }
  
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ premiumTier: 1 });
userSchema.index({ "usage.lastActiveAt": -1 });

// Virtuals
userSchema.virtual("totalCredits").get(function() {
  return this.credits + this.bonusCredits;
});

userSchema.virtual("isPremium").get(function() {
  return this.premium || this.premiumTier !== "free";
});

// Methods
userSchema.methods.useCredits = async function(amount) {
  if (this.totalCredits < amount) {
    throw new Error("Nicht genügend Credits");
  }
  
  // Erst Bonus-Credits verwenden
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

userSchema.methods.trackUsage = async function(type) {
  const usageMap = {
    prompt: "promptsGenerated",
    script: "scriptsGenerated",
    hook: "hooksGenerated",
    caption: "captionsGenerated",
    upload: "uploadsCount"
  };
  
  if (usageMap[type]) {
    this.usage[usageMap[type]] += 1;
  }
  this.usage.lastActiveAt = new Date();
  await this.save();
};

// Statics
userSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        premiumUsers: { $sum: { $cond: ["$premium", 1, 0] } },
        totalCreditsUsed: { $sum: "$creditsUsed" },
        totalPrompts: { $sum: "$usage.promptsGenerated" },
        totalScripts: { $sum: "$usage.scriptsGenerated" }
      }
    }
  ]);
  
  const byTier = await this.aggregate([
    { $group: { _id: "$premiumTier", count: { $sum: 1 } } }
  ]);
  
  return { ...stats[0], byTier };
};

export default mongoose.model("User", userSchema);

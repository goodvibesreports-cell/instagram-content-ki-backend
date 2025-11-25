import mongoose from "mongoose";

// ==============================
// Organization Schema (Team Accounts)
// ==============================
const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Members
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  
  // Pending Invites
  invites: [{
    email: { type: String, required: true },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  
  // Plan & Credits
  plan: {
    type: String,
    enum: ["team_basic", "team_pro", "agency"],
    default: "team_basic"
  },
  maxMembers: {
    type: Number,
    default: 5
  },
  sharedCredits: {
    type: Number,
    default: 100
  },
  creditsUsed: {
    type: Number,
    default: 0
  },
  
  // Shared Settings
  sharedStyle: {
    toneOfVoice: String,
    writingStyle: String,
    niche: String,
    brandKeywords: [String],
    avoidWords: [String]
  },
  
  // Brand Kit
  brandKit: {
    colors: [String],
    fonts: [String],
    hashtags: [String],
    logo: String
  },
  
  // Usage Stats
  usage: {
    totalGenerations: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  },
  
  isActive: { type: Boolean, default: true }
  
}, { timestamps: true });

// Indexes
organizationSchema.index({ owner: 1 });
organizationSchema.index({ slug: 1 });
organizationSchema.index({ "members.user": 1 });

// Pre-save: Generate slug
organizationSchema.pre("save", function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);
  }
  next();
});

// Methods
organizationSchema.methods.addMember = async function(userId, role = "member", invitedBy = null) {
  if (this.members.length >= this.maxMembers) {
    throw new Error("Maximale Teamgröße erreicht");
  }
  
  const exists = this.members.find(m => m.user.toString() === userId.toString());
  if (exists) {
    throw new Error("User ist bereits Mitglied");
  }
  
  this.members.push({ user: userId, role, invitedBy });
  await this.save();
  
  // Update user's organization reference
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(userId, {
    organization: this._id,
    organizationRole: role
  });
  
  return this;
};

organizationSchema.methods.removeMember = async function(userId) {
  this.members = this.members.filter(m => m.user.toString() !== userId.toString());
  await this.save();
  
  // Remove user's organization reference
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(userId, {
    organization: null,
    organizationRole: null
  });
  
  return this;
};

organizationSchema.methods.createInvite = async function(email, role, invitedBy) {
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  this.invites.push({ email, role, token, expiresAt, invitedBy });
  await this.save();
  
  return token;
};

organizationSchema.methods.useCredits = async function(amount) {
  if (this.sharedCredits - this.creditsUsed < amount) {
    throw new Error("Nicht genügend Team-Credits");
  }
  this.creditsUsed += amount;
  this.usage.totalGenerations += 1;
  await this.save();
  return this.sharedCredits - this.creditsUsed;
};

// Statics
organizationSchema.statics.findByMember = async function(userId) {
  return this.findOne({
    $or: [
      { owner: userId },
      { "members.user": userId }
    ]
  }).populate("owner", "email").populate("members.user", "email");
};

export default mongoose.model("Organization", organizationSchema);


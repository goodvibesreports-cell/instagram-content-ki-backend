const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

memberSchema.pre("save", function (next) {
  if (!this.user && this.userId) this.user = this.userId;
  if (!this.userId && this.user) this.userId = this.user;
  next();
});

const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [memberSchema], default: [] },
    invites: { type: [inviteSchema], default: [] },
    plan: { type: String, default: "team_basic" },
    maxMembers: { type: Number, default: 5 },
    sharedStyle: { type: mongoose.Schema.Types.Mixed, default: {} },
    brandKit: { type: mongoose.Schema.Types.Mixed, default: {} },
    sharedCredits: { type: Number, default: 100 },
    creditsUsed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

organizationSchema.methods.addMember = async function (userId, role = "member", invitedBy = null) {
  if (this.members.length >= this.maxMembers) {
    throw new Error("Maximale Teamgröße erreicht");
  }
  const exists = this.members.find((member) => member.user && member.user.toString() === userId.toString());
  if (exists) {
    throw new Error("User ist bereits Mitglied");
  }
  this.members.push({
    user: userId,
    userId,
    role,
    invitedBy
  });
  await this.save();
  return this;
};

organizationSchema.methods.removeMember = async function (userId) {
  this.members = this.members.filter((member) => member.user?.toString() !== userId.toString());
  await this.save();
  return this;
};

organizationSchema.methods.createInvite = async function (email, role, invitedBy) {
  const crypto = require("crypto");
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  this.invites.push({
    email: email.toLowerCase(),
    role,
    token,
    expiresAt,
    invitedBy
  });
  await this.save();
  return token;
};

organizationSchema.statics.findByMember = function (userId) {
  return this.findOne({
    $or: [{ owner: userId }, { "members.user": userId }]
  })
    .populate("owner", "email")
    .populate("members.user", "email");
};

module.exports = mongoose.model("Organization", organizationSchema);
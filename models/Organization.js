const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

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
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [memberSchema], default: [] },
    invites: { type: [inviteSchema], default: [] },
    maxMembers: { type: Number, default: 5 },
    sharedStyle: { type: mongoose.Schema.Types.Mixed, default: {} },
    brandKit: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

organizationSchema.methods.addMember = async function (userId, role = "member") {
  const exists = this.members.some((member) => member.userId.toString() === userId.toString());
  if (exists) {
    throw new Error("User ist bereits Mitglied");
  }
  this.members.push({ userId, role });
  await this.save();
  return this;
};

organizationSchema.methods.removeMember = async function (userId) {
  this.members = this.members.filter((member) => member.userId.toString() !== userId.toString());
  await this.save();
  return this;
};

organizationSchema.statics.findByMember = function (userId) {
  return this.findOne({
    $or: [{ ownerId: userId }, { "members.userId": userId }]
  });
};

module.exports = mongoose.model("Organization", organizationSchema);
const mongoose = require("mongoose");

const creatorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    niche: { type: String, default: "" },
    targetAudience: { type: String, default: "" },
    toneOfVoice: { type: String, default: "neutral" },
    creatorStatement: { type: String, default: "" },
    bannedWords: { type: [String], default: [] },
    exampleHooks: { type: [String], default: [] },
    exampleCaptions: { type: [String], default: [] },
    contentGoals: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreatorProfile", creatorProfileSchema);
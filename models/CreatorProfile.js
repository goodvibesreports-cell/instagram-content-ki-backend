import mongoose from "mongoose";

const creatorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  niche: { type: String, required: true },
  toneOfVoice: {
    type: String,
    enum: ["seriös", "frech", "motiviert", "edgy", "ruhig", "laut"],
    default: "seriös"
  },
  targetAudience: { type: String, default: "" },
  contentGoals: { type: [String], default: [] },
  exampleHooks: { type: [String], default: [] },
  exampleCaptions: { type: [String], default: [] },
  bannedWords: { type: [String], default: [] },
  creatorStatement: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("CreatorProfile", creatorProfileSchema);


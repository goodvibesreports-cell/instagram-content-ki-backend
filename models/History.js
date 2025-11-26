import mongoose from "mongoose";

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["analysis", "prompt", "script", "series"],
    required: true
  },
  platform: {
    type: String,
    enum: ["instagram", "tiktok", "youtube", "twitter", "linkedin", "general"],
    default: "general"
  },
  input: { type: mongoose.Schema.Types.Mixed, default: null },
  output: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

export default mongoose.model("History", historySchema);


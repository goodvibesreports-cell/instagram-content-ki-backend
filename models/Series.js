import mongoose from "mongoose";

const episodeSchema = new mongoose.Schema({
  title: String,
  hook: String,
  idea: String,
  status: {
    type: String,
    enum: ["planned", "in_progress", "published", "analyzing"],
    default: "planned"
  },
  callToAction: String
}, { _id: true });

const seriesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  platform: {
    type: String,
    enum: ["instagram", "tiktok", "youtube", "twitter", "linkedin"],
    default: "instagram"
  },
  status: {
    type: String,
    enum: ["active", "paused", "completed"],
    default: "active"
  },
  episodes: [episodeSchema]
}, { timestamps: true });

export default mongoose.model("Series", seriesSchema);


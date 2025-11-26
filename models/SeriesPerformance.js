import mongoose from "mongoose";

const seriesPerformanceSchema = new mongoose.Schema({
  seriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Series",
    required: true
  },
  episodeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  manuallyEntered: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("SeriesPerformance", seriesPerformanceSchema);


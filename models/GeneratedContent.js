import mongoose from "mongoose";

const generatedContentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["prompt", "video_idea", "script", "hook", "caption", "title", "trend", "virality", "analysis", "series", "batch"],
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: "general"
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  used: {
    type: Boolean,
    default: false
  },
  metadata: {
    model: String,
    tokens: Number,
    generationTime: Number
  }
}, { 
  timestamps: true 
});

// Indexes
generatedContentSchema.index({ userId: 1, type: 1, createdAt: -1 });
generatedContentSchema.index({ category: 1, type: 1 });

export default mongoose.model("GeneratedContent", generatedContentSchema);



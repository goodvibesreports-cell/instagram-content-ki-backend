import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true
  },
  content: { 
    type: String, 
    required: true 
  },
  caption: { 
    type: String 
  },
  hashtags: [{ 
    type: String 
  }],
  likes: { 
    type: Number, 
    default: 0 
  },
  comments: { 
    type: Number, 
    default: 0 
  },
  engagement: { 
    type: Number, 
    default: 0 
  },
  category: { 
    type: String,
    default: "general"
  },
  source: {
    type: String,
    enum: ["upload", "manual", "generated"],
    default: "upload"
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

// Index für schnelle Abfragen
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ category: 1 });

export default mongoose.model("Post", postSchema);



import mongoose from "mongoose";

const uploadPostSchema = new mongoose.Schema(
  {
    caption: { type: String, default: "" },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    link: { type: String, default: "" },
    hashtags: [{ type: String }],
    timestamp: { type: Date },
    raw: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const uploadDatasetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null
    },
    platform: {
      type: String,
      default: "tiktok"
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "completed", "failed"],
      default: "uploaded"
    },
    sourceFilename: String,
    fileSize: Number,
    totals: {
      posts: { type: Number, default: 0 },
      links: { type: Number, default: 0 },
      ignoredLinks: { type: Number, default: 0 }
    },
    links: [{ type: String }],
    posts: [uploadPostSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

uploadDatasetSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("UploadDataset", uploadDatasetSchema);



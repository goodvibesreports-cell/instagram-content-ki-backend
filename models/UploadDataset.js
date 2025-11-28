const mongoose = require("mongoose");

const normalizedPostSchema = new mongoose.Schema(
  {
    id: { type: String },
    platform: { type: String, enum: ["tiktok", "instagram", "facebook"], default: "tiktok" },
    date: { type: Date },
    link: { type: String, default: "" },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    caption: { type: String, default: "" },
    soundOrAudio: { type: String, default: "" },
    location: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
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
    rawPlatform: { type: String, default: "tiktok" },
    sourceFilename: String,
    fileSize: Number,
    sourceType: { type: String, default: "upload" },
    rawJsonSnippet: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawPlatform: { type: String, default: "tiktok" },
    sourceType: { type: String, default: "upload" },
    rawJsonSnippet: { type: mongoose.Schema.Types.Mixed, default: {} },
    totals: {
      posts: { type: Number, default: 0 },
      links: { type: Number, default: 0 }
    },
    posts: [normalizedPostSchema],
    videos: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rawFilesMeta: [
      {
        fileName: String,
        fileSize: Number,
        platform: String,
        dataType: String,
        confidence: Number
      }
    ],
    ignoredEntries: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

uploadDatasetSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("UploadDataset", uploadDatasetSchema);



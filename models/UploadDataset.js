const mongoose = require("mongoose");

const uploadDatasetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rawPlatform: { type: String, default: "unknown" },
    sourceType: { type: String, default: "upload" },
    rawJsonSnippet: { type: mongoose.Schema.Types.Mixed, default: null },
    posts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    followers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    videos: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ignoredEntries: { type: [mongoose.Schema.Types.Mixed], default: [] },
    totals: {
      posts: { type: Number, default: 0 },
      links: { type: Number, default: 0 }
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: "uploaded" },
    platform: { type: String, default: "tiktok" },
    analysis: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadDataset", uploadDatasetSchema);



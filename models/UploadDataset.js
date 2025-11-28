"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const normalizedPostSchema = new _mongoose.default.Schema({
  id: {
    type: String
  },
  platform: {
    type: String,
    enum: ["tiktok", "instagram", "facebook"],
    default: "tiktok"
  },
  date: {
    type: Date
  },
  link: {
    type: String,
    default: ""
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  caption: {
    type: String,
    default: ""
  },
  soundOrAudio: {
    type: String,
    default: ""
  },
  location: {
    type: String,
    default: ""
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  meta: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: {}
  }
}, {
  _id: false
});
const uploadDatasetSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
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
  rawPlatform: {
    type: String,
    default: "tiktok"
  },
  sourceFilename: String,
  fileSize: Number,
  sourceType: {
    type: String,
    default: "upload"
  },
  rawJsonSnippet: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: {}
  },
  rawPlatform: {
    type: String,
    default: "tiktok"
  },
  sourceType: {
    type: String,
    default: "upload"
  },
  rawJsonSnippet: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: {}
  },
  totals: {
    posts: {
      type: Number,
      default: 0
    },
    links: {
      type: Number,
      default: 0
    }
  },
  posts: [normalizedPostSchema],
  videos: {
    type: [_mongoose.default.Schema.Types.Mixed],
    default: []
  },
  rawFilesMeta: [{
    fileName: String,
    fileSize: Number,
    platform: String,
    dataType: String,
    confidence: Number
  }],
  ignoredEntries: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: []
  },
  metadata: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});
uploadDatasetSchema.index({
  userId: 1,
  createdAt: -1
});
var _default = exports.default = _mongoose.default.model("UploadDataset", uploadDatasetSchema);
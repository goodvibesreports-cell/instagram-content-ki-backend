"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const generatedContentSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
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
generatedContentSchema.index({
  userId: 1,
  type: 1,
  createdAt: -1
});
generatedContentSchema.index({
  category: 1,
  type: 1
});
var _default = exports.default = _mongoose.default.model("GeneratedContent", generatedContentSchema);
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const postSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
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
    type: _mongoose.default.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index für schnelle Abfragen
postSchema.index({
  userId: 1,
  createdAt: -1
});
postSchema.index({
  category: 1
});
var _default = exports.default = _mongoose.default.model("Post", postSchema);
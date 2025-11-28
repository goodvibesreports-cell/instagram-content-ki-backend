"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const episodeSchema = new _mongoose.default.Schema({
  title: String,
  hook: String,
  idea: String,
  status: {
    type: String,
    enum: ["planned", "in_progress", "published", "analyzing"],
    default: "planned"
  },
  callToAction: String
}, {
  _id: true
});
const seriesSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
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
}, {
  timestamps: true
});
var _default = exports.default = _mongoose.default.model("Series", seriesSchema);
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const historySchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["analysis", "prompt", "script", "series"],
    required: true
  },
  platform: {
    type: String,
    enum: ["instagram", "tiktok", "youtube", "twitter", "linkedin", "general"],
    default: "general"
  },
  input: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: null
  },
  output: {
    type: _mongoose.default.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});
var _default = exports.default = _mongoose.default.model("History", historySchema);
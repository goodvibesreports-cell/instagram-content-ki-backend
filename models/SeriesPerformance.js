"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const seriesPerformanceSchema = new _mongoose.default.Schema({
  seriesId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "Series",
    required: true
  },
  episodeId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  saves: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 0
  },
  manuallyEntered: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
var _default = exports.default = _mongoose.default.model("SeriesPerformance", seriesPerformanceSchema);
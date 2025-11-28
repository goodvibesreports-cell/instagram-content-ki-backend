"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const creatorProfileSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  niche: {
    type: String,
    required: true
  },
  toneOfVoice: {
    type: String,
    enum: ["seriös", "frech", "motiviert", "edgy", "ruhig", "laut"],
    default: "seriös"
  },
  targetAudience: {
    type: String,
    default: ""
  },
  contentGoals: {
    type: [String],
    default: []
  },
  exampleHooks: {
    type: [String],
    default: []
  },
  exampleCaptions: {
    type: [String],
    default: []
  },
  bannedWords: {
    type: [String],
    default: []
  },
  creatorStatement: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});
var _default = exports.default = _mongoose.default.model("CreatorProfile", creatorProfileSchema);
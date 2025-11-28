"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const shareLinkSchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  payload: {
    type: _mongoose.default.Schema.Types.Mixed,
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});
shareLinkSchema.index({
  expiresAt: 1
}, {
  expireAfterSeconds: 0,
  partialFilterExpression: {
    expiresAt: {
      $type: "date"
    }
  }
});
var _default = exports.default = _mongoose.default.model("ShareLink", shareLinkSchema);
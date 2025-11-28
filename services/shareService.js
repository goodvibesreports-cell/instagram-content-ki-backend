"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createShareLink = createShareLink;
exports.getSharePayload = getSharePayload;
var _crypto = require("crypto");
var _ShareLink = _interopRequireDefault(require("../models/ShareLink.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
async function createShareLink(userId, payload, ttlDays = 30) {
  const token = (0, _crypto.randomUUID)();
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null;
  const entry = await _ShareLink.default.create({
    userId,
    token,
    payload,
    ...(expiresAt ? {
      expiresAt
    } : {})
  });
  return entry;
}
async function getSharePayload(token) {
  const entry = await _ShareLink.default.findOne({
    token
  });
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    return null;
  }
  return entry.payload;
}
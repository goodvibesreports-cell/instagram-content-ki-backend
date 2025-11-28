"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.normalizeTikTokJson = normalizeTikTokJson;
var _tiktokParser = require("./tiktokParser.js");
function normalizeTikTokJson(json, sourceFileName = "unknown") {
  const result = (0, _tiktokParser.parseTikTokExport)(json, sourceFileName);
  const videos = result.videos || [];
  const deletedCount = videos.filter(video => video.isDeleted).length;
  return {
    videos,
    deletedCount,
    ignoredEntries: result.ignoredEntries || []
  };
}
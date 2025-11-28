"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseInstagramJson = parseInstagramJson;
var _normalizedPost = require("../normalizedPost.js");
function extractHashtags(text = "") {
  if (typeof text !== "string") return [];
  const matches = text.match(/#([a-z0-9_]+)/gi);
  if (!matches) return [];
  return [...new Set(matches.map(tag => tag.replace("#", "").toLowerCase()))];
}
function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
function isInstagramPost(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Boolean((entry.taken_at || entry.timestamp || entry.created_time || entry.creation_timestamp) && (entry.permalink || entry.media_url || entry.id || entry.caption));
}
function collectInstagramEntries(payload) {
  const results = [];
  const stack = [payload];
  const visited = new WeakSet();
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current === "object") {
      if (visited.has(current)) continue;
      visited.add(current);
    }
    if (Array.isArray(current)) {
      current.forEach(value => {
        if (typeof value === "object" || Array.isArray(value)) {
          stack.push(value);
        }
      });
      continue;
    }
    if (typeof current === "object") {
      if (isInstagramPost(current)) {
        results.push(current);
      }
      Object.values(current).forEach(value => {
        if (typeof value === "object" || Array.isArray(value)) {
          stack.push(value);
        }
      });
    }
  }
  return results;
}
function normalizeInstagramItem(item) {
  const isoDate = toIsoDate(item.taken_at) || toIsoDate(item.timestamp) || toIsoDate(item.created_time) || toIsoDate(item.creation_timestamp);
  if (!isoDate) return null;
  const link = item.permalink || (item.code ? `https://www.instagram.com/p/${item.code}` : null) || item.media_url || item.url || "";
  const caption = item.caption || item.title || item.text || "";
  const likes = Number(item.like_count || item.likes || 0);
  const comments = Number(item.comment_count || item.comments || 0);
  const views = Number(item.play_count || item.video_views || 0);
  return (0, _normalizedPost.createNormalizedPost)({
    id: item.id || link || isoDate,
    platform: "instagram",
    date: isoDate,
    link,
    likes,
    comments,
    views,
    caption,
    location: item.location || item.place || "",
    meta: {
      hashtags: extractHashtags(caption),
      mediaType: item.media_type || item.type || "",
      raw: item
    }
  });
}
function parseInstagramJson(payload) {
  try {
    if (!payload || typeof payload !== "object") return [];
    const entries = collectInstagramEntries(payload);
    return entries.map(normalizeInstagramItem).filter(Boolean);
  } catch (error) {
    console.warn("[Parser] Instagram JSON konnte nicht verarbeitet werden:", error.message);
    return [];
  }
}
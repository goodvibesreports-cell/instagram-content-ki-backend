"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseFacebookJson = parseFacebookJson;
var _normalizedPost = require("../normalizedPost.js");
function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value * 1000 || value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
function extractTextFromData(data = []) {
  if (!Array.isArray(data)) return "";
  return data.map(entry => entry?.post || entry?.text || entry?.title || "").filter(Boolean).join("\n").trim();
}
function isFacebookPost(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Boolean(entry.timestamp || entry.published_time || entry.created_time || entry.data);
}
function collectFacebookEntries(payload) {
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
      if (isFacebookPost(current)) {
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
function normalizeFacebookItem(item) {
  const isoDate = toIsoDate(item.timestamp) || toIsoDate(item.published_time) || toIsoDate(item.created_time) || toIsoDate(item.date);
  if (!isoDate) return null;
  const text = extractTextFromData(item.data) || item.message || item.story || "";
  const link = item.permalink_url || item.link || (Array.isArray(item.attachments) ? item.attachments.find(attachment => attachment?.url || attachment?.href)?.url : "") || "";
  return (0, _normalizedPost.createNormalizedPost)({
    id: item.id || item.post_id || link || isoDate,
    platform: "facebook",
    date: isoDate,
    link,
    likes: Number(item.reactions || item.likes || 0),
    comments: Number(item.comments || item.comment_count || 0),
    shares: Number(item.shares || item.share_count || 0),
    caption: text,
    location: item.place?.name || "",
    meta: {
      attachments: item.attachments || [],
      raw: item
    }
  });
}
function parseFacebookJson(payload) {
  try {
    if (!payload || typeof payload !== "object") return [];
    const entries = collectFacebookEntries(payload);
    return entries.map(normalizeFacebookItem).filter(Boolean);
  } catch (error) {
    console.warn("[Parser] Facebook JSON konnte nicht verarbeitet werden:", error.message);
    return [];
  }
}
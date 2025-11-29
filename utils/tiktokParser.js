/* eslint-disable max-lines */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractVideoLinksFromAnyObject = extractVideoLinksFromAnyObject;
exports.parseTikTokExport = parseTikTokExport;
const POST_PATH = ["Your Public Activity", "Videos", "VideoList"];
const FOLLOWER_PATH = ["Your Activity", "Follower", "FansList"];
const HASHTAG_PATH = ["Your Activity", "Hashtag", "HashtagList"];
const IGNORED_SECTIONS = [{
  section: "Watch History",
  path: ["Watch History", "VideoList"]
}, {
  section: "Like List",
  path: ["Your Activity", "Like List", "ItemFavoriteList"]
}, {
  section: "Share History",
  path: ["Share History", "ShareHistoryList"]
}, {
  section: "Recently Deleted Posts",
  path: ["Recently Deleted Posts", "PostList"]
}, {
  section: "Recently Deleted Videos",
  path: ["Recently Deleted Videos", "VideoList"]
}, {
  section: "Login History",
  path: ["Your Activity", "Login History", "List"]
}];
const HASHTAG_REGEX = /#([\p{L}\p{N}_]+)/giu;

function getNested(root, path = []) {
  return path.reduce((node, segment) => (node && typeof node === "object" ? node[segment] : undefined), root);
}

function toArray(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (Array.isArray(node.VideoList)) return node.VideoList;
  if (Array.isArray(node.PostList)) return node.PostList;
  if (Array.isArray(node.ItemFavoriteList)) return node.ItemFavoriteList;
  if (Array.isArray(node.List)) return node.List;
  if (Array.isArray(node.items)) return node.items;
  return [];
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractHashtagsFromText(text = "") {
  if (typeof text !== "string" || !text.trim()) return [];
  const matches = text.match(HASHTAG_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(tag => tag.replace("#", "").toLowerCase()))];
}

function buildSnippet(payload, limit = 400) {
  if (!payload) return null;
  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    return serialized.slice(0, limit);
  } catch {
    return null;
  }
}

function normalizePost(item = {}, index = 0, fileName = "upload.json") {
  if (!item || typeof item !== "object") return null;
  const link = typeof item.Link === "string" ? item.Link.trim() : item.link || "";
  if (!link) return null;
  const rawDate = item.Date || item.date || null;
  const dateObj = rawDate ? new Date(rawDate) : null;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  const caption = item.Title || item.Caption || "";
  return {
    platform: "tiktok",
    id: link || `${fileName}-${index}`,
    link,
    date: dateObj.toISOString(),
    timestamp: dateObj.getTime(),
    likes: toNumber(item.Likes),
    comments: toNumber(item.Comments),
    shares: toNumber(item.Shares),
    views: toNumber(item.Played),
    caption,
    sound: item.Sound || "",
    location: item.Location || "",
    coverImage: item.CoverImage || "",
    hashtags: extractHashtagsFromText(caption),
    meta: {
      sourceFile: fileName,
      raw: buildSnippet(item, 400)
    }
  };
}

function normalizeFollower(entry = {}) {
  if (!entry || typeof entry !== "object") return null;
  const rawDate = entry.Date || entry.date || entry.Timestamp;
  const dateObj = rawDate ? new Date(rawDate) : null;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  return {
    username: entry.UserName || entry.username || entry.NickName || "Follower",
    userId: entry.UserId || entry.userId || null,
    avatar: entry.Avatar || entry.avatar || null,
    date: dateObj.toISOString(),
    timestamp: dateObj.getTime()
  };
}

function normalizeHashtag(entry = {}) {
  if (!entry || typeof entry !== "object") return null;
  const name = entry.HashtagName || entry.Name || entry.hashtag;
  if (!name) return null;
  return name.toString().trim().toLowerCase();
}

function collectIgnoredEntries(root) {
  const ignored = [];
  IGNORED_SECTIONS.forEach(section => {
    const data = getNested(root, section.path);
    const count = toArray(data).length;
    if (count > 0) {
      ignored.push({
        section: section.section,
        reason: "ignored",
        count
      });
    }
  });
  return ignored;
}

function extractVideoLinksFromAnyObject(node, currentPath = [], results = [], seenCollections = null) {
  if (!node || typeof node !== "object") {
    return results;
  }
  if (Array.isArray(node)) {
    if (seenCollections?.has(node)) {
      return results;
    }
    const hasLinkEntries = node.some(entry => entry && typeof entry === "object" && (entry.Link || entry.URL));
    if (hasLinkEntries) {
      results.push({
        list: node,
        sourceSection: currentPath.join(".") || "detected"
      });
      return results;
    }
    node.forEach((item, index) => extractVideoLinksFromAnyObject(item, [...currentPath, `#${index}`], results, seenCollections));
    return results;
  }
  Object.keys(node).forEach(key => {
    extractVideoLinksFromAnyObject(node[key], [...currentPath, key], results, seenCollections);
  });
  return results;
}

function parseTikTokExport(raw, fileName = "upload.json") {
  const root = raw?.TikTok || raw || {};
  const postSection = getNested(root, POST_PATH);
  const followerSection = getNested(root, FOLLOWER_PATH);
  const hashtagSection = getNested(root, HASHTAG_PATH);

  const posts = toArray(postSection)
    .map((item, index) => normalizePost(item, index, fileName))
    .filter(Boolean);
  const followers = toArray(followerSection).map(normalizeFollower).filter(Boolean);
  const hashtags = toArray(hashtagSection).map(normalizeHashtag).filter(Boolean);
  const ignoredEntries = collectIgnoredEntries(root);

  return {
    posts,
    followers,
    hashtags,
    ignoredEntries
  };
}

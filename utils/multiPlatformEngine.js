"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.autoDetectPlatform = autoDetectPlatform;
exports.filterRelevantData = filterRelevantData;
exports.normalizeItem = normalizeItem;
exports.processUploadBuffer = processUploadBuffer;
var _path = _interopRequireDefault(require("path"));
var _admZip = _interopRequireDefault(require("adm-zip"));
var _normalizedPost = require("./normalizedPost.js");
var _platformDetector = require("./platformDetector.js");
var _tiktokParser = require("./tiktokParser.js");
var _instagramParser = require("./parsers/instagramParser.js");
var _facebookParser = require("./parsers/facebookParser.js");
var _youtubeParser = require("./parsers/youtubeParser.js");
var _instagramHtmlParser = require("./instagramHtmlParser.js");
var _facebookHtmlParser = require("./facebookHtmlParser.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const MEDIA_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".webm"]);
const JSON_EXTENSIONS = new Set([".json", ".txt", ".csv"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const TEXT_EXTENSIONS = new Set([...JSON_EXTENSIONS, ...HTML_EXTENSIONS]);
const PLATFORM_NAME_HINTS = {
  tiktok: [/tiktok/, /videolist/, /post/, /user_data/],
  instagram: [/instagram/, /ig_posts/, /content\.html/, /posts\.html/, /media\.html/],
  facebook: [/facebook/, /timeline/, /your_posts/, /posts_and_comments/, /status_updates/],
  youtube: [/youtube/, /my_videos/, /subscriptions/, /channel/]
};
const CONTENT_HINTS = {
  tiktok: [/\"Post\"/, /"VideoList"/, /"Recently Deleted"/],
  instagram: [/instagram\.com\/p\//, /"ig_posts"/, /"media"/],
  facebook: [/facebook\.com/, /"your_posts"/, /"timeline"/],
  youtube: [/youtube\.com\/watch/, /"snippet"/, /"uploads"/]
};
const WATCH_HISTORY_PATTERNS = [/watch ?history/i, /liked[_ ]videos/i, /recently ?deleted/i, /likes? ?list/i];
const SNIPPET_CHAR_LIMIT = 400;
function toInternalFile(file = {}) {
  if (!file || !file.buffer) {
    throw new Error("Invalid file buffer");
  }
  return {
    buffer: file.buffer,
    fileName: file.originalname || file.fileName || "upload",
    mimetype: file.mimetype || "",
    size: typeof file.size === "number" ? file.size : file.buffer.length || 0
  };
}
function readText(buffer) {
  return buffer.toString("utf8");
}
function looksLikeJsonString(text = "") {
  if (!text) return false;
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
function buildSnippet(content, limit = SNIPPET_CHAR_LIMIT) {
  if (!content) return null;
  if (typeof content === "string") {
    return content.trim().slice(0, limit);
  }
  try {
    return JSON.stringify(content, null, 2).split("\n").slice(0, 12).join("\n");
  } catch {
    return null;
  }
}
function extractHashtagsFromText(text = "") {
  if (typeof text !== "string") return [];
  const matches = text.match(/#([\p{L}\p{N}_]+)/giu);
  if (!matches) return [];
  return [...new Set(matches.map(tag => tag.replace("#", "").toLowerCase()))];
}
function normalizeHashtagList(value, fallbackText = "") {
  const base = [];
  if (Array.isArray(value)) {
    base.push(...value);
  } else if (typeof value === "string") {
    base.push(...value.split(/[, ]+/));
  }
  base.push(...extractHashtagsFromText(fallbackText));
  return [...new Set(base.filter(Boolean).map(tag => tag.replace("#", "").toLowerCase()))];
}
function ensureTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const date = value ? new Date(value) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return date.getTime();
  }
  return Date.now();
}
function shouldIgnoreNormalizedItem(item = {}) {
  const context = [
    item.meta?.category,
    item.meta?.sourceSection,
    item.meta?.type,
    item.caption,
    item.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (WATCH_HISTORY_PATTERNS.some((regex) => regex.test(context))) {
    return true;
  }
  const hasDates = Boolean(item.date || item.timestamp);
  const hasIdentity = Boolean(item.id || item.link);
  return !hasDates || !hasIdentity;
}
function normalizeItem(entry = {}, platform = "unknown", fileName = "") {
  if (!entry) return null;
  const baseCaption = entry.caption || entry.text || entry.description || entry.title || "";
  let normalized;
  if (entry.platform && entry.date) {
    normalized = {
      ...entry,
      platform: (entry.platform || platform).toLowerCase(),
      date: entry.date,
      timestamp: ensureTimestamp(entry.timestamp || entry.date),
      meta: {
        ...(entry.meta || {}),
        sourceFile: entry.sourceFile || fileName
      }
    };
  } else {
    normalized = (0, _normalizedPost.createNormalizedPost)({
      platform,
      id: entry.id || entry.url || entry.link || `${platform}-${Date.now()}`,
      link: entry.url || entry.link || "",
      date: entry.date || entry.timestamp || new Date().toISOString(),
      timestamp: ensureTimestamp(entry.timestamp || entry.date),
      title: entry.title || "",
      caption: baseCaption,
      description: entry.description || "",
      likes: entry.likes ?? null,
      comments: entry.comments ?? null,
      shares: entry.shares ?? null,
      views: entry.views ?? null,
      meta: {
        sourceFile: entry.sourceFile || fileName,
        ...entry.meta
      }
    });
  }
  normalized.hashtags = normalizeHashtagList(entry.hashtags || normalized.hashtags, baseCaption);
  const meta = {
    ...(normalized.meta || {}),
    sourceFile: normalized.meta?.sourceFile || entry.sourceFile || fileName,
    originType: normalized.meta?.originType || entry.originType || entry.meta?.originType || "posted"
  };
  if (meta.raw) {
    delete meta.raw;
  }
  const snippet = buildSnippet(entry.meta?.raw || entry.raw || entry);
  if (snippet) {
    meta.snippet = snippet;
  }
  normalized.meta = meta;
  return normalized;
}
function autoDetectPlatform(rawContent, fileName = "") {
  const signals = [];
  const addSignal = (platform, weight, reason) => signals.push({
    platform,
    weight,
    reason
  });
  const lowerName = fileName.toLowerCase();
  Object.entries(PLATFORM_NAME_HINTS).forEach(([platform, patterns]) => {
    if (patterns.some(regex => regex.test(lowerName))) {
      addSignal(platform, 0.7, `Dateiname enthält ${platform}`);
    }
  });
  if (typeof rawContent === "string") {
    const lowerContent = rawContent.toLowerCase();
    Object.entries(CONTENT_HINTS).forEach(([platform, patterns]) => {
      if (patterns.some(regex => regex.test(lowerContent))) {
        addSignal(platform, 0.8, `Dateiinhalt enthält ${platform}-Muster`);
      }
    });
  } else if (rawContent && typeof rawContent === "object") {
    const detection = (0, _platformDetector.detectPlatform)(rawContent);
    if (detection.platform && detection.platform !== "unknown") {
      addSignal(detection.platform, 0.9, detection.reason || "Plattform anhand JSON-Struktur erkannt");
    } else {
      const serializedKeys = JSON.stringify(Object.keys(rawContent)).toLowerCase();
      Object.entries(CONTENT_HINTS).forEach(([platform, patterns]) => {
        if (patterns.some(regex => regex.test(serializedKeys))) {
          addSignal(platform, 0.6, `JSON-Schlüssel deuten auf ${platform} hin`);
        }
      });
    }
  }
  if (!signals.length) {
    return {
      platform: "unknown",
      confidence: 0.2,
      reason: "Keine Plattformmuster erkannt"
    };
  }
  signals.sort((a, b) => b.weight - a.weight);
  const best = signals[0];
  return {
    platform: best.platform,
    confidence: Math.min(1, best.weight),
    reason: best.reason
  };
}
function filterRelevantData(payload, platform, fileName = "", options = {}) {
  const ignored = [];
  const flags = {};
  const rawSnippet = buildSnippet(payload);
  const normalizedItems = [];
  const followerEvents = [];
  switch (platform) {
    case "tiktok":
      {
        if (typeof payload !== "object") break;
        const parsed = (0, _tiktokParser.parseTikTokExport)(payload, fileName);
        flags.hasWatchHistory = (parsed.totals?.watchHistory || 0) > 0;
        if (Array.isArray(parsed.followers)) {
          followerEvents.push(...parsed.followers);
        }
        parsed.videos.map(video => (0, _normalizedPost.normalizedFromTikTokVideo)({
          ...video,
          sourceFile: fileName
        })).forEach(item => {
          const normalized = normalizeItem(item, "tiktok");
          if (normalized) normalizedItems.push(normalized);
        });
        ignored.push(...(parsed.ignoredEntries || []));
        break;
      }
    case "instagram":
      {
        if (typeof payload === "string") {
          (0, _instagramHtmlParser.toUnifiedItems)((0, _instagramHtmlParser.parseInstagramHtml)(payload, fileName), {
            fileName
          }).forEach(item => {
            const normalized = normalizeItem(item, "instagram");
            if (normalized) normalizedItems.push(normalized);
          });
        } else if (typeof payload === "object") {
          (0, _instagramParser.parseInstagramJson)(payload).forEach(item => {
            const normalized = normalizeItem(item, "instagram");
            if (normalized) normalizedItems.push(normalized);
          });
        }
        break;
      }
    case "facebook":
      {
        if (typeof payload === "string") {
          (0, _facebookHtmlParser.toUnifiedItems)((0, _facebookHtmlParser.parseFacebookHtml)(payload, fileName), {
            fileName
          }).forEach(item => {
            const normalized = normalizeItem(item, "facebook");
            if (normalized) normalizedItems.push(normalized);
          });
        } else if (typeof payload === "object") {
          (0, _facebookParser.parseFacebookJson)(payload).forEach(item => {
            const normalized = normalizeItem(item, "facebook");
            if (normalized) normalizedItems.push(normalized);
          });
        }
        break;
      }
    case "youtube":
      {
        if (typeof payload === "object") {
          (0, _youtubeParser.parseYouTubeExport)(payload).forEach(item => {
            const normalized = normalizeItem(item, "youtube");
            if (normalized) normalizedItems.push(normalized);
          });
        }
        break;
      }
    default:
      ignored.push({
        reason: "unsupported-platform",
        file: fileName
      });
  }
  const filteredItems = [];
  normalizedItems.forEach(item => {
    const enriched = normalizeItem(item, platform, fileName);
    if (!enriched) return;
    const originType = enriched.meta?.originType || "posted";
    if (originType !== "posted") {
      ignored.push({
        reason: originType === "deleted" ? "deleted_posts" : "non_post_section",
        file: fileName,
        id: enriched.id
      });
      return;
    }
    if (shouldIgnoreNormalizedItem(enriched)) {
      ignored.push({
        reason: "non_post_entry",
        file: fileName,
        id: enriched.id
      });
      return;
    }
    filteredItems.push(enriched);
  });
  return {
    items: filteredItems,
    followers: followerEvents,
    ignored,
    rawSnippet,
    flags
  };
}
function expandZip(buffer, parentName = "archive.zip") {
  const zip = new _admZip.default(buffer);
  return zip.getEntries().filter(entry => !entry.isDirectory).map(entry => ({
    buffer: entry.getData(),
    fileName: `${parentName}:${entry.entryName}`,
    mimetype: "",
    size: entry.header.size || entry.getData().length || 0
  }));
}
function processUploadBuffer(files = [], {
  platformHint = null,
  sourceType = "upload-single"
} = {}) {
  try {
    const queue = [];
    const summary = {
      totalFiles: files.length,
      processedFiles: 0,
      ignoredFiles: 0,
      ignoredMedia: 0,
      mediaFiles: [],
      historyOnlyFiles: 0
    };
    const ignoredEntries = [];
    const rawFilesMeta = [];
    const flags = {
      hasWatchHistory: false
    };
    const items = [];
    const followers = [];
    const perPlatform = {};
    files.filter(Boolean).forEach(file => {
      try {
        queue.push(toInternalFile(file));
      } catch (error) {
        ignoredEntries.push({
          reason: "invalid-buffer",
          detail: error.message
        });
        summary.ignoredFiles += 1;
      }
    });
    while (queue.length) {
      const entry = queue.shift();
      const extension = _path.default.extname(entry.fileName || "").toLowerCase();
      if (MEDIA_EXTENSIONS.has(extension)) {
        summary.ignoredMedia += 1;
        summary.mediaFiles.push(entry.fileName);
        continue;
      }
      if (extension === ".zip") {
        try {
          const expanded = expandZip(entry.buffer, entry.fileName);
          summary.totalFiles += expanded.length;
          queue.push(...expanded);
        } catch (error) {
          summary.ignoredFiles += 1;
          ignoredEntries.push({
            reason: "zip_extract_failed",
            fileName: entry.fileName,
            detail: error.message
          });
        }
        continue;
      }
      const textContent = readText(entry.buffer);
      const isJsonLike = looksLikeJsonString(textContent);
      let detectionPayload;
      if (isJsonLike) {
        try {
          detectionPayload = JSON.parse(textContent);
        } catch (error) {
          summary.ignoredFiles += 1;
          ignoredEntries.push({
            reason: "invalid_json",
            fileName: entry.fileName,
            detail: error.message,
            snippet: textContent.slice(0, 200)
          });
          continue;
        }
      } else {
        detectionPayload = textContent;
      }
      const detection = autoDetectPlatform(detectionPayload, entry.fileName);
      if (platformHint && platformHint !== "unknown" && detection.platform === "unknown") {
        detection.platform = (0, _normalizedPost.clampPlatform)(platformHint);
        detection.reason = "Fiel auf angegebenes Platform-Hint zurück";
        detection.confidence = 0.5;
      }
      if (detection.platform === "unknown") {
        summary.ignoredFiles += 1;
        ignoredEntries.push({
          reason: detection.reason,
          fileName: entry.fileName,
          snippet: textContent.slice(0, 200)
        });
        continue;
      }
      const parsedPayload = isJsonLike && detectionPayload && typeof detectionPayload === "object" ? detectionPayload : textContent;
      const {
        items: normalizedItems,
        followers: detectedFollowers = [],
        ignored,
        rawSnippet,
        flags: localFlags
      } = filterRelevantData(parsedPayload, detection.platform, entry.fileName);
      if (localFlags?.hasWatchHistory) {
        flags.hasWatchHistory = true;
        summary.historyOnlyFiles += 1;
      }
      ignoredEntries.push(...ignored.map(info => ({
        ...info,
        fileName: entry.fileName
      })));
      rawFilesMeta.push({
        fileName: entry.fileName,
        platform: detection.platform,
        size: entry.size,
        confidence: detection.confidence,
        reason: detection.reason,
        sourceType,
        itemsExtracted: normalizedItems.length
      });
      if (!normalizedItems.length) {
        summary.ignoredFiles += 1;
        continue;
      }
      summary.processedFiles += 1;
      if (detectedFollowers.length) {
        followers.push(...detectedFollowers);
      }
      normalizedItems.forEach(normalized => {
        items.push(normalized);
        const platformKey = normalized.platform || detection.platform;
        perPlatform[platformKey] = perPlatform[platformKey] || {
          count: 0
        };
        perPlatform[platformKey].count += 1;
      });
    }
    const platformCounts = Object.fromEntries(Object.entries(perPlatform).map(([platform, bucket]) => [platform, bucket.count]));
    const primaryPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || (platformHint && platformHint !== "unknown" ? platformHint : "unknown");
    return {
      items,
      followers,
      perPlatform,
      ignoredEntries,
      rawFilesMeta,
      summary,
      rawSnippet: null,
      primaryPlatform,
      totals: {
        items: items.length,
        perPlatformCounts: platformCounts
      },
      flags
    };
  } catch (error) {
    console.error("[UploadEngine] processing failed:", error);
    return {
      items: [],
      followers: [],
      perPlatform: {},
      ignoredEntries: [{
        reason: "engine-error",
        detail: error.message
      }],
      rawFilesMeta: [],
      summary: {
        totalFiles: files.length || 0,
        processedFiles: 0,
        ignoredFiles: files.length || 0,
        ignoredMedia: 0,
        mediaFiles: [],
        historyOnlyFiles: 0
      },
      rawSnippet: null,
      primaryPlatform: platformHint || "unknown",
      totals: {
        items: 0,
        perPlatformCounts: {}
      },
      flags: {
        hasWatchHistory: false
      }
    };
  }
}
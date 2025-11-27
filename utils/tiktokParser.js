const SHARE_LINK_PREFIX = "https://www.tiktokv.com/share/video/";
const LINK_PATTERNS = ["tiktok.com", "tiktokv.com", "tiktokv.eu"];

const SECTION_DEFINITIONS = [
  { name: "Post.Posts", path: ["Post", "Posts", "VideoList"], type: "posted" },
  { name: "Post.RecentlyDeleted", path: ["Post", "Recently Deleted Posts"], arrayKey: "PostList", type: "deleted" },
  { name: "Post.RecentlyDeletedVideos", path: ["Post", "Recently Deleted Videos", "VideoList"], type: "deleted" },
  { name: "Activity.Videos", path: ["Activity", "Videos", "VideoList"], type: "posted" },
  { name: "Activity.AppLog.Videos", path: ["Activity", "App Log", "Videos"], arrayKey: "VideoList", type: "posted" },
  { name: "Videos.VideoList", path: ["Videos", "VideoList"], type: "posted" },
  { name: "Videos.RecentlyDeleted", path: ["Videos", "Recently Deleted Videos"], arrayKey: "VideoList", type: "deleted" },
  { name: "Activity.FavoriteVideos", path: ["Activity", "Favorite Videos"], arrayKey: "VideoList", type: "posted" },
  { name: "Activity.LikeList", path: ["Activity", "Like List"], arrayKey: "ItemFavoriteList", type: "posted" },
  { name: "Activity.FavoriteList", path: ["Activity", "Favorite List"], arrayKey: "FavoriteVideoList", type: "posted" },
  { name: "Deleted.Videos", path: ["Deleted", "Videos"], arrayKey: "VideoList", type: "deleted" },
  { name: "ShareHistory", path: ["Share History", "ShareHistoryList"], type: "watch" },
  { name: "Activity.VideoBrowsingHistory", path: ["Activity", "Video Browsing History"], arrayKey: "VideoList", type: "watch" },
  { name: "WatchHistory", path: ["WatchHistory", "VideoList"], type: "watch" },
  { name: "Activity.Videos.Legacy", path: ["Activity", "Videos"], arrayKey: "VideoList", type: "posted" },
  { name: "Videos.Legacy", path: ["Videos"], arrayKey: "VideoList", type: "posted" }
];

const FALLBACK_ARRAY_KEYS = ["VideoList", "ItemFavoriteList", "FavoriteVideoList", "List", "items"];
const LIKES_KEYS = ["Likes", "Like Count", "LikeCount", "LikesCount", "Like", "Favorite"];
const TITLE_KEYS = ["Title", "Text", "Caption", "Description"];
const SOUND_KEYS = ["Sound", "Audio Name", "SoundName"];
const LOCATION_KEYS = ["Location", "ShootLocation"];
const COVER_KEYS = ["CoverImage", "Cover", "Thumbnail", "VideoCover", "Cover Url"];
const DATE_FIELDS = ["Date", "Create Time", "CreationTime", "CreateTime", "Timestamp", "time", "Time", "DateCreated"];

function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || ["n/a", "na", "none", "null", "undefined"].includes(trimmed.toLowerCase())) {
    return "";
  }
  return trimmed;
}

function sanitizeAssetUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed;
}

function isTikTokLink(link) {
  if (typeof link !== "string") return false;
  return LINK_PATTERNS.some((pattern) => link.includes(pattern));
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const str = String(value).trim();
  if (!str) return null;
  const isoCandidate = /^\d{4}-\d{2}-\d{2}(?:\s|\T)\d{2}:\d{2}:\d{2}/.test(str) ? str.replace(" ", "T") : str;
  const dateObj = new Date(isoCandidate);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

function coerceArray(node, preferredKey) {
  if (!node) return null;
  if (Array.isArray(node)) return node;
  if (preferredKey && Array.isArray(node[preferredKey])) {
    return node[preferredKey];
  }
  for (const key of FALLBACK_ARRAY_KEYS) {
    if (Array.isArray(node[key])) {
      return node[key];
    }
  }
  return null;
}

function extractList(root, path = [], arrayKey) {
  if (!root) return null;
  let node = root;
  for (const segment of path) {
    if (!node || typeof node !== "object") {
      return null;
    }
    node = node[segment];
  }
  return coerceArray(node, arrayKey);
}

function extractField(item, keys, transformer = (v) => v) {
  for (const key of keys) {
    if (key in item && item[key] !== undefined && item[key] !== null) {
      return transformer(item[key]);
    }
  }
  return undefined;
}

function buildVideo(item = {}, ctx = {}) {
  if (!item || typeof item !== "object") return null;
  const candidateLink = item.Link || item.URL || item.VideoLink || item.Uri || item.href;
  if (!candidateLink || !isTikTokLink(candidateLink) || candidateLink.startsWith(SHARE_LINK_PREFIX)) {
    return null;
  }

  const rawDate =
    extractField(item, DATE_FIELDS) ||
    (item.Extra && extractField(item.Extra, DATE_FIELDS)) ||
    item.DateDeleted;
  const dateObj = normalizeDate(rawDate);
  if (!dateObj) {
    return null;
  }

  const titleValue = sanitizeText(extractField(item, TITLE_KEYS) || item.caption || item.text);
  const soundValue = sanitizeText(extractField(item, SOUND_KEYS));
  const locationValue = sanitizeText(extractField(item, LOCATION_KEYS));
  const coverImage = sanitizeAssetUrl(extractField(item, COVER_KEYS));

  return {
    platform: "tiktok",
    date: dateObj.toISOString(),
    timestamp: dateObj.getTime(),
    link: candidateLink,
    likes: normalizeNumber(extractField(item, LIKES_KEYS)),
    title: titleValue || "Unbekanntes TikTok Video",
    caption: titleValue || "Unbekanntes TikTok Video",
    sound: soundValue || "Unbekannter Sound",
    location: locationValue || "Unbekannt",
    coverImage: coverImage || null,
    sourceSection: ctx.sourceSection || "unknown",
    isDeleted: Boolean(ctx.isDeleted)
  };
}

function addIgnored(ignoredMap, totals, reason, example) {
  const entry = ignoredMap.get(reason) || { reason, count: 0, examples: [] };
  entry.count += 1;
  if (example && entry.examples.length < 5 && !entry.examples.includes(example)) {
    entry.examples.push(example);
  }
  ignoredMap.set(reason, entry);
  totals.ignored += 1;
}

function isWatchSection(name) {
  if (!name) return false;
  const needle = name.toLowerCase();
  return needle.includes("watch") || needle.includes("browsing") || needle.includes("history");
}

export function extractVideoLinksFromAnyObject(node, currentPath = [], results = [], seenCollections = null) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    if (seenCollections?.has(node)) {
      return results;
    }
    const hasLinkEntries = node.some((entry) => entry && typeof entry === "object" && isTikTokLink(entry.Link || entry.URL || entry.href));
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

  const keys = Object.keys(node);
  if (isTikTokLink(node.Link || node.URL || node.href)) {
    results.push({
      list: [node],
      sourceSection: currentPath.join(".") || "detected"
    });
    return results;
  }

  keys.forEach((key) => {
    extractVideoLinksFromAnyObject(node[key], [...currentPath, key], results, seenCollections);
  });
  return results;
}

export function parseTikTokExport(json, sourceFileName = "unknown") {
  const videos = [];
  const ignoredMap = new Map();
  const seenKeys = new Set();
  const totals = { videos: 0, ignored: 0, watchHistory: 0 };
  let primarySource = null;
  const processedCollections = new WeakSet();

  function pushVideo(item, ctx) {
    const video = buildVideo(item, ctx);
    if (!video) {
      addIgnored(ignoredMap, totals, "invalid_video_entry", item?.Link || item?.URL || "missing-link");
      return;
    }
    const dedupeKey = `${video.link}|${video.timestamp || ""}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    if (!primarySource && ctx.type !== "watch") {
      primarySource = ctx.sourceSection || "auto";
    }
    videos.push(video);
  }

  SECTION_DEFINITIONS.forEach((section) => {
    const list = extractList(json, section.path, section.arrayKey);
    if (!Array.isArray(list)) return;
    processedCollections.add(list);
    list.forEach((item) => {
      const link = item?.Link || item?.URL || item?.VideoLink;
      if (!isTikTokLink(link)) {
        addIgnored(ignoredMap, totals, "invalid_video_entry", link || section.name);
        return;
      }
      if (section.type === "watch") {
        totals.watchHistory += 1;
        addIgnored(ignoredMap, totals, "watch_history", link);
        return;
      }
      pushVideo(item, { sourceSection: section.name, isDeleted: section.type === "deleted", type: section.type });
    });
  });

  const fallbackEntries = extractVideoLinksFromAnyObject(json, [], [], processedCollections);
  fallbackEntries.forEach(({ list, sourceSection }) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      const link = item?.Link || item?.URL;
      if (!isTikTokLink(link)) return;
      if (isWatchSection(sourceSection)) {
        totals.watchHistory += 1;
        addIgnored(ignoredMap, totals, "watch_history", link);
        return;
      }
      pushVideo(item, { sourceSection: sourceSection || "auto-detected" });
    });
  });

  totals.videos = videos.length;

  const rawSnippet = (() => {
    try {
      return JSON.stringify(json, null, 2).split("\n").slice(0, 20).join("\n");
    } catch {
      return null;
    }
  })();

  return {
    rawPlatform: "tiktok",
    sourceType: primarySource || "auto-detected",
    rawJsonSnippet: rawSnippet,
    videos,
    ignoredEntries: [...ignoredMap.values()],
    totals
  };
}

export function extractRealPostsFromAnyTikTokSchema(json) {
  const result = parseTikTokExport(json);
  return result.videos;
}


import { createNormalizedPost } from "../normalizedPost.js";

function extractHashtags(text = "") {
  if (typeof text !== "string") return [];
  const matches = text.match(/#([a-z0-9_]+)/gi);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.replace("#", "").toLowerCase()))];
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function detectVideoId(entry) {
  if (!entry || typeof entry !== "object") return null;
  return (
    entry.id ||
    entry.videoId ||
    entry.contentDetails?.videoId ||
    entry.snippet?.resourceId?.videoId ||
    entry.snippet?.videoId ||
    null
  );
}

function isYouTubeVideo(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Boolean(
    (entry.snippet?.publishedAt || entry.publishedAt || entry.uploaded_at) &&
      (detectVideoId(entry) || entry.snippet?.title || entry.title)
  );
}

function collectYouTubeEntries(payload) {
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
      current.forEach((value) => {
        if (typeof value === "object" || Array.isArray(value)) {
          stack.push(value);
        }
      });
      continue;
    }

    if (typeof current === "object") {
      if (isYouTubeVideo(current)) {
        results.push(current);
      }
      Object.values(current).forEach((value) => {
        if (typeof value === "object" || Array.isArray(value)) {
          stack.push(value);
        }
      });
    }
  }

  return results;
}

function normalizeYoutubeItem(entry) {
  const isoDate = toIsoDate(entry.snippet?.publishedAt || entry.publishedAt || entry.uploaded_at);
  if (!isoDate) return null;

  const videoId = detectVideoId(entry);
  const link = videoId ? `https://www.youtube.com/watch?v=${videoId}` : entry.url || "";
  const title = entry.snippet?.title || entry.title || "";
  const description = entry.snippet?.description || entry.description || "";
  const stats = entry.statistics || entry.metrics || {};

  return createNormalizedPost({
    id: videoId || link || isoDate,
    platform: "youtube",
    date: isoDate,
    link,
    likes: Number(stats.likeCount || entry.likes || 0),
    comments: Number(stats.commentCount || entry.comment_count || 0),
    views: Number(stats.viewCount || entry.views || 0),
    caption: title,
    meta: {
      description,
      hashtags: extractHashtags(`${title}\n${description}`),
      raw: entry
    }
  });
}

export function parseYouTubeExport(payload) {
  try {
    if (!payload || typeof payload !== "object") return [];
    const entries = collectYouTubeEntries(payload);
    return entries.map(normalizeYoutubeItem).filter(Boolean);
  } catch (error) {
    console.warn("[Parser] YouTube JSON konnte nicht verarbeitet werden:", error.message);
    return [];
  }
}

export const parseYoutubeJson = parseYouTubeExport;



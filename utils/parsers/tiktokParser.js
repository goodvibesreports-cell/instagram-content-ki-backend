import { createNormalizedPost } from "../normalizedPost.js";

const STORAGE_LINK_REGEX = /https:\/\/[a-z0-9-]+\.tiktokv\.(?:com|eu|us)\/storage\//i;
const SHARE_LINK_PREFIX = "https://www.tiktokv.com/share/video/";
const BLOCKED_LINK_PATTERNS = ["tiktok.com/login", "redirect_url=", "webapp-useastred"];

const SECTION_DEFINITIONS = [
  { key: "published", path: ["Post", "Posts", "VideoList"], isDeleted: false },
  { key: "recentlyDeleted", path: ["Post", "Recently Deleted Videos", "VideoList"], isDeleted: true }
];

const LIKE_FIELDS = ["Likes", "Like Count", "like_count"];
const VIEW_FIELDS = ["Views", "Play Count", "view_count"];
const COMMENT_FIELDS = ["Comments", "Comment Count", "comment_count"];
const DATE_FIELDS = ["Date", "Create Time", "CreationTime", "Timestamp", "Created", "time"];
const TEXT_PLACEHOLDERS = new Set(["", "n/a", "na", "null", "undefined", "keine angabe"]);

function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (TEXT_PLACEHOLDERS.has(normalized.toLowerCase())) return "";
  return normalized;
}

function sanitizeUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && !TEXT_PLACEHOLDERS.has(trimmed.toLowerCase()) ? trimmed : "";
}

function isShareLink(link) {
  return typeof link === "string" && link.startsWith(SHARE_LINK_PREFIX);
}

function sanitizeLink(candidate = "") {
  if (typeof candidate !== "string") return "";
  const trimmed = candidate.trim();
  if (!trimmed || isShareLink(trimmed)) return "";
  if (!STORAGE_LINK_REGEX.test(trimmed)) return "";
  if (BLOCKED_LINK_PATTERNS.some((pattern) => trimmed.includes(pattern))) return "";
  return trimmed;
}

function normalizeDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const str = String(value).trim();
  if (!str) return null;
  let candidate = str;
  if (
    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str) &&
    !str.toLowerCase().includes("gmt") &&
    !/[+-]\d{2}:?\d{2}$/.test(str) &&
    !str.endsWith("z")
  ) {
    candidate = `${str.replace(" ", "T")}Z`;
  }
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractHashtags(...texts) {
  const buffer = texts.filter(Boolean).join(" ");
  if (!buffer) return [];
  const matches = buffer.match(/#([a-z0-9_]+)/gi);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.replace("#", "").toLowerCase()))];
}

function getNestedValue(node, path = []) {
  return path.reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return undefined;
  }, node);
}

function buildNormalizedPost(item = {}, { isDeleted = false } = {}) {
  if (!item || typeof item !== "object") return null;

  const link = sanitizeLink(item.Link || item.URL || item.VideoLink);
  if (!link) return null;

  const dateValue = DATE_FIELDS.map((field) => item[field]).find((val) => val);
  const isoDate = normalizeDate(dateValue);
  if (!isoDate) return null;

  const title =
    cleanText(item.Title) ||
    cleanText(item.Caption) ||
    cleanText(item.Description) ||
    cleanText(item.AlternateText) ||
    "TikTok Video";

  const likes = LIKE_FIELDS.reduce((current, field) => (current !== 0 ? current : normalizeNumber(item[field])), 0);
  const views = VIEW_FIELDS.reduce((current, field) => (current !== 0 ? current : normalizeNumber(item[field])), 0);
  const comments = COMMENT_FIELDS.reduce(
    (current, field) => (current !== 0 ? current : normalizeNumber(item[field])),
    0
  );

  return createNormalizedPost({
    id: link,
    platform: "tiktok",
    date: isoDate,
    link,
    likes,
    comments,
    views,
    caption: title,
    soundOrAudio: cleanText(item.Sound),
    location: cleanText(item.Location),
    isDeleted: Boolean(isDeleted),
    meta: {
      coverImage: sanitizeUrl(item.CoverImage),
      hashtags: extractHashtags(item.Caption, item.Title, item.Description),
      allowComments: item.AllowComments ?? null,
      whoCanView: item.WhoCanView ?? null,
      raw: item
    }
  });
}

export function parseTiktokJson(payload) {
  const posts = [];
  const uniqueLinks = new Set();

  if (!payload || typeof payload !== "object") {
    return posts;
  }

  SECTION_DEFINITIONS.forEach(({ path, isDeleted }) => {
    const section = getNestedValue(payload, path);
    if (!Array.isArray(section) || !section.length) {
      return;
    }

    section.forEach((item) => {
      const post = buildNormalizedPost(item, { isDeleted });
      if (!post) {
        return;
      }
      if (uniqueLinks.has(post.link)) {
        return;
      }
      uniqueLinks.add(post.link);
      posts.push(post);
    });
  });

  return posts;
}



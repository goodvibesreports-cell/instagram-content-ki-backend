/**
 * @typedef {Object} NormalizedPost
 * @property {string} id
 * @property {"tiktok"|"instagram"|"facebook"} platform
 * @property {string} date
 * @property {string} link
 * @property {number} likes
 * @property {number} [comments]
 * @property {number} [shares]
 * @property {number} [views]
 * @property {string} [title]
 * @property {string} [caption]
 * @property {string} [description]
 * @property {string} [soundOrAudio]
 * @property {string} [location]
 * @property {boolean} [isDeleted]
 * @property {number} [timestamp]
 * @property {string[]} [hashtags]
 * @property {Record<string, any>} [meta]
 */

/**
 * @typedef {Object} UnifiedContentItem
 * @property {"tiktok"|"instagram"|"facebook"} platform
 * @property {string} externalId
 * @property {{ likes: number; views?: number; comments?: number; shares?: number; saves?: number }} metrics
 * @property {{ caption?: string; title?: string; hashtags?: string[] }} text
 * @property {{ hourOfDay?: number; dayOfWeek?: number }} temporal
 * @property {boolean} [isDeleted]
 * @property {string} [link]
 * @property {string} [date]
 * @property {Record<string, any>} [meta]
 */

export const SUPPORTED_PLATFORMS = ["tiktok", "instagram", "facebook"];

export function createNormalizedPost(overrides = {}) {
  const fallbackId = `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const resolvedDate = overrides.date || new Date().toISOString();
  const resolvedTimestamp =
    typeof overrides.timestamp === "number"
      ? overrides.timestamp
      : (() => {
          const parsed = new Date(resolvedDate);
          return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
        })();
  return {
    id: overrides.id || overrides.link || fallbackId,
    platform: overrides.platform || "tiktok",
    date: resolvedDate,
    timestamp: resolvedTimestamp,
    link: overrides.link || "",
    likes: Number(overrides.likes) || 0,
    comments: Number(overrides.comments) || 0,
    shares: Number(overrides.shares) || 0,
    views: Number(overrides.views) || 0,
    title: overrides.title || "",
    caption: overrides.caption || "",
    description: overrides.description || "",
    soundOrAudio: overrides.soundOrAudio || "",
    location: overrides.location || "",
    isDeleted: Boolean(overrides.isDeleted),
    hashtags: overrides.hashtags || [],
    meta: overrides.meta || {}
  };
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function clampPlatform(value) {
  if (!value || typeof value !== "string") return "tiktok";
  const normalized = value.toLowerCase();
  return SUPPORTED_PLATFORMS.includes(normalized) ? normalized : "tiktok";
}

export function normalizedFromTikTokVideo(video) {
  if (!video) return null;
  return createNormalizedPost({
    id: video.externalId,
    platform: "tiktok",
    date: video.date,
    link: video.link,
    likes: Number(video.likes) || 0,
    comments: Number(video.comments) || 0,
    shares: Number(video.shares) || 0,
    views: Number(video.views) || 0,
    caption: video.caption || video.title || "",
    soundOrAudio: video.sound || "",
    location: video.location || "",
    isDeleted: Boolean(video.isDeleted),
    meta: {
      coverImage: video.coverImage,
      whoCanView: video.whoCanView,
      aiGenerated: video.aiGenerated,
      allowComments: video.allowComments,
      allowStitches: video.allowStitches,
      allowDuets: video.allowDuets,
      allowSharingToStory: video.allowSharingToStory,
      sourceFile: video.sourceFile,
      hourOfDay: video.hourOfDay,
      dayOfWeek: video.dayOfWeek,
      raw: video
    }
  });
}


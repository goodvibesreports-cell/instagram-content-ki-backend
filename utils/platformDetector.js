"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PLATFORM_DATA_TYPES = void 0;
exports.detectPlatform = detectPlatform;
exports.detectPlatformAndType = void 0;
const TIKTOK_ROOT_KEYS = ["Ads and data", "App Settings", "Post", "Profile", "TikTok Shop", "Tiktok Live", "TikTok Live", "Your Activity"];
const SHARE_LINK_PREFIX = "https://www.tiktokv.com/share/video/";
const PLATFORM_DATA_TYPES = exports.PLATFORM_DATA_TYPES = {
  POSTS: "tiktok_posts",
  DELETED_POSTS: "tiktok_deleted_posts",
  WATCH_HISTORY: "tiktok_watch_history",
  LIKE_LIST: "tiktok_likes",
  PROFILE: "tiktok_profile",
  UNKNOWN: "generic_unknown"
};
function get(obj, path = []) {
  return path.reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}
function hasShareLinks(list = []) {
  return list.some(item => {
    const link = item?.Link || item?.link || "";
    return typeof link === "string" && link.startsWith(SHARE_LINK_PREFIX);
  });
}
function detectTikTokDataType(json) {
  const postList = get(json, ["Post", "Posts", "VideoList"]);
  const deletedList = get(json, ["Post", "Recently Deleted Posts", "PostList"]) || get(json, ["Post", "Recently Deleted Videos", "VideoList"]);
  const watchHistory = get(json, ["Your Activity", "Watch History", "VideoList"]);
  const likeList = get(json, ["Your Activity", "Like List", "ItemFavoriteList"]) || get(json, ["Activity", "Like List", "ItemFavoriteList"]);
  const profileMap = get(json, ["Profile", "Profile Info", "ProfileMap"]);
  if (Array.isArray(postList) && postList.length) {
    return PLATFORM_DATA_TYPES.POSTS;
  }
  if (Array.isArray(deletedList) && deletedList.length) {
    return PLATFORM_DATA_TYPES.DELETED_POSTS;
  }
  if (Array.isArray(watchHistory) && watchHistory.length && hasShareLinks(watchHistory)) {
    return PLATFORM_DATA_TYPES.WATCH_HISTORY;
  }
  if (Array.isArray(likeList) && likeList.length && hasShareLinks(likeList)) {
    return PLATFORM_DATA_TYPES.LIKE_LIST;
  }
  if (profileMap && typeof profileMap === "object") {
    const keys = ["displayName", "userName", "bioDescription", "followerCount", "likesReceived"];
    if (keys.some(key => key in profileMap)) {
      return PLATFORM_DATA_TYPES.PROFILE;
    }
  }
  return PLATFORM_DATA_TYPES.UNKNOWN;
}
function detectPlatform(json, sourceFileName = "unknown") {
  const result = {
    platform: "unknown",
    dataType: PLATFORM_DATA_TYPES.UNKNOWN,
    confidence: 0,
    reason: "No known platform patterns detected",
    warnings: [],
    sourceFileName
  };
  if (!json || typeof json !== "object") {
    result.warnings.push("Empty or invalid JSON payload");
    return result;
  }
  const rootKeys = Object.keys(json);
  const tikTokScore = rootKeys.filter(key => TIKTOK_ROOT_KEYS.includes(key)).length;
  const dataType = detectTikTokDataType(json);
  if (tikTokScore >= 2 || dataType !== PLATFORM_DATA_TYPES.UNKNOWN) {
    result.platform = "tiktok";
    result.dataType = dataType;
    result.confidence = dataType === PLATFORM_DATA_TYPES.POSTS ? 0.95 : dataType === PLATFORM_DATA_TYPES.UNKNOWN ? 0.6 : 0.85;
    result.reason = dataType === PLATFORM_DATA_TYPES.POSTS ? "Found Post.Posts.VideoList and TikTok-typical root keys" : `Detected TikTok export type: ${dataType}`;
    return result;
  }
  result.reason = "No TikTok markers (Post/Profile/Your Activity) detected";
  result.warnings.push("Unrecognized export format");
  return result;
}
const detectPlatformAndType = exports.detectPlatformAndType = detectPlatform;
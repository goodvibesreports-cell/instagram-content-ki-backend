"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = analyzeContent;
var _tiktokAnalyzer = _interopRequireDefault(require("./tiktokAnalyzer.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function getDateParts(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date,
    hour: date.getHours(),
    weekday: date.getDay()
  };
}
function determinePrimaryPlatform(posts = []) {
  if (!posts.length) return "mixed";
  const counts = posts.reduce((acc, post) => {
    const key = (post.platform || "tiktok").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
function transformForTikTok(posts = []) {
  return posts.map(post => ({
    caption: post.caption || "",
    title: post.caption || "",
    likes: safeNumber(post.likes),
    views: safeNumber(post.views),
    comments: safeNumber(post.comments),
    link: post.link,
    hashtags: post.meta?.hashtags || [],
    timestamp: post.date,
    sound: post.soundOrAudio || post.meta?.raw?.Sound || "",
    location: post.location || "",
    raw: post.meta?.raw || post.meta || {}
  }));
}
function analyzeContent(posts = [], {
  platformFilter = null
} = {}) {
  const filteredPosts = Array.isArray(posts) ? posts.filter(post => !platformFilter || post.platform === platformFilter) : [];
  const safePosts = filteredPosts.length ? filteredPosts : [];
  const primaryPlatform = platformFilter || determinePrimaryPlatform(safePosts);
  const hoursMap = new Map();
  const daysMap = new Map();
  let totalLikes = 0;
  let totalPosts = safePosts.length;
  const platformsBreakdown = {};
  safePosts.forEach(post => {
    platformsBreakdown[post.platform] = (platformsBreakdown[post.platform] || 0) + 1;
    totalLikes += safeNumber(post.likes);
    const parts = getDateParts(post.date);
    if (!parts) return;
    const hourEntry = hoursMap.get(parts.hour) || {
      hour: parts.hour,
      likes: 0,
      posts: 0
    };
    hourEntry.likes += safeNumber(post.likes);
    hourEntry.posts += 1;
    hoursMap.set(parts.hour, hourEntry);
    const dayEntry = daysMap.get(parts.weekday) || {
      weekday: WEEKDAYS[parts.weekday],
      likes: 0,
      posts: 0
    };
    dayEntry.likes += safeNumber(post.likes);
    dayEntry.posts += 1;
    daysMap.set(parts.weekday, dayEntry);
  });
  const bestPostingHours = [...hoursMap.values()].map(entry => ({
    hour: entry.hour,
    posts: entry.posts,
    score: entry.posts ? entry.likes / entry.posts : 0
  }));
  bestPostingHours.sort((a, b) => b.score - a.score);
  const bestDaysOfWeek = [...daysMap.values()].map((entry, idx) => ({
    day: entry.weekday,
    posts: entry.posts,
    score: entry.posts ? entry.likes / entry.posts : 0,
    index: idx
  }));
  bestDaysOfWeek.sort((a, b) => b.score - a.score);
  const topPostsByLikes = [...safePosts].sort((a, b) => b.likes - a.likes).slice(0, 5);
  const topPostsByEngagement = [...safePosts].map(post => {
    const denominator = safeNumber(post.views) || 1;
    return {
      ...post,
      engagementScore: (safeNumber(post.likes) + safeNumber(post.comments)) / denominator * 100
    };
  }).sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 5);
  const basicStats = {
    totalPosts,
    totalLikes,
    avgLikes: totalPosts ? Math.round(totalLikes / totalPosts) : 0,
    platformsBreakdown
  };
  const analysis = {
    platform: primaryPlatform,
    bestPostingHours,
    bestDaysOfWeek,
    topPostsByLikes,
    topPostsByEngagement,
    basicStats,
    platformInsights: {}
  };
  if (primaryPlatform === "tiktok" && safePosts.length) {
    const tiktokInsights = (0, _tiktokAnalyzer.default)(transformForTikTok(safePosts));
    analysis.platformInsights.tiktok = tiktokInsights;
    analysis.bestTimes = tiktokInsights.bestTimes;
    analysis.bestDays = tiktokInsights.bestDays;
    analysis.virality = tiktokInsights.virality;
    analysis.sounds = tiktokInsights.sounds;
    analysis.themes = tiktokInsights.themes;
    analysis.stats = tiktokInsights.stats;
    analysis.creatorDNA = tiktokInsights.creatorDNA;
  }
  return analysis;
}
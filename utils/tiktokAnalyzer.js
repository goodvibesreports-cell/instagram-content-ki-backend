"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.analyzeTikTokVideos = analyzeTikTokVideos;
exports.default = analyzeTikTokData;
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MAX_ANALYSIS_ITEMS = 10_000;
const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const STOP_WORDS = new Set(["und", "oder", "aber", "nicht", "kein", "keine", "der", "die", "das", "ein", "eine", "des", "den", "dem", "auf", "mit", "für", "von", "ist", "sind", "the", "and", "for", "you", "your", "are", "was", "were", "that", "this", "those", "these", "there", "hier", "dort", "zum", "zur", "ins", "im", "in", "als", "bei", "wir", "ich", "sie", "er", "man", "auch", "noch", "very", "more"]);
const DEFAULT_ANALYSIS = {
  bestTimes: {
    hours: Array.from({
      length: 24
    }, (_, hour) => ({
      hour,
      posts: 0,
      avgLikes: 0,
      score: 0
    })),
    bestHour: null
  },
  bestDays: {
    days: WEEKDAYS.map((weekday, index) => ({
      weekday,
      index,
      posts: 0,
      avgLikes: 0,
      score: 0
    })),
    bestDay: null
  },
  virality: {
    viralVideos: [],
    viralScore: 0,
    lifecycle: {
      averageLikesPerDay: 0,
      fastestGrower: null
    }
  },
  sounds: {
    topSounds: [],
    soundInsights: []
  },
  themes: {
    keywordMap: {},
    dominantThemes: []
  },
  stats: {
    minLikes: 0,
    maxLikes: 0,
    avgLikes: 0,
    medianLikes: 0,
    totalPosts: 0
  },
  creatorDNA: {
    mood: "Neutral",
    tone: "Unbekannt",
    narrativeStyle: "Unbekannt",
    contentPatterns: [],
    postingBehavior: "Keine Daten"
  }
};
const MS_PER_DAY = 86_400_000;
function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Number.isFinite(value) ? Math.round(value * factor) / factor : 0;
}
function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function computeMedian(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
function getDateParts(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    hour: date.getHours(),
    weekday: date.getDay(),
    timestamp: date.getTime()
  };
}
function ensurePosts(posts) {
  return Array.isArray(posts) ? posts : [];
}
function convertNormalizedPost(post) {
  if (!post) return null;
  return {
    caption: post.caption || "",
    title: post.caption || "",
    likes: safeNumber(post.likes),
    views: safeNumber(post.views),
    comments: safeNumber(post.comments),
    link: post.link,
    hashtags: post.meta?.hashtags || [],
    timestamp: post.date || post.timestamp,
    sound: post.sound || post.soundOrAudio || post.meta?.raw?.Sound || "",
    location: post.location || "",
    raw: post.meta?.raw || post.meta || {}
  };
}
function analyzeBestTimes(posts) {
  const buckets = Array.from({
    length: 24
  }, (_, hour) => ({
    hour,
    likes: 0,
    posts: 0
  }));
  posts.forEach(post => {
    const parts = getDateParts(post.timestamp || post.date);
    if (!parts) return;
    const likes = safeNumber(post.likes);
    const bucket = buckets[parts.hour];
    bucket.posts += 1;
    bucket.likes += likes;
  });
  const hours = buckets.map(bucket => ({
    hour: bucket.hour,
    posts: bucket.posts,
    avgLikes: bucket.posts ? round(bucket.likes / bucket.posts) : 0,
    score: bucket.posts ? round(bucket.likes / Math.max(bucket.posts, 1)) : 0
  }));
  const sorted = hours.filter(entry => entry.posts > 0).sort((a, b) => {
    if (b.score === a.score) {
      return b.posts - a.posts;
    }
    return b.score - a.score;
  });
  return {
    hours,
    bestHour: sorted[0]?.hour ?? null
  };
}
function analyzeBestDays(posts) {
  const buckets = WEEKDAYS.map((weekday, index) => ({
    weekday,
    index,
    likes: 0,
    posts: 0
  }));
  posts.forEach(post => {
    const parts = getDateParts(post.timestamp || post.date);
    if (!parts) return;
    const likes = safeNumber(post.likes);
    const bucket = buckets[parts.weekday];
    bucket.posts += 1;
    bucket.likes += likes;
  });
  const days = buckets.map(bucket => ({
    weekday: bucket.weekday,
    index: bucket.index,
    posts: bucket.posts,
    avgLikes: bucket.posts ? round(bucket.likes / bucket.posts) : 0,
    score: bucket.posts ? round(bucket.likes / Math.max(bucket.posts, 1)) : 0
  }));
  const sorted = days.filter(entry => entry.posts > 0).sort((a, b) => {
    if (b.score === a.score) {
      return b.posts - a.posts;
    }
    return b.score - a.score;
  });
  return {
    days,
    bestDay: sorted[0]?.weekday ?? null
  };
}
function computeStats(posts) {
  const likes = posts.map(post => safeNumber(post.likes)).filter(val => val >= 0);
  if (!likes.length) {
    return {
      ...DEFAULT_ANALYSIS.stats
    };
  }
  const minLikes = Math.min(...likes);
  const maxLikes = Math.max(...likes);
  const avgLikes = likes.reduce((sum, val) => sum + val, 0) / likes.length;
  const medianLikes = computeMedian(likes);
  return {
    minLikes,
    maxLikes,
    avgLikes: round(avgLikes),
    medianLikes: round(medianLikes),
    totalPosts: posts.length
  };
}
function computeVirality(posts, stats) {
  if (!posts.length) {
    return {
      ...DEFAULT_ANALYSIS.virality
    };
  }
  const baseline = stats.medianLikes || 1;
  let multiplierSum = 0;
  let multiplierCount = 0;
  let lifecycleAccumulator = 0;
  let fastestGrower = null;
  const now = Date.now();
  const videos = posts.map(post => {
    const likes = safeNumber(post.likes);
    const parts = getDateParts(post.timestamp || post.date);
    if (!parts) return null;
    const multiplier = likes / baseline;
    const daysSince = Math.max(1, (now - parts.timestamp) / MS_PER_DAY);
    const likesPerDay = likes / daysSince;
    lifecycleAccumulator += likesPerDay;
    if (!fastestGrower || likesPerDay > fastestGrower.likesPerDay) {
      fastestGrower = {
        title: post.title || "TikTok Video",
        link: post.link || null,
        likesPerDay: round(likesPerDay),
        likes
      };
    }
    multiplierSum += multiplier;
    multiplierCount += 1;
    return {
      title: post.title || "TikTok Video",
      link: post.link || null,
      likes,
      hour: parts.hour,
      weekday: WEEKDAY_SHORT[parts.weekday],
      multiplier: round(multiplier),
      source: post.source || (post.isDeleted ? "deleted" : "posted"),
      coverImage: post.coverImage || null,
      sound: post.sound || null,
      location: post.location || null
    };
  }).filter(Boolean).sort((a, b) => b.multiplier - a.multiplier || b.likes - a.likes).slice(0, 10);
  const viralScore = multiplierCount ? round(multiplierSum / multiplierCount) : 0;
  const averageLikesPerDay = posts.length ? round(lifecycleAccumulator / posts.length) : 0;
  return {
    viralVideos: videos,
    viralScore,
    lifecycle: {
      averageLikesPerDay,
      fastestGrower
    }
  };
}
function analyzeSounds(posts, stats) {
  if (!posts.length) {
    return {
      ...DEFAULT_ANALYSIS.sounds
    };
  }
  const baseline = stats.medianLikes || 1;
  const map = new Map();
  posts.forEach(post => {
    const key = post.sound && post.sound.trim() || "Original Sound";
    const likes = safeNumber(post.likes);
    const entry = map.get(key) || {
      sound: key,
      likes: [],
      totalLikes: 0,
      count: 0,
      multiplierSum: 0
    };
    entry.count += 1;
    entry.totalLikes += likes;
    entry.likes.push(likes);
    entry.multiplierSum += likes / baseline;
    map.set(key, entry);
  });
  const topSounds = [...map.values()].map(entry => ({
    sound: entry.sound,
    usage: entry.count,
    avgLikes: round(entry.totalLikes / entry.count),
    medianLikes: round(computeMedian(entry.likes)),
    viralMultiplier: round(entry.multiplierSum / entry.count)
  })).sort((a, b) => b.viralMultiplier - a.viralMultiplier || b.usage - a.usage).slice(0, 5);
  const soundInsights = topSounds.map(entry => ({
    sound: entry.sound,
    insight: `Sound "${entry.sound}" erzielt ${entry.viralMultiplier}x des Median-Like-Levels.`
  }));
  return {
    topSounds,
    soundInsights
  };
}
function extractKeywords(text = "") {
  return text.toLowerCase().replace(/[#@]/g, " ").replace(/[^a-z0-9äöüß\s]/gi, " ").split(/\s+/).filter(token => token.length >= 4 && !STOP_WORDS.has(token));
}
function analyzeThemes(posts, stats = {}) {
  if (!posts.length) {
    return {
      ...DEFAULT_ANALYSIS.themes
    };
  }
  const baseline = stats.medianLikes || 1;
  const map = new Map();
  posts.forEach(post => {
    const keywords = new Set(extractKeywords(post.title || post.description || ""));
    const likes = safeNumber(post.likes);
    keywords.forEach(keyword => {
      const entry = map.get(keyword) || {
        keyword,
        count: 0,
        likes: 0
      };
      entry.count += 1;
      entry.likes += likes;
      map.set(keyword, entry);
    });
  });
  const keywordMap = {};
  map.forEach((entry, keyword) => {
    const avg = entry.count ? entry.likes / entry.count : 0;
    keywordMap[keyword] = {
      occurrences: entry.count,
      avgLikes: round(avg),
      viralMultiplier: round(avg / baseline)
    };
  });
  const dominantThemes = Object.entries(keywordMap).map(([keyword, data]) => ({
    keyword,
    ...data
  })).sort((a, b) => b.viralMultiplier - a.viralMultiplier || b.occurrences - a.occurrences).slice(0, 5);
  return {
    keywordMap,
    dominantThemes
  };
}
function deriveToneFromThemes(dominantThemes = []) {
  if (!dominantThemes.length) return "Neutral";
  const keywords = dominantThemes.map(theme => theme.keyword);
  if (keywords.some(keyword => ["funny", "humor", "lol", "fun"].includes(keyword))) {
    return "Humorvoll & unterhaltsam";
  }
  if (keywords.some(keyword => ["tipps", "guide", "strategie", "how"].includes(keyword))) {
    return "Educativ & beratend";
  }
  if (keywords.some(keyword => ["story", "journey", "behind"].includes(keyword))) {
    return "Story-driven & persönlich";
  }
  return "Performance-orientiert";
}
function deriveNarrativeStyle(posts) {
  if (!posts.length) return "Unbekannt";
  const avgLength = posts.reduce((sum, post) => sum + (post.title ? post.title.split(/\s+/).length : 0), 0) / posts.length || 0;
  if (avgLength >= 12) return "Deep-Dive Storytelling";
  if (avgLength >= 7) return "Snackable Story Snippets";
  return "Hook-basierter Micro-Content";
}
function deriveContentPatterns(dominantThemes, sounds, bestTimes) {
  const patterns = [];
  if (dominantThemes.length) {
    patterns.push(`Dominante Keywords: ${dominantThemes.map(theme => theme.keyword).join(", ")}`);
  }
  if (sounds.topSounds.length) {
    patterns.push(`Top Sound "${sounds.topSounds[0].sound}" liefert ${sounds.topSounds[0].viralMultiplier}x Median-Likes`);
  }
  if (bestTimes.bestHour !== null) {
    patterns.push(`Peak Hour liegt bei ${bestTimes.bestHour}:00 Uhr`);
  }
  return patterns;
}
function derivePostingBehavior(bestTimes, bestDays, stats) {
  if (bestTimes.bestHour === null || !bestDays.bestDay) {
    return "Noch keine stabile Posting-Routine identifizierbar.";
  }
  return `Beste Performance am ${bestDays.bestDay} gegen ${bestTimes.bestHour}:00 Uhr (Median ${stats.medianLikes} Likes).`;
}
function deriveMood(stats) {
  if (!stats.totalPosts) return "Neutral";
  if (stats.avgLikes >= stats.medianLikes * 1.2) return "Dynamisch & wachstumsstark";
  if (stats.avgLikes <= stats.medianLikes * 0.8) return "Ruhig & experimentell";
  return "Stabil & konstant";
}
function buildCreatorDNA(posts, stats, themes, bestTimes, bestDays, sounds) {
  return {
    mood: deriveMood(stats),
    tone: deriveToneFromThemes(themes.dominantThemes),
    narrativeStyle: deriveNarrativeStyle(posts),
    contentPatterns: deriveContentPatterns(themes.dominantThemes, sounds, bestTimes),
    postingBehavior: derivePostingBehavior(bestTimes, bestDays, stats)
  };
}
function analyzeTikTokData(payload = [], metaOverride = {}) {
  let posts = payload;
  let meta = metaOverride;
  if (payload && typeof payload === "object" && Array.isArray(payload.posts)) {
    posts = payload.posts;
    meta = payload.meta || metaOverride || {};
  }
  let normalizedPosts = ensurePosts(posts);
  if (normalizedPosts.length && normalizedPosts[0]?.platform) {
    normalizedPosts = normalizedPosts.map(convertNormalizedPost).filter(Boolean);
  }
  if (!normalizedPosts.length) {
    return {
      ...DEFAULT_ANALYSIS,
      stats: {
        ...DEFAULT_ANALYSIS.stats,
        totalPosts: 0
      }
    };
  }
  const stats = computeStats(normalizedPosts);
  const bestTimes = analyzeBestTimes(normalizedPosts);
  const bestDays = analyzeBestDays(normalizedPosts);
  const themes = analyzeThemes(normalizedPosts, stats);
  const sounds = analyzeSounds(normalizedPosts, stats);
  const virality = computeVirality(normalizedPosts, stats);
  const creatorDNA = buildCreatorDNA(normalizedPosts, stats, themes, bestTimes, bestDays, sounds);
  return {
    bestTimes,
    bestDays,
    virality,
    sounds,
    themes,
    stats,
    creatorDNA,
    meta: {
      processed_links_count: meta?.processed_links_count ?? meta?.stats?.processedLinks ?? 0,
      ignored_links_count: meta?.ignored_links_count ?? meta?.stats?.ignoredLinks ?? 0
    }
  };
}
function resolveVideoParts(video) {
  if (!video) return null;
  if (typeof video.hourOfDay === "number" && typeof video.dayOfWeek === "number") {
    return {
      hour: video.hourOfDay,
      weekday: video.dayOfWeek
    };
  }
  const dateObj = normalizeDateValue(video.date || video.timestamp);
  if (Number.isNaN(dateObj.getTime())) return null;
  return {
    hour: dateObj.getUTCHours(),
    weekday: dateObj.getUTCDay(),
    date: dateObj
  };
}
function analyzeTikTokVideos(videos = []) {
  const safeVideos = Array.isArray(videos) ? videos.filter(Boolean) : [];
  if (!safeVideos.length) {
    return {
      bestPostingHours: [],
      postingDaysOfWeek: [],
      topVideos: [],
      globalStats: {
        totalVideos: 0,
        totalLikes: 0,
        avgLikes: 0
      }
    };
  }
  const workingVideos = safeVideos.length > MAX_ANALYSIS_ITEMS ? safeVideos.slice(0, MAX_ANALYSIS_ITEMS) : safeVideos;
  const hourBuckets = Array.from({
    length: 24
  }, (_, hour) => ({
    hour,
    totalLikes: 0,
    videoCount: 0
  }));
  const dayBuckets = Array.from({
    length: 7
  }, (_, dayOfWeek) => ({
    dayOfWeek,
    totalLikes: 0,
    videoCount: 0
  }));
  let totalLikes = 0;
  const likeValues = [];
  const dates = [];
  workingVideos.forEach(video => {
    const likes = safeNumber(video.likes);
    totalLikes += likes;
    likeValues.push(likes);
    const parts = resolveVideoParts(video);
    if (parts) {
      const hourBucket = hourBuckets[parts.hour];
      hourBucket.totalLikes += likes;
      hourBucket.videoCount += 1;
      const dayBucket = dayBuckets[parts.weekday];
      dayBucket.totalLikes += likes;
      dayBucket.videoCount += 1;
      if (parts.date) {
        dates.push(parts.date);
      } else if (video.date) {
        dates.push(new Date(video.date));
      }
    }
  });
  const bestPostingHours = hourBuckets.filter(bucket => bucket.videoCount > 0).map(bucket => ({
    hour: bucket.hour,
    avgLikes: round(bucket.totalLikes / bucket.videoCount),
    videoCount: bucket.videoCount
  })).sort((a, b) => b.avgLikes - a.avgLikes || b.videoCount - a.videoCount);
  const postingDaysOfWeek = dayBuckets.filter(bucket => bucket.videoCount > 0).map(bucket => ({
    dayOfWeek: bucket.dayOfWeek,
    avgLikes: round(bucket.totalLikes / bucket.videoCount),
    videoCount: bucket.videoCount
  })).sort((a, b) => b.avgLikes - a.avgLikes || b.videoCount - a.videoCount);
  const topVideos = [...workingVideos].sort((a, b) => safeNumber(b.likes) - safeNumber(a.likes)).slice(0, 10);
  const sortedDates = dates.filter(d => d instanceof Date && !Number.isNaN(d.getTime())).sort((a, b) => a - b);
  return {
    bestPostingHours,
    postingDaysOfWeek,
    topVideos,
    globalStats: {
      totalVideos: safeVideos.length,
      totalLikes,
      avgLikes: safeVideos.length ? round(totalLikes / safeVideos.length) : 0,
      firstPostDate: sortedDates[0]?.toISOString(),
      lastPostDate: sortedDates[sortedDates.length - 1]?.toISOString()
    }
  };
}
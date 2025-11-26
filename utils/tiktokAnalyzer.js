const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAYPARTS = [
  { name: "night", label: "Night (00-05)", start: 0, end: 5 },
  { name: "morning", label: "Morning (06-11)", start: 6, end: 11 },
  { name: "afternoon", label: "Afternoon (12-17)", start: 12, end: 17 },
  { name: "evening", label: "Evening (18-23)", start: 18, end: 23 }
];

const STOP_WORDS = new Set([
  "und", "oder", "aber", "nicht", "kein", "keine", "der", "die", "das", "ein", "eine", "des", "den", "dem",
  "auf", "mit", "für", "von", "ist", "sind", "the", "and", "for", "you", "your", "are", "was", "were", "that",
  "this", "those", "these", "there", "hier", "dort", "zum", "zur", "ins", "im", "in", "out", "auf", "als",
  "bei", "wir", "ich", "sie", "er", "man", "auch", "noch"
]);

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDaypart(hour) {
  const part = DAYPARTS.find(({ start, end }) => hour >= start && hour <= end);
  return part ? part.name : "unknown";
}

function incrementEntry(map, key, likes = 0) {
  if (!key) return;
  const normalized = String(key).trim();
  if (!normalized) return;
  const current = map.get(normalized) || { count: 0, likes: 0 };
  current.count += 1;
  current.likes += likes;
  map.set(normalized, current);
}

function formatTopEntries(map, limit = 10) {
  return [...map.entries()]
    .map(([keyword, { count, likes }]) => ({
      keyword,
      occurrences: count,
      average_likes: count ? likes / count : 0
    }))
    .sort((a, b) => {
      if (b.average_likes === a.average_likes) {
        return b.occurrences - a.occurrences;
      }
      return b.average_likes - a.average_likes;
    })
    .slice(0, limit);
}

function tokenize(text = "") {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }
  return text
    .toLowerCase()
    .replace(/[#@]/g, " ")
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function deriveDurationSeconds(post) {
  const rawLink = post.link || post.raw?.Link || "";
  if (typeof rawLink === "string" && rawLink.includes("vl=")) {
    const match = rawLink.match(/[?&]vl=(\d+)/i);
    if (match) {
      return safeNumber(match[1], null);
    }
  }
  const rawDuration = post.raw?.VideoDuration || post.raw?.Duration || post.raw?.DurationSeconds;
  if (rawDuration !== undefined) {
    const seconds = safeNumber(rawDuration, null);
    if (seconds) {
      return seconds;
    }
  }
  return null;
}

function computeBestPostingTimes(posts) {
  const hourStats = new Map();
  const weekdayStats = new Map();
  const daypartStats = {};

  DAYPARTS.forEach(({ name, label }) => {
    daypartStats[name] = { label, posts: 0, likes: 0 };
  });

  posts.forEach((post) => {
    if (!post.timestamp) return;
    const ts = new Date(post.timestamp);
    if (Number.isNaN(ts.getTime())) return;
    const likes = safeNumber(post.likes);
    const hour = ts.getHours();
    const weekday = ts.getDay();
    const daypart = getDaypart(hour);

    const hourEntry = hourStats.get(hour) || { likes: 0, count: 0 };
    hourEntry.likes += likes;
    hourEntry.count += 1;
    hourStats.set(hour, hourEntry);

    const weekdayEntry = weekdayStats.get(weekday) || { likes: 0, count: 0 };
    weekdayEntry.likes += likes;
    weekdayEntry.count += 1;
    weekdayStats.set(weekday, weekdayEntry);

    if (daypartStats[daypart]) {
      daypartStats[daypart].likes += likes;
      daypartStats[daypart].posts += 1;
    }
  });

  const top_hours = [...hourStats.entries()]
    .map(([hour, data]) => ({
      hour,
      average_likes: data.count ? data.likes / data.count : 0,
      posts: data.count
    }))
    .sort((a, b) => (b.average_likes === a.average_likes ? b.posts - a.posts : b.average_likes - a.average_likes))
    .slice(0, 5);

  const top_weekdays = [...weekdayStats.entries()]
    .map(([weekday, data]) => ({
      weekday: WEEKDAYS[weekday],
      average_likes: data.count ? data.likes / data.count : 0,
      posts: data.count
    }))
    .sort((a, b) => (b.average_likes === a.average_likes ? b.posts - a.posts : b.average_likes - a.average_likes))
    .slice(0, 5);

  const dayparts = Object.fromEntries(
    Object.entries(daypartStats).map(([name, data]) => [
      name,
      {
        label: data.label,
        posts: data.posts,
        average_likes: data.posts ? data.likes / data.posts : 0
      }
    ])
  );

  return { top_hours, top_weekdays, dayparts };
}

function computeViralVideos(posts) {
  if (!posts.length) return [];
  const now = Date.now();
  const withMetrics = posts.map((post) => {
    const ts = post.timestamp ? new Date(post.timestamp).getTime() : null;
    const daysSinceUpload = ts ? Math.max(1, (now - ts) / 86_400_000) : 1;
    const likes = safeNumber(post.likes);
    const engagementScore = likes / daysSinceUpload;
    return { ...post, engagementScore };
  });

  const averageLikes = withMetrics.reduce((sum, post) => sum + safeNumber(post.likes), 0) / withMetrics.length || 0;

  const formatVideo = (post) => ({
    caption: post.caption,
    likes: safeNumber(post.likes),
    views: safeNumber(post.views),
    comments: safeNumber(post.comments),
    link: post.link,
    timestamp: post.timestamp,
    hashtags: post.hashtags,
    sound: post.raw?.Sound || null,
    location: post.raw?.Location || null
  });

  const topByLikes = withMetrics
    .filter((post) => post.link)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)
    .map((post) => ({ type: "top_likes", ...formatVideo(post) }));

  const topByEngagement = withMetrics
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5)
    .map((post) => ({
      type: "top_engagement",
      engagement_score: Number(post.engagementScore.toFixed(2)),
      ...formatVideo(post)
    }));

  const outperformers = withMetrics
    .filter((post) => post.likes >= averageLikes * 1.4)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)
    .map((post) => ({
      type: "outperformer",
      improvement: averageLikes ? Number(((post.likes / averageLikes) - 1).toFixed(2)) : 0,
      ...formatVideo(post)
    }));

  return [...topByLikes, ...topByEngagement, ...outperformers];
}

function buildTopPatterns(posts, bestPostingTimes) {
  const keywordMap = new Map();
  const hashtagMap = new Map();
  const soundMap = new Map();
  const locationMap = new Map();
  const privacyMap = new Map();
  let commentsAllowed = 0;

  const durationStats = {
    totalSeconds: 0,
    count: 0,
    buckets: { short: 0, medium: 0, long: 0 }
  };

  posts.forEach((post) => {
    const likes = safeNumber(post.likes);
    const raw = post.raw || {};

    const tokens = [
      ...tokenize(post.caption),
      ...tokenize(raw.Title),
      ...tokenize(raw.AlternateText)
    ];
    tokens.forEach((token) => incrementEntry(keywordMap, token, likes));

    (post.hashtags || []).forEach((tag) => incrementEntry(hashtagMap, tag, likes));
    if (raw.Sound) incrementEntry(soundMap, raw.Sound, likes);
    if (raw.Location) incrementEntry(locationMap, raw.Location, likes);
    if (raw.WhoCanView) incrementEntry(privacyMap, raw.WhoCanView);
    if (typeof raw.AllowComments === "string" && raw.AllowComments.toLowerCase() === "yes") {
      commentsAllowed += 1;
    }

    const durationSeconds = deriveDurationSeconds(post);
    if (durationSeconds) {
      durationStats.totalSeconds += durationSeconds;
      durationStats.count += 1;
      if (durationSeconds <= 30) durationStats.buckets.short += 1;
      else if (durationSeconds <= 60) durationStats.buckets.medium += 1;
      else durationStats.buckets.long += 1;
    }
  });

  const averageSeconds = durationStats.count ? durationStats.totalSeconds / durationStats.count : null;

  return {
    keywords: formatTopEntries(keywordMap, 15),
    hashtags: formatTopEntries(hashtagMap, 15),
    sounds: formatTopEntries(soundMap, 10),
    locations: formatTopEntries(locationMap, 10),
    dayparts: bestPostingTimes.dayparts,
    privacy: formatTopEntries(privacyMap, 10),
    comments_allowed_ratio: posts.length ? commentsAllowed / posts.length : null,
    video_length: {
      average_seconds: averageSeconds ? Number(averageSeconds.toFixed(2)) : null,
      distribution: durationStats.buckets,
      sample_size: durationStats.count
    }
  };
}

function buildCreatorDna(bestPostingTimes, topPatterns) {
  const recurringThemes = topPatterns.keywords.slice(0, 5).map((entry) => entry.keyword);
  const bestDayparts = Object.entries(bestPostingTimes.dayparts || {})
    .map(([name, data]) => ({ name, ...data }))
    .filter((part) => part.posts > 0)
    .sort((a, b) => b.average_likes - a.average_likes);

  const topDayparts = bestDayparts.slice(0, 2).map((part) => part.label);
  const bottomDaypart = bestDayparts.slice(-1)[0];

  const bestHashtags = topPatterns.hashtags.slice(0, 5).map((entry) => entry.keyword);

  const positive_patterns = [];
  const negative_patterns = [];

  if (bestPostingTimes.top_weekdays && bestPostingTimes.top_weekdays[0]) {
    const weekday = bestPostingTimes.top_weekdays[0];
    positive_patterns.push(
      `Höchstes Engagement am ${weekday.weekday} (Ø ${Math.round(weekday.average_likes)} Likes).`
    );
  }

  if (topDayparts.length) {
    positive_patterns.push(`Stärkste Dayparts: ${topDayparts.join(", ")}.`);
  }

  if (bestHashtags.length) {
    positive_patterns.push(`Bestperformende Hashtags: ${bestHashtags.join(", ")}.`);
  }

  if (bottomDaypart && bestDayparts.length > 1) {
    const topAverage = bestDayparts[0].average_likes || 0;
    if (topAverage && bottomDaypart.average_likes < topAverage * 0.7) {
      negative_patterns.push(
        `${bottomDaypart.label} performt schwächer (Ø ${Math.round(bottomDaypart.average_likes)} Likes).`
      );
    }
  }

  if (topPatterns.comments_allowed_ratio !== null && topPatterns.comments_allowed_ratio < 0.5) {
    negative_patterns.push("Weniger als 50% der Videos erlauben Kommentare – Interaktion leidet.");
  }

  return {
    recurring_themes: recurringThemes,
    best_dayparts: topDayparts,
    best_hashtags: bestHashtags,
    positive_patterns,
    negative_patterns,
    opportunities: {
      sounds: topPatterns.sounds.slice(0, 3).map((entry) => entry.keyword),
      locations: topPatterns.locations.slice(0, 3).map((entry) => entry.keyword)
    }
  };
}

export default function analyzeTikTokPosts(posts = [], stats = {}) {
  const safePosts = Array.isArray(posts) ? posts : [];
  const bestPostingTimes = computeBestPostingTimes(safePosts);
  const topPatterns = buildTopPatterns(safePosts, bestPostingTimes);
  const viralVideos = computeViralVideos(safePosts);
  const creatorDna = buildCreatorDna(bestPostingTimes, topPatterns);

  return {
    best_posting_times: bestPostingTimes,
    viral_videos: viralVideos,
    top_patterns: topPatterns,
    creator_dna: creatorDna,
    ignored_links_count: stats.ignoredLinks || 0,
    processed_links_count: stats.processedLinks || 0
  };
}


"use strict";

const WEEKDAY_LABELS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const HOUR_WINDOW_MS = 60 * 60 * 1000;
function getDateParts(item) {
  if (!item) return null;
  let timestamp = null;
  if (typeof item.timestamp === "number" && Number.isFinite(item.timestamp)) {
    timestamp = item.timestamp;
  } else if (item.date) {
    const parsed = new Date(item.date);
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed.getTime();
    }
  }
  if (timestamp === null) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    hour: date.getHours(),
    weekday: date.getDay()
  };
}
function aggregateHours(items) {
  const buckets = new Map();
  items.forEach(item => {
    const parts = getDateParts(item);
    if (!parts) return;
    const key = parts.hour;
    if (!buckets.has(key)) {
      buckets.set(key, {
        hour: key,
        likes: 0,
        comments: 0,
        count: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.likes += Number(item.likes) || 0;
    bucket.comments += Number(item.comments) || 0;
    bucket.count += 1;
  });
  return [...buckets.values()].map(bucket => ({
    hour: bucket.hour,
    avgLikes: bucket.count ? bucket.likes / bucket.count : 0,
    avgComments: bucket.count ? bucket.comments / bucket.count : 0,
    posts: bucket.count
  })).sort((a, b) => b.avgLikes - a.avgLikes || b.posts - a.posts).slice(0, 5);
}
function aggregateWeekdays(items) {
  const buckets = new Map();
  items.forEach(item => {
    const parts = getDateParts(item);
    if (!parts) return;
    const key = parts.weekday;
    if (!buckets.has(key)) {
      buckets.set(key, {
        weekday: key,
        likes: 0,
        comments: 0,
        count: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.likes += Number(item.likes) || 0;
    bucket.comments += Number(item.comments) || 0;
    bucket.count += 1;
  });
  return [...buckets.values()].map(bucket => ({
    weekday: WEEKDAY_LABELS[bucket.weekday] || `Tag ${bucket.weekday}`,
    avgLikes: bucket.count ? bucket.likes / bucket.count : 0,
    avgComments: bucket.count ? bucket.comments / bucket.count : 0,
    posts: bucket.count
  })).sort((a, b) => b.avgLikes - a.avgLikes || b.posts - a.posts).slice(0, 5);
}
function aggregateHashtags(items) {
  const map = new Map();
  items.forEach(item => {
    const hashtags = item.hashtags || item.meta?.hashtags || [];
    hashtags.forEach(tag => {
      if (!tag) return;
      const normalized = tag.toLowerCase();
      if (!map.has(normalized)) {
        map.set(normalized, {
          tag: normalized,
          likes: 0,
          comments: 0,
          count: 0
        });
      }
      const bucket = map.get(normalized);
      bucket.likes += Number(item.likes) || 0;
      bucket.comments += Number(item.comments) || 0;
      bucket.count += 1;
    });
  });
  return [...map.values()].map(bucket => ({
    hashtag: bucket.tag,
    avgLikes: bucket.count ? bucket.likes / bucket.count : 0,
    avgComments: bucket.count ? bucket.comments / bucket.count : 0,
    uses: bucket.count
  })).sort((a, b) => b.avgLikes - a.avgLikes || b.uses - a.uses).slice(0, 20);
}
function computeAverages(items) {
  if (!items.length) {
    return {
      avgLikes: 0,
      avgComments: 0
    };
  }
  const totals = items.reduce((acc, item) => {
    acc.likes += Number(item.likes) || 0;
    acc.comments += Number(item.comments) || 0;
    return acc;
  }, {
    likes: 0,
    comments: 0
  });
  return {
    avgLikes: totals.likes / items.length,
    avgComments: totals.comments / items.length
  };
}
function analyzePlatform(items = []) {
  return {
    itemCount: items.length,
    bestPostingHours: aggregateHours(items),
    bestWeekdays: aggregateWeekdays(items),
    topHashtags: aggregateHashtags(items),
    ...computeAverages(items)
  };
}
function buildFollowerTimeline(followers = []) {
  const buckets = new Map();
  followers.forEach((entry) => {
    const date = new Date(entry.timestamp || entry.date);
    if (!date || Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
function findClosestPost(timestamp, posts = []) {
  let closest = null;
  posts.forEach((post) => {
    if (typeof post.timestamp !== "number") return;
    const diff = Math.abs(post.timestamp - timestamp);
    if (diff <= HOUR_WINDOW_MS && (!closest || diff < closest.diff)) {
      closest = { post, diff };
    }
  });
  return closest?.post || null;
}
function analyzeFollowerGrowth(followers = [], posts = []) {
  if (!followers.length) {
    return null;
  }
  const timeline = buildFollowerTimeline(followers);
  const postsWithTime = posts.filter((post) => typeof post.timestamp === "number");
  const matchCounts = new Map();
  let matchedTotal = 0;
  followers.forEach((follower) => {
    const match = findClosestPost(follower.timestamp, postsWithTime);
    if (!match) return;
    matchedTotal += 1;
    const key = match.id || match.link || String(match.timestamp);
    const existing = matchCounts.get(key) || {
      postId: match.id || key,
      link: match.link || "",
      caption: match.caption || match.title || "",
      followers: 0
    };
    existing.followers += 1;
    matchCounts.set(key, existing);
  });
  const topMatch = [...matchCounts.values()].sort((a, b) => b.followers - a.followers)[0] || null;
  return {
    followersGained: followers.length,
    followerTimeline: timeline,
    matchedFollowers: matchedTotal,
    postThatGainedMostFollowers: topMatch
  };
}
function analyzeUnifiedItems(items = [], followers = []) {
  const perPlatformBuckets = {};
  items.forEach(item => {
    const platform = (item.platform || "unknown").toLowerCase();
    perPlatformBuckets[platform] = perPlatformBuckets[platform] || [];
    perPlatformBuckets[platform].push(item);
  });
  const perPlatform = {};
  Object.entries(perPlatformBuckets).forEach(([platform, bucketItems]) => {
    perPlatform[platform] = analyzePlatform(bucketItems);
  });
  const followerGrowth = analyzeFollowerGrowth(followers, items) || null;
  return {
    perPlatform,
    global: analyzePlatform(items),
    followerGrowth
  };
}

module.exports = analyzeUnifiedItems;
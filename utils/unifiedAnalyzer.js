"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = analyzeUnifiedItems;
const WEEKDAY_LABELS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
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
function analyzeUnifiedItems(items = []) {
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
  return {
    perPlatform,
    global: analyzePlatform(items)
  };
}


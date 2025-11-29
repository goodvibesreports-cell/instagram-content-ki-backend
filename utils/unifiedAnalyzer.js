"use strict";

const WEEKDAY_LABELS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
function getDateParts(item) {
  if (!item) return null;
  let timestamp = null;
  if (item.date) {
    const parsed = new Date(item.date);
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed.getTime();
    }
  } else if (typeof item.timestamp === "number" && Number.isFinite(item.timestamp)) {
    timestamp = item.timestamp;
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
    [...new Set(hashtags)].forEach(tag => {
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
function resolveChronoBounds(items = []) {
  const timestamps = items
    .map((item) => {
      if (typeof item.timestamp === "number" && Number.isFinite(item.timestamp)) {
        return item.timestamp;
      }
      if (item.date) {
        const parsed = new Date(item.date);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.getTime();
        }
      }
      return null;
    })
    .filter((value) => typeof value === "number");
  if (!timestamps.length) {
    return {
      firstPostDate: null,
      lastPostDate: null
    };
  }
  const first = new Date(Math.min(...timestamps));
  const last = new Date(Math.max(...timestamps));
  return {
    firstPostDate: first.toISOString(),
    lastPostDate: last.toISOString()
  };
}
function analyzePlatform(items = []) {
  return {
    itemCount: items.length,
    bestPostingHours: aggregateHours(items),
    bestWeekdays: aggregateWeekdays(items),
    topHashtags: aggregateHashtags(items),
    ...computeAverages(items),
    ...resolveChronoBounds(items)
  };
}

function coerceTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function normalizeFollowerEvents(followers = []) {
  return followers
    .map((entry) => {
      const timestamp = coerceTimestamp(entry.timestamp || entry.date);
      if (!timestamp) return null;
      return {
        username: entry.username || "Follower",
        date: new Date(timestamp).toISOString(),
        timestamp
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildFollowerTimeline(followerEvents = []) {
  const buckets = new Map();
  followerEvents.forEach((event) => {
    const key = event.date.slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function analyzeFollowerImpact(posts = [], followers = []) {
  if (!followers.length) {
    return null;
  }
  const followerEvents = normalizeFollowerEvents(followers);
  if (!followerEvents.length) {
    return null;
  }
  const timeline = buildFollowerTimeline(followerEvents);
  const sortedPosts = posts
    .map((post) => {
      const timestamp = coerceTimestamp(post.timestamp || post.date);
      if (!timestamp) return null;
      return {
        id: post.id || post.link || String(timestamp),
        link: post.link || "",
        caption: post.caption || post.title || "",
        timestamp
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!sortedPosts.length) {
    return {
      totalFollowers: followerEvents.length,
      followerTimeline: timeline,
      postGains: [],
      topPost: null
    };
  }
  const gainsMap = new Map();
  let pointer = 0;
  followerEvents.forEach((event) => {
    if (event.timestamp < sortedPosts[0].timestamp) {
      return;
    }
    while (pointer < sortedPosts.length - 1 && event.timestamp >= sortedPosts[pointer + 1].timestamp) {
      pointer += 1;
    }
    const currentPost = sortedPosts[pointer];
    if (!currentPost || event.timestamp < currentPost.timestamp) {
      return;
    }
    const key = currentPost.id;
    const bucket = gainsMap.get(key) || {
      postId: currentPost.id,
      link: currentPost.link,
      caption: currentPost.caption,
      followersGained: 0
    };
    bucket.followersGained += 1;
    gainsMap.set(key, bucket);
  });
  const postGains = [...gainsMap.values()].sort((a, b) => b.followersGained - a.followersGained || a.postId.localeCompare(b.postId));
  return {
    totalFollowers: followerEvents.length,
    followerTimeline: timeline,
    postGains,
    topPost: postGains[0] || null
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
  const followerStats = analyzeFollowerImpact(items, followers);
  return {
    perPlatform,
    global: analyzePlatform(items),
    follower: followerStats
  };
}

module.exports = analyzeUnifiedItems;
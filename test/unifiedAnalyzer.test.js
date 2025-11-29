const { test } = require("node:test");
const assert = require("node:assert/strict");
const unifiedAnalyzer = require("../utils/unifiedAnalyzer.js");
const analyzeUnifiedItems = unifiedAnalyzer.default || unifiedAnalyzer;
const { createNormalizedPost } = require("../utils/normalizedPost.js");

function makeItem(overrides = {}) {
  return createNormalizedPost({
    platform: overrides.platform || "tiktok",
    date: overrides.date || "2025-01-01T10:00:00Z",
    likes: overrides.likes ?? 10,
    comments: overrides.comments ?? 1,
    caption: overrides.caption || "",
    hashtags: overrides.hashtags || [],
    meta: overrides.meta || {}
  });
}

test("analyzeUnifiedItems liefert globale und plattformspezifische KPIs", () => {
  const items = [
    makeItem({ platform: "tiktok", likes: 100, date: "2025-01-01T10:00:00Z", hashtags: ["creator"] }),
    makeItem({ platform: "tiktok", likes: 80, date: "2025-01-01T12:00:00Z", hashtags: ["creator"] }),
    makeItem({ platform: "instagram", likes: 120, date: "2025-01-03T08:00:00Z", hashtags: ["meta"] })
  ];
  const result = analyzeUnifiedItems(items);
  assert.ok(result.global);
  assert.ok(result.perPlatform.tiktok);
  assert.equal(result.perPlatform.tiktok.itemCount, 2);
  assert.equal(result.global.itemCount, 3);
  assert.equal(result.perPlatform.tiktok.topHashtags[0].hashtag, "creator");
});

test("analyzeUnifiedItems aggregiert Follower-Daten", () => {
  const items = [
    makeItem({ platform: "tiktok", date: "2025-02-01T10:00:00Z", caption: "Post A" }),
    makeItem({ platform: "tiktok", date: "2025-02-02T10:00:00Z", caption: "Post B" })
  ];
  const followers = [
    { date: "2025-02-01T11:00:00Z" },
    { date: "2025-02-01T12:00:00Z" },
    { date: "2025-02-02T11:30:00Z" }
  ];
  const result = analyzeUnifiedItems(items, followers);
  assert.ok(result.follower);
  assert.equal(result.follower.totalFollowers, 3);
  assert.ok(result.follower.followerTimeline.length >= 2);
  assert.ok(result.follower.postGains.length >= 1);
  assert.equal(result.follower.postGains[0].followersGained, 2);
});



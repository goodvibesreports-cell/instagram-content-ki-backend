const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectPlatform: detectPlatformAndType, PLATFORM_DATA_TYPES } = require("../utils/platformDetector.js");

test("identifies TikTok posts export via Post.Posts.VideoList", () => {
  const payload = {
    Post: {
      Posts: {
        VideoList: [{ Link: "https://video-no1a.tiktokv.eu/storage/v1/video.mp4" }]
      }
    },
    Profile: {}
  };

  const result = detectPlatformAndType(payload, "posts.json");
  assert.equal(result.platform, "tiktok");
  assert.equal(result.dataType, PLATFORM_DATA_TYPES.POSTS);
  assert.ok(result.confidence >= 0.9);
});

test("recognizes watch history with share links", () => {
  const payload = {
    "Your Activity": {
      "Watch History": {
        VideoList: [{ Link: "https://www.tiktokv.com/share/video/123" }]
      }
    }
  };

  const result = detectPlatformAndType(payload, "history.json");
  assert.equal(result.platform, "tiktok");
  assert.equal(result.dataType, PLATFORM_DATA_TYPES.WATCH_HISTORY);
});

test("falls back to unknown for other exports", () => {
  const payload = { random: { data: true } };
  const result = detectPlatformAndType(payload, "unknown.json");
  assert.equal(result.platform, "unknown");
  assert.equal(result.dataType, PLATFORM_DATA_TYPES.UNKNOWN);
  assert.ok(result.warnings.length >= 1);
});


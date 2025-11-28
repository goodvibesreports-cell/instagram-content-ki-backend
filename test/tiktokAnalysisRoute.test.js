const { test } = require("node:test");
const assert = require("node:assert/strict");

const uploadRouter = require("../routes/upload.js");
const { buildTikTokAnalysisResult } = uploadRouter.__helpers;

function createVideo(index) {
  return {
    platform: "tiktok",
    date: new Date(2024, 0, 1, index % 24).toISOString(),
    link: `https://www.tiktok.com/@creator/video/${index}`,
    likes: index,
    comments: Math.floor(index / 2),
    views: index * 10,
    caption: `Video ${index}`
  };
}

test("buildTikTokAnalysisResult returns fallback when no posts", () => {
  const result = buildTikTokAnalysisResult([]);
  assert.equal(result.count, 0);
  assert.equal(result.analysis, null);
  assert.equal(result.posts.length, 0);
  assert.equal(result.message, "Kein analysierbares TikTok-Material gefunden");
});

test("buildTikTokAnalysisResult limits very large datasets", () => {
  const hugeList = Array.from({ length: 20000 }, (_, idx) => createVideo(idx + 1));
  const result = buildTikTokAnalysisResult(hugeList);
  assert.equal(result.count, hugeList.length);
  assert.ok(result.analysis);
  assert.ok(result.posts.length <= 50);
  assert.ok(result.posts.length > 0);
  assert.equal(result.message, "Analyse erfolgreich");
});


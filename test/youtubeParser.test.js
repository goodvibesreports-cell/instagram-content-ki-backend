const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseYouTubeExport } = require("../utils/parsers/youtubeParser.js");

const SAMPLE_JSON = {
  items: [
    {
      id: "video123",
      snippet: {
        title: "CreatorOS Walkthrough",
        description: "Ein tiefer Blick in #CreatorOS",
        publishedAt: "2025-01-05T12:00:00Z",
        resourceId: { videoId: "video123" }
      },
      statistics: {
        viewCount: "1200",
        likeCount: "42",
        commentCount: "5"
      }
    }
  ]
};

test("parseYouTubeExport normalisiert Videos", () => {
  const items = parseYouTubeExport(SAMPLE_JSON);
  assert.ok(items.length >= 1);
  const [item] = items;
  assert.equal(item.platform, "youtube");
  assert.equal(item.likes, 42);
  assert.ok(item.meta.hashtags.includes("creatoros"));
});



const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseTikTokExport, extractVideoLinksFromAnyObject } = require("../utils/tiktokParser.js");

function buildSampleExport() {
  return {
    TikTok: {
      "Your Public Activity": {
        Videos: {
          VideoList: [
            {
              Date: "2025-01-15 10:00:00",
              Link: "https://www.tiktok.com/@creator/video/111",
              Likes: "120",
              Title: "#FirstPost",
              Sound: "Trend Sound"
            },
            {
              Date: "2025-01-16 11:30:00",
              Link: "https://www.tiktok.com/@creator/video/222",
              Likes: "80",
              Title: "Second Post"
            }
          ]
        }
      },
      "Your Activity": {
        Follower: {
          FansList: [
            { Date: "2025-01-15 12:00:00", UserName: "fan_a" },
            { Date: "2025-01-16 14:00:00", UserName: "fan_b" }
          ]
        },
        Hashtag: {
          HashtagList: [{ HashtagName: "CreatorOS" }, { HashtagName: "Viral" }]
        },
        "Like List": {
          ItemFavoriteList: [{ Date: "2025-01-10 09:00:00", Link: "https://www.tiktok.com/@creator/video/999" }]
        }
      },
      "Watch History": {
        VideoList: [{ Date: "2025-01-14 08:00:00", Link: "https://www.tiktok.com/@watch/video/555" }]
      }
    }
  };
}

test("parseTikTokExport extrahiert Posts aus 'Your Public Activity'", () => {
  const json = buildSampleExport();
  const result = parseTikTokExport(json, "sample.json");
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[0].platform, "tiktok");
  assert.equal(result.posts[0].likes, 120);
  assert.ok(result.posts[0].hashtags.includes("firstpost"));
  assert.equal(result.followers.length, 2);
  assert.equal(result.hashtags.length, 2);
});

test("parseTikTokExport führt ignorierte Bereiche auf", () => {
  const json = buildSampleExport();
  const result = parseTikTokExport(json, "ignored.json");
  const watchEntry = result.ignoredEntries.find((entry) => entry.section === "Watch History");
  const likeEntry = result.ignoredEntries.find((entry) => entry.section === "Like List");
  assert.ok(watchEntry);
  assert.equal(watchEntry.reason, "ignored");
  assert.equal(watchEntry.count, 1);
  assert.ok(likeEntry);
});

test("extractVideoLinksFromAnyObject findet fallback-Listen", () => {
  const json = {
    misc: {
      nested: [
        { Link: "https://www.tiktok.com/@fallback/video/999", Date: "2025-03-01 08:00:00" },
        { foo: "bar" }
      ]
    }
  };
  const entries = extractVideoLinksFromAnyObject(json);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceSection, "misc.nested");
});

test("liefert leere Arrays für ungültige Payloads", () => {
  const result = parseTikTokExport(null);
  assert.equal(result.posts.length, 0);
  assert.equal(result.followers.length, 0);
  assert.deepEqual(result.ignoredEntries, []);
});


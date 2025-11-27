import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTikTokExport, extractVideoLinksFromAnyObject } from "../utils/tiktokParser.js";

test("detects multiple video sections and normalizes entries", () => {
  const json = {
    Activity: {
      Videos: {
        VideoList: [
          {
            Date: "2025-01-15 10:00:00",
            Link: "https://www.tiktok.com/@creator/video/111",
            Likes: "120",
            Title: "First Post"
          }
        ]
      },
      "Favorite Videos": {
        VideoList: [
          {
            Date: "2025-01-16 11:00:00",
            Link: "https://www.tiktok.com/@creator/video/222",
            Likes: "80",
            Text: "Favorite"
          }
        ]
      },
      "Like List": {
        ItemFavoriteList: [
          {
            Date: "2025-01-17 12:00:00",
            Link: "https://www.tiktok.com/@creator/video/333",
            Likes: "55",
            Caption: "Liked"
          }
        ]
      }
    },
    Videos: {
      VideoList: [
        {
          Date: "2025-01-18 13:00:00",
          Link: "https://www.tiktok.com/@creator/video/444"
        }
      ],
      "Recently Deleted Videos": {
        VideoList: [
          {
            Date: "2025-01-19 14:00:00",
            Link: "https://www.tiktok.com/@creator/video/555"
          }
        ]
      }
    },
    Deleted: {
      Videos: {
        VideoList: [
          {
            Date: "2025-01-20 15:00:00",
            Link: "https://www.tiktok.com/@creator/video/666"
          }
        ]
      }
    }
  };

  const result = parseTikTokExport(json, "full.json");
  assert.equal(result.videos.length, 6);
  assert.equal(result.rawPlatform, "tiktok");
  assert.equal(result.totals.videos, 6);
  assert.ok(result.rawJsonSnippet.includes("Activity"));
  const deleted = result.videos.find((video) => video.link.endsWith("/555"));
  assert.equal(deleted.isDeleted, true);
  const likeListVideo = result.videos.find((video) => video.link.endsWith("/333"));
  assert.equal(likeListVideo.title, "Liked");
});

test("ignores watch history sections while counting totals", () => {
  const json = {
    "Share History": {
      ShareHistoryList: [
        { Date: "2025-02-01 09:00:00", Link: "https://www.tiktok.com/@watch/video/777" }
      ]
    },
    WatchHistory: {
      VideoList: [
        { Date: "2025-02-02 10:00:00", Link: "https://www.tiktok.com/@watch/video/888" }
      ]
    }
  };

  const result = parseTikTokExport(json, "watch.json");
  assert.equal(result.videos.length, 0);
  const watchReason = result.ignoredEntries.find((entry) => entry.reason === "watch_history");
  assert.ok(watchReason);
  assert.equal(watchReason.count, 2);
  assert.equal(result.totals.watchHistory, 2);
});

test("extractVideoLinksFromAnyObject finds nested arrays", () => {
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

  const result = parseTikTokExport(json, "fallback.json");
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].sourceSection, "misc.nested");
});

test("handles watch history plus valid sections with totals and metadata", () => {
  const json = {
    Activity: {
      Videos: {
        VideoList: [
          {
            Date: "2025-04-01 10:00:00",
            Link: "https://www.tiktok.com/@creator/video/abc",
            Likes: 10
          }
        ]
      },
      "Video Browsing History": {
        VideoList: [
          {
            Date: "2025-04-02 11:11:00",
            Link: "https://www.tiktok.com/@someone/video/history"
          }
        ]
      }
    }
  };

  const result = parseTikTokExport(json, "mix.json");
  assert.equal(result.videos.length, 1);
  assert.equal(result.totals.videos, 1);
  assert.equal(result.totals.watchHistory, 1);
  assert.ok(result.sourceType);
  assert.ok(result.rawJsonSnippet);
});

test("returns empty arrays but preserves structure for invalid payloads", () => {
  const result = parseTikTokExport(null);
  assert.equal(result.videos.length, 0);
  assert.equal(result.ignoredEntries.length, 0);
  assert.equal(result.rawPlatform, "tiktok");
  assert.deepEqual(result.totals, { videos: 0, ignored: 0, watchHistory: 0 });
});


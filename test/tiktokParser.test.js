import { test } from "node:test";
import assert from "node:assert/strict";
import parseTikTokJson from "../utils/tiktokParser.js";

const expect = (received) => ({
  toBe(expected) {
    assert.strictEqual(received, expected);
  }
});

test("extrahiert TikTok Links korrekt", () => {
  const json = {
    Videos: {
      List: [
        { Date: "2025-11-22 00:15:48", Link: "https://video-no1a.tiktokv.eu/storage/v1/video-123.mp4" },
        { Date: "2025-11-23 12:30:00", Link: "https://video-no1a.tiktokv.eu/storage/v1/video-987.mp4" }
      ]
    }
  };

  const result = parseTikTokJson(json);
  expect(result.links.length).toBe(2);
  expect(result.posts.length).toBe(2);
  expect(Array.isArray(result.posts[0].hashtags)).toBe(true);
});

test("erfasst Posts ohne Caption mit Metriken", () => {
  const json = [
    {
      Date: "2025-11-22 00:15:48",
      Link: "https://video-no1a.tiktokv.eu/storage/v1/tos-no1a-video.mp4",
      Likes: "52"
    }
  ];

  const result = parseTikTokJson(json);
  expect(result.posts.length).toBe(1);
  expect(result.posts[0].likes).toBe(52);
  expect(result.posts[0].caption.length > 0).toBe(true);
});

test("ignoriert Login Redirect Links", () => {
  const json = [
    "https://www.tiktok.com/login/?redirect_url=https%3A%2F%2Fwww.tiktok.com%2F@user%2Fvideo%2F123",
    {
      Date: "2025-02-02 08:00:00",
      Link: "https://video-no1a.tiktokv.eu/storage/v1/tos-no1a-valid.mp4"
    }
  ];

  const result = parseTikTokJson(json);
  expect(result.links.length).toBe(1);
  expect(result.links[0]).toBe("https://video-no1a.tiktokv.eu/storage/v1/tos-no1a-valid.mp4");
});

test("ignoriert Watch-History Share Links", () => {
  const json = [
    {
      Date: "2025-01-01 10:00:00",
      Link: "https://www.tiktokv.com/share/video/999/"
    },
    {
      Date: "2025-01-02 11:00:00",
      Link: "https://video-no1a.tiktokv.eu/storage/v1/tos-no1a/example-video.mp4",
      Likes: "100"
    }
  ];

  const result = parseTikTokJson(json);
  expect(result.stats.ignoredLinks).toBe(1);
  expect(result.posts.length).toBe(1);
  expect(result.links.length).toBe(1);
  expect(result.links[0]).toBe("https://video-no1a.tiktokv.eu/storage/v1/tos-no1a/example-video.mp4");
});


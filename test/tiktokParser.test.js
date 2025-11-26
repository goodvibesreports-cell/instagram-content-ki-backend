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
    WatchHistory: {
      List: [
        { Link: "https://www.tiktokv.com/share/video/123/" },
        { Link: "https://www.tiktok.com/@user/video/987" }
      ]
    }
  };

  const links = parseTikTokJson(json);
  expect(links.length).toBe(2);
});


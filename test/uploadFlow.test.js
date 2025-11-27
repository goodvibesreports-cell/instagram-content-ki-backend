import { test } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { processSingleFileUpload, processFolderUpload } from "../utils/universalUploader.js";

function createTikTokJson(count = 1, offset = 0, options = {}) {
  const list = Array.from({ length: count }, (_, index) => {
    const id = index + 1 + offset;
    const day = String(((index % 28) + 1)).padStart(2, "0");
    const hour = String(index % 24).padStart(2, "0");
    return {
      Date: `2025-01-${day} ${hour}:00:00`,
      Link: `https://www.tiktok.com/@creator/video/${id}`,
      Likes: `${id * 10}`,
      Title: options.titlePrefix ? `${options.titlePrefix} ${id}` : `Video ${id}`,
      Sound: options.sound || "Ready - Test Sound"
    };
  });
  return {
    Post: {
      Posts: {
        VideoList: list
      }
    }
  };
}

function makeBufferFromJson(json, fileName = "data.json") {
  const buffer = Buffer.from(JSON.stringify(json));
  return {
    buffer,
    originalname: fileName,
    mimetype: "application/json",
    size: buffer.length
  };
}

function makeZipBuffer(files = []) {
  const zip = new AdmZip();
  files.forEach(({ name, json }) => {
    zip.addFile(name, Buffer.from(JSON.stringify(json)));
  });
  const buffer = zip.toBuffer();
  return {
    buffer,
    originalname: "archive.zip",
    mimetype: "application/zip",
    size: buffer.length
  };
}

test("processSingleFileUpload parses TikTok JSON with 50 posts", () => {
  const file = makeBufferFromJson(createTikTokJson(50), "posts.json");
  const aggregate = processSingleFileUpload(file, { platformHint: "tiktok" });
  assert.equal(aggregate.videos.length, 50);
  assert.equal(aggregate.normalizedPosts.length, 50);
  assert.equal(aggregate.summary.processedFiles, 1);
});

test("invalid JSON is reported via ignoredFiles summary", () => {
  const file = {
    buffer: Buffer.from("{invalid"),
    originalname: "broken.json",
    mimetype: "application/json",
    size: 9
  };
  const aggregate = processSingleFileUpload(file, { platformHint: "tiktok" });
  assert.equal(aggregate.summary.processedFiles, 0);
  assert.ok(aggregate.summary.ignoredFiles >= 1);
  assert.equal(aggregate.normalizedPosts.length, 0);
});

test("empty file surfaces as ignored entry", () => {
  const file = {
    buffer: Buffer.alloc(0),
    originalname: "empty.json",
    mimetype: "application/json",
    size: 0
  };
  const aggregate = processSingleFileUpload(file, { platformHint: "tiktok" });
  assert.equal(aggregate.summary.processedFiles, 0);
  assert.ok(aggregate.summary.ignoredFiles >= 1);
});

test("ZIP archive with multiple JSON files aggregates all posts", () => {
  const zipFile = makeZipBuffer([
    { name: "one.json", json: createTikTokJson(3, 0) },
    { name: "two.json", json: createTikTokJson(2, 100) }
  ]);
  const aggregate = processSingleFileUpload(zipFile, { platformHint: "tiktok" });
  assert.equal(aggregate.videos.length, 5);
  assert.equal(aggregate.normalizedPosts.length, 5);
  assert.equal(aggregate.summary.processedFiles, 2);
});

test("Watch history JSON returns zero posts but tracks watch count", () => {
  const json = {
    WatchHistory: {
      VideoList: [
        { Date: "2025-03-01 10:00:00", Link: "https://www.tiktok.com/@watch/video/1" },
        { Date: "2025-03-02 11:00:00", Link: "https://www.tiktok.com/@watch/video/2" }
      ]
    }
  };
  const file = makeBufferFromJson(json, "watch.json");
  const aggregate = processSingleFileUpload(file, { platformHint: "tiktok" });
  assert.equal(aggregate.videos.length, 0);
  assert.equal(aggregate.totals.watchHistory, 2);
});

test("Multi-platform ZIP ignores non-TikTok JSON files", () => {
  const zipFile = makeZipBuffer([
    { name: "tiktok.json", json: createTikTokJson(2) },
    {
      name: "instagram.json",
      json: { media: [{ permalink: "https://instagram.com/p/test", like_count: 10 }] }
    }
  ]);
  const aggregate = processSingleFileUpload(zipFile, { platformHint: "tiktok" });
  assert.equal(aggregate.videos.length, 2);
  assert.equal(aggregate.summary.processedFiles, 2);
  assert.equal(aggregate.normalizedPosts.length, 2);
});

test("processFolderUpload aggregates multiple files and ZIP entries", () => {
  const files = [
    makeBufferFromJson(createTikTokJson(4)),
    makeZipBuffer([{ name: "extra.json", json: createTikTokJson(1, 200) }])
  ];
  const aggregate = processFolderUpload(files, { platformHint: "tiktok" });
  assert.equal(aggregate.videos.length, 5);
  assert.equal(aggregate.summary.processedFiles, 2);
  assert.equal(aggregate.normalizedPosts.length, 5);
});


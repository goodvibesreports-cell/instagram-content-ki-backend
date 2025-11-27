import { test } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { processUploadBuffer } from "../utils/multiPlatformEngine.js";

function bufferFromJson(json, name = "data.json") {
  const buffer = Buffer.from(JSON.stringify(json, null, 2));
  return {
    buffer,
    originalname: name,
    mimetype: "application/json",
    size: buffer.length
  };
}

function bufferFromText(text, name = "content.html") {
  const buffer = Buffer.from(text, "utf8");
  return {
    buffer,
    originalname: name,
    mimetype: "text/html",
    size: buffer.length
  };
}

function bufferFromZip(entries, name = "bundle.zip") {
  const zip = new AdmZip();
  entries.forEach(({ fileName, content }) => zip.addFile(fileName, content));
  const buffer = zip.toBuffer();
  return {
    buffer,
    originalname: name,
    mimetype: "application/zip",
    size: buffer.length
  };
}

function createTikTokJson(count = 1) {
  return {
    Post: {
      Posts: {
        VideoList: Array.from({ length: count }, (_, index) => {
          const id = index + 1;
          return {
            Date: `2025-01-${String(((index % 28) + 1)).padStart(2, "0")} ${String(index % 24).padStart(2, "0")}:00:00`,
            Link: `https://www.tiktok.com/@creator/video/${id}`,
            Likes: `${id * 10}`,
            Caption: `Video ${id}`
          };
        })
      }
    }
  };
}

const INSTAGRAM_HTML = `
<div class="post">
  <a href="https://www.instagram.com/p/INST1/">Post</a>
  <time datetime="2025-01-03T11:00:00Z">03.01.2025</time>
  <div class="caption">Instagram Export #Creator</div>
  <div class="likes">Likes: 80</div>
</div>
`;

const FACEBOOK_HTML = `
<div class="fb-post">
  <a href="https://www.facebook.com/post/123">Permalink</a>
  <time data-utime="1736035200"></time>
  <div class="content">Facebook Status</div>
  <span class="likes">Reactions: 25</span>
</div>
`;

const YOUTUBE_JSON = {
  items: [
    {
      id: "video123",
      snippet: { title: "YouTube Clip", description: "#CreatorOS Deep Dive", publishedAt: "2025-01-05T08:00:00Z" },
      statistics: { viewCount: "500", likeCount: "20", commentCount: "3" }
    }
  ]
};

const WATCH_HISTORY_JSON = {
  WatchHistory: {
    VideoList: [{ Date: "2025-03-01 10:00:00", Link: "https://www.tiktok.com/@watch/video/1" }]
  }
};

test("processUploadBuffer extrahiert 50 TikTok Posts", () => {
  const file = bufferFromJson(createTikTokJson(50), "posts.json");
  const aggregate = processUploadBuffer([file], { platformHint: "tiktok" });
  assert.equal(aggregate.items.length, 50);
  assert.equal(aggregate.summary.processedFiles, 1);
  assert.equal(aggregate.primaryPlatform, "tiktok");
});

test("processUploadBuffer meldet fehlerhafte JSON-Datei", () => {
  const file = {
    buffer: Buffer.from("{invalid"),
    originalname: "broken.json",
    mimetype: "application/json",
    size: 9
  };
  const aggregate = processUploadBuffer([file]);
  assert.equal(aggregate.items.length, 0);
  assert.ok(aggregate.ignoredEntries.some((entry) => entry.reason === "invalid_json"));
});

test("processUploadBuffer erkennt Watch-History Uploads", () => {
  const file = bufferFromJson(WATCH_HISTORY_JSON, "history.json");
  const aggregate = processUploadBuffer([file], { platformHint: "tiktok" });
  assert.equal(aggregate.items.length, 0);
  assert.equal(aggregate.flags.hasWatchHistory, true);
});

test("processUploadBuffer ignoriert reine Medien-Dateien", () => {
  const mp4 = {
    buffer: Buffer.from("FAKE_VIDEO"),
    originalname: "clip.mp4",
    mimetype: "video/mp4",
    size: 10
  };
  const aggregate = processUploadBuffer([mp4]);
  assert.equal(aggregate.items.length, 0);
  assert.equal(aggregate.summary.ignoredMedia, 1);
});

test("processUploadBuffer verarbeitet gemischtes ZIP mit TikTok/Instagram/Facebook/YouTube", () => {
  const zipFile = bufferFromZip([
    { fileName: "posts/tiktok.json", content: Buffer.from(JSON.stringify(createTikTokJson(1))) },
    { fileName: "instagram/content.html", content: Buffer.from(INSTAGRAM_HTML) },
    { fileName: "facebook/timeline.html", content: Buffer.from(FACEBOOK_HTML) },
    { fileName: "youtube/videos.json", content: Buffer.from(JSON.stringify(YOUTUBE_JSON)) },
    { fileName: "media/video.mp4", content: Buffer.from("MP4DATA") }
  ]);
  const aggregate = processUploadBuffer([zipFile]);
  assert.ok(aggregate.items.length >= 4);
  assert.equal(aggregate.summary.ignoredMedia, 1);
  assert.ok(aggregate.perPlatform.tiktok);
  assert.ok(aggregate.perPlatform.instagram);
  assert.ok(aggregate.perPlatform.facebook);
  assert.ok(aggregate.perPlatform.youtube);
});



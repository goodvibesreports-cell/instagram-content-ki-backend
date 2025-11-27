import { test } from "node:test";
import assert from "node:assert/strict";
import analyzeTikTokData, { analyzeTikTokVideos } from "../utils/tiktokAnalyzer.js";
import { parseTikTokExport } from "../utils/tiktokParser.js";

const samplePosts = [
  {
    date: "2025-11-20T08:00:00.000Z",
    likes: 200,
    sound: "Sound Alpha",
    location: "Berlin",
    title: "Growth Hacks für mehr Reichweite",
    coverImage: null,
    link: "https://video-no1a.tiktokv.eu/storage/v1/post-1.mp4",
    source: "posted"
  },
  {
    date: "2025-11-20T08:30:00.000Z",
    likes: 150,
    sound: "Sound Alpha",
    location: "Berlin",
    title: "Growth Hacks Teil 2",
    coverImage: null,
    link: "https://video-no1a.tiktokv.eu/storage/v1/post-2.mp4",
    source: "posted"
  },
  {
    date: "2025-11-21T13:00:00.000Z",
    likes: 40,
    sound: "Sound Beta",
    location: "Hamburg",
    title: "Behind the scenes",
    coverImage: null,
    link: "https://video-no1a.tiktokv.eu/storage/v1/post-3.mp4",
    source: "posted"
  },
  {
    date: "2025-11-22T16:00:00.000Z",
    likes: 60,
    sound: "Sound Gamma",
    location: "Hamburg",
    title: "Funny outtakes",
    coverImage: null,
    link: "https://video-no1a.tiktokv.eu/storage/v1/post-4.mp4",
    source: "deleted"
  }
];

test("berechnet beste Upload-Zeiten und -Tage", () => {
  const analysis = analyzeTikTokData(samplePosts);
  const expectedHour = new Date(samplePosts[0].date).getHours();
  assert.equal(analysis.bestTimes.bestHour, expectedHour);
  assert.equal(analysis.bestDays.bestDay, "Donnerstag");
  const bestHourBucket = analysis.bestTimes.hours.find((entry) => entry.hour === expectedHour);
  assert.ok(bestHourBucket);
  assert.ok(bestHourBucket.avgLikes > 0);
});

test("berechnet Median und Durchschnitt korrekt", () => {
  const analysis = analyzeTikTokData(samplePosts);
  assert.equal(analysis.stats.totalPosts, samplePosts.length);
  assert.equal(analysis.stats.medianLikes, 105);
  assert.equal(analysis.stats.avgLikes, 112.5);
  assert.equal(analysis.stats.maxLikes, 200);
  assert.equal(analysis.stats.minLikes, 40);
});

test("Sound-Analyse gruppiert korrekt und liefert Insights", () => {
  const analysis = analyzeTikTokData(samplePosts);
  const topSound = analysis.sounds.topSounds[0];
  assert.equal(topSound.sound, "Sound Alpha");
  assert.equal(topSound.usage, 2);
  assert.ok(topSound.viralMultiplier >= 1);
  assert.equal(analysis.sounds.soundInsights[0].sound, "Sound Alpha");
});

test("Creator DNA liefert vollständige Felder", () => {
  const analysis = analyzeTikTokData(samplePosts);
  assert.ok(typeof analysis.creatorDNA.mood === "string");
  assert.ok(typeof analysis.creatorDNA.tone === "string");
  assert.ok(typeof analysis.creatorDNA.narrativeStyle === "string");
  assert.ok(Array.isArray(analysis.creatorDNA.contentPatterns));
  assert.ok(analysis.creatorDNA.contentPatterns.length >= 1);
  assert.ok(typeof analysis.creatorDNA.postingBehavior === "string");
});

test("TikTok Parser und spezifischer Analyzer liefern konsistente Ergebnisse", () => {
  const raw = {
    Post: {
      Posts: {
        VideoList: [
          {
            Date: "2025-11-20 08:00:00",
            Link: "https://video-no1a.tiktokv.eu/storage/v1/pipeline-1.mp4",
            Likes: "120",
            Sound: "Pipeline Sound",
            Title: "Creator Growth"
          },
          {
            Date: "2025-11-21 10:00:00",
            Link: "https://video-no1a.tiktokv.eu/storage/v1/pipeline-2.mp4",
            Likes: "80",
            Sound: "Pipeline Sound",
            Title: "Creator Stories"
          }
        ]
      }
    }
  };

  const parsed = parseTikTokExport(raw, "pipeline.json");
  const analysis = analyzeTikTokVideos(parsed.videos);
  assert.equal(parsed.videos.length, 2);
  assert.equal(analysis.globalStats.totalVideos, 2);
  assert.ok(analysis.topVideos.length > 0);
  assert.equal(analysis.topVideos[0].sound, "Pipeline Sound");
});


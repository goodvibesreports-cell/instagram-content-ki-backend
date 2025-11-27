const express = require("express");
const multer = require("multer");
const { clampPlatform } = require("../utils/normalizedPost.js");
const { processUploadBuffer } = require("../utils/multiPlatformEngine.js");
const analyzeUnifiedItems = require("../utils/unifiedAnalyzer.js");
const analyzeContent = require("../utils/contentAnalyzer.js");
const { analyzeTikTokVideos } = require("../utils/tiktokAnalyzer.js");
const safeTikTokParser = require("../utils/safeTikTokParser.js");
const { optionalAuth } = require("../middleware/auth.js");
const UploadDataset = require("../models/UploadDataset.js");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

const SAFE_STREAM_THRESHOLD = 8 * 1024 * 1024;
const SAFE_RESPONSE_MESSAGE = "File too large - metadata only";

function rebuildTikTokVideoFromPost(post) {
  if (!post) return null;
  return {
    platform: post.platform || "tiktok",
    externalId: post.id || post.link,
    date: post.date,
    timestamp: post.date ? new Date(post.date).getTime() : undefined,
    link: post.link,
    coverImage: post.meta?.coverImage,
    likes: post.likes,
    views: post.views,
    comments: post.comments,
    shares: post.shares,
    caption: post.caption,
    sound: post.soundOrAudio,
    location: post.location,
    isDeleted: post.isDeleted
  };
}

/**
 * POST /upload
 * Content-Type: multipart/form-data
 * Feldname: file (TikTok JSON Export)
 *
 * Response:
 * {
 *   success: true,
 *   platform: "tiktok",
 *   meta: {...},
 *   posts: [...],
 *   analysis: {...}
 * }
 */
function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sanitizeItems(items = [], fallbackPlatform = "unknown") {
  return items.map((item, index) => {
    const isoDate = toIsoDate(item.date || item.timestamp);
    return {
      id: item.id || item.link || `item-${index}`,
      platform: (item.platform || fallbackPlatform || "unknown").toLowerCase(),
      date: isoDate,
      timestamp: isoDate ? new Date(isoDate).getTime() : null,
      link: item.link || "",
      likes: Number.isFinite(item.likes) ? item.likes : Number(item.likes) || 0,
      comments: Number.isFinite(item.comments) ? item.comments : Number(item.comments) || 0,
      shares: Number.isFinite(item.shares) ? item.shares : Number(item.shares) || 0,
      views: Number.isFinite(item.views) ? item.views : Number(item.views) || 0,
      caption: item.caption || item.title || "",
      soundOrAudio: item.sound || item.soundOrAudio || "",
      location: item.location || "",
      coverImage: item.coverImage || null,
      hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
      isDeleted: Boolean(item.isDeleted),
      meta: item.meta || {}
    };
  });
}

function buildPerPlatformSummary(items = []) {
  return items.reduce((acc, item) => {
    const key = item.platform || "unknown";
    if (!acc[key]) {
      acc[key] = { count: 0, items: [] };
    }
    acc[key].count += 1;
    acc[key].items.push(item);
    return acc;
  }, {});
}

function mapRawFilesMeta(meta = []) {
  return meta.map((entry) => ({
    fileName: entry.fileName,
    fileSize: entry.size ?? entry.fileSize ?? 0,
    platform: entry.platform || "unknown",
    dataType: entry.reason || entry.dataType || "meta",
    confidence: entry.confidence ?? null
  }));
}

function respondGracefully(res, {
  message = SAFE_RESPONSE_MESSAGE,
  ignoredEntries = [],
  extras = {}
} = {}) {
  return res.status(200).json({
    success: true,
    message,
    posts: [],
    items: [],
    ignoredEntries,
    ...extras
  });
}

function isLikelyTikTokFile(fileName = "") {
  return /tiktok/i.test(fileName || "");
}

function shouldUseSafeTikTok(file, platformHint) {
  if (!file) return false;
  if (platformHint === "tiktok") return true;
  if (file.size >= SAFE_STREAM_THRESHOLD) return true;
  return isLikelyTikTokFile(file.originalname);
}

async function parseWithSafeTikTokParser(file, sourceType = "upload-single") {
  const result = await safeTikTokParser(file.buffer, {
    fileName: file.originalname || "upload.json",
    streaming: file.size >= SAFE_STREAM_THRESHOLD
  });
  const items = result.items || [];
  const ignoredEntries = result.ignoredEntries || [];
  const perPlatform = {
    tiktok: {
      count: items.length,
      items
    }
  };
  const rawFilesMeta = [
    {
      fileName: file.originalname || "upload.json",
      platform: "tiktok",
      size: file.size,
      confidence: 1,
      reason: result.summary?.message || "safe-parser",
      sourceType,
      itemsExtracted: items.length
    }
  ];
  return {
    items,
    ignoredEntries,
    rawFilesMeta,
    perPlatform,
    primaryPlatform: "tiktok",
    rawSnippet: result.rawSnippet || null,
    flags: { ...result.flags, safeParser: true },
    summary: {
      totalFiles: 1,
      processedFiles: items.length ? 1 : 0,
      ignoredFiles: items.length ? 0 : 1,
      safeParser: true
    }
  };
}

async function parseFolderWithSafeTikTok(files = []) {
  const aggregate = {
    items: [],
    ignoredEntries: [],
    rawFilesMeta: [],
    perPlatform: {
      tiktok: {
        count: 0,
        items: []
      }
    },
    primaryPlatform: "tiktok",
    summary: {
      totalFiles: files.length,
      processedFiles: 0,
      ignoredFiles: 0,
      safeParser: true
    },
    flags: {
      safeParser: true
    }
  };

  for (const file of files) {
    const parsed = await safeTikTokParser(file.buffer, {
      fileName: file.originalname || "folder.json",
      streaming: file.size >= SAFE_STREAM_THRESHOLD
    });

    const items = parsed.items || [];
    const ignored = parsed.ignoredEntries || [];
    aggregate.items.push(...items);
    aggregate.ignoredEntries.push(
      ...ignored.map((entry) => ({
        ...entry,
        fileName: file.originalname
      }))
    );
    aggregate.rawFilesMeta.push({
      fileName: file.originalname || "folder.json",
      platform: "tiktok",
      size: file.size,
      confidence: 1,
      reason: parsed.summary?.message || "safe-parser",
      sourceType: "upload-folder",
      itemsExtracted: items.length
    });
    if (items.length) {
      aggregate.summary.processedFiles += 1;
    } else {
      aggregate.summary.ignoredFiles += 1;
    }
    aggregate.perPlatform.tiktok.items.push(...items);
  }

  aggregate.perPlatform.tiktok.count = aggregate.perPlatform.tiktok.items.length;
  aggregate.flags.usedSafeParser = true;
  return aggregate;
}

async function persistDataset({ sanitizedItems, aggregate, userId, sourceInfo, analysis }) {
  const dataset = await UploadDataset.create({
    userId: userId || null,
    platform: aggregate.primaryPlatform || "unknown",
    rawPlatform: aggregate.primaryPlatform || "unknown",
    status: sanitizedItems.length ? "completed" : "failed",
    sourceFilename: sourceInfo.fileName,
    fileSize: sourceInfo.fileSize,
    sourceType: sourceInfo.sourceType,
    rawJsonSnippet: aggregate.rawSnippet,
    totals: {
      posts: sanitizedItems.length,
      links: sanitizedItems.length
    },
    posts: [],
    videos: sanitizedItems,
    rawFilesMeta: mapRawFilesMeta(aggregate.rawFilesMeta),
    ignoredEntries: aggregate.ignoredEntries || [],
    metadata: {
      analysis,
      perPlatform: buildPerPlatformSummary(sanitizedItems),
      summary: aggregate.summary,
      flags: aggregate.flags
    }
  });
  return dataset;
}

function buildSuccessResponse(datasetId, aggregate, items, perPlatform) {
  return {
    success: true,
    datasetId: datasetId || null,
    count: items.length,
    items,
    ignoredEntries: aggregate.ignoredEntries || [],
    perPlatform
  };
}

router.post("/", optionalAuth, upload.single("file"), async (req, res) => {
  console.log("[UPLOAD] Single file upload gestartet");
  try {
    if (!req.file) {
      return respondGracefully(res, {
        message: "Keine Datei hochgeladen",
        ignoredEntries: [{ reason: "no_file" }]
      });
    }
    if (!req.file.size) {
      return respondGracefully(res, {
        message: "Datei ist leer (0 Bytes)",
        ignoredEntries: [{ reason: "empty_file" }]
      });
    }

    const platformHint = clampPlatform(req.body?.platform || req.query?.platform || "unknown");
    let aggregate;
    if (shouldUseSafeTikTok(req.file, platformHint)) {
      aggregate = await parseWithSafeTikTokParser(req.file, "upload-single");
    } else {
      aggregate = processUploadBuffer([req.file], { platformHint, sourceType: "upload-single" });
    }
    const sanitizedItems = sanitizeItems(aggregate.items || [], aggregate.primaryPlatform);
    const perPlatform = buildPerPlatformSummary(sanitizedItems);
    const analysis = analyzeUnifiedItems(sanitizedItems);

    console.log(
      `[UPLOAD] Plattform erkannt: ${aggregate.primaryPlatform} – ${sanitizedItems.length} Items · Ignored: ${
        aggregate.ignoredEntries?.length || 0
      }`
    );

    const dataset = await persistDataset({
      sanitizedItems,
      aggregate,
      userId: req.user?.id || null,
      sourceInfo: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        sourceType: "upload-single"
      },
      analysis
    });

    const responsePayload = buildSuccessResponse(dataset?._id, aggregate, sanitizedItems, perPlatform);
    return res.json(responsePayload);
  } catch (error) {
    console.error("Upload/Analyze error:", error);
    return respondGracefully(res, {
      message: SAFE_RESPONSE_MESSAGE,
      ignoredEntries: [{ reason: error?.message || "unbekannter-fehler" }]
    });
  }
});

router.post("/folder", optionalAuth, upload.array("files"), async (req, res) => {
  console.log("[UPLOAD] Folder upload gestartet");
  try {
    const files = req.files || [];
    if (!files.length) {
      return respondGracefully(res, {
        message: "Keine Dateien hochgeladen",
        ignoredEntries: [{ reason: "no_files" }]
      });
    }

    const platformHint = clampPlatform(req.body?.platform || req.query?.platform || "unknown");
    let aggregate;
    const canUseSafeParser = platformHint === "tiktok" && files.every((file) => /\.json$/i.test(file.originalname || "") || (file.mimetype || "").includes("json"));
    if (canUseSafeParser) {
      aggregate = await parseFolderWithSafeTikTok(files);
    } else if (platformHint === "tiktok" && files.length === 1 && shouldUseSafeTikTok(files[0], platformHint)) {
      aggregate = await parseWithSafeTikTokParser(files[0], "upload-folder");
    } else {
      aggregate = processUploadBuffer(files, { platformHint, sourceType: "upload-folder" });
    }
    const sanitizedItems = sanitizeItems(aggregate.items || [], aggregate.primaryPlatform);
    const perPlatform = buildPerPlatformSummary(sanitizedItems);
    const analysis = analyzeUnifiedItems(sanitizedItems);
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

    console.log(
      `[UPLOAD][FOLDER] Plattform ${aggregate.primaryPlatform} – Dateien: ${files.length} – Items: ${sanitizedItems.length}`
    );

    const dataset = await persistDataset({
      sanitizedItems,
      aggregate,
      userId: req.user?.id || null,
      sourceInfo: {
        fileName: files[0]?.originalname || "folder-upload",
        fileSize: totalSize,
        sourceType: "upload-folder"
      },
      analysis
    });

    const responsePayload = buildSuccessResponse(dataset?._id, aggregate, sanitizedItems, perPlatform);
    return res.json(responsePayload);
  } catch (error) {
    console.error("Folder upload error:", error);
    return respondGracefully(res, {
      message: SAFE_RESPONSE_MESSAGE,
      ignoredEntries: [{ reason: error?.message || "ordner-fehler" }]
    });
  }
});

router.get("/datasets", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login erforderlich" });
    }

    const datasets = await UploadDataset.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("-posts");

    return res.json({
      success: true,
      datasets
    });
  } catch (error) {
    console.error("Dataset list error:", error);
    return res.status(500).json({ success: false, message: "Konnte Upload-Datasets nicht laden" });
  }
});

router.get("/datasets/:id", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login erforderlich" });
    }

    const dataset = await UploadDataset.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!dataset) {
      return res.status(404).json({ success: false, message: "Dataset nicht gefunden" });
    }

    return res.json({
      success: true,
      dataset
    });
  } catch (error) {
    console.error("Dataset detail error:", error);
    return res.status(500).json({ success: false, message: "Konnte Dataset nicht laden" });
  }
});

const SUPPORTED_ANALYSIS_PLATFORMS = ["tiktok", "instagram", "facebook"];

router.get("/analysis/unified/:datasetId", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login erforderlich" });
    }

    const dataset = await UploadDataset.findOne({
      _id: req.params.datasetId,
      userId: req.user.id
    });

    if (!dataset) {
      return res.status(404).json({ success: false, message: "Dataset nicht gefunden" });
    }

    let analysis = dataset.metadata?.analysis;
    if (!analysis) {
      analysis = analyzeUnifiedItems(dataset.videos || []);
      dataset.metadata = dataset.metadata || {};
      dataset.metadata.analysis = analysis;
      await dataset.save();
    }

    return res.json({
      success: true,
      datasetId: dataset._id,
      analysis
    });
  } catch (error) {
    console.error("Unified analysis fetch error:", error);
    return res.status(500).json({ success: false, message: "Analyse konnte nicht geladen werden" });
  }
});

router.get("/analysis/:platform", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login erforderlich" });
    }
    const platform = req.params.platform?.toLowerCase();
    if (!SUPPORTED_ANALYSIS_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: "Unbekannte Plattform" });
    }
    const datasetId = req.query.datasetId;
    if (!datasetId) {
      return res.status(400).json({ success: false, message: "datasetId wird benötigt" });
    }

    const dataset = await UploadDataset.findOne({
      _id: datasetId,
      userId: req.user.id
    });

    if (!dataset) {
      return res.json({
        success: true,
        datasetId: null,
        platform,
        analysis: null,
        videoCount: 0,
        message: "Dataset nicht gefunden"
      });
    }

    if (platform === "tiktok") {
      let videos = Array.isArray(dataset.videos) && dataset.videos.length ? dataset.videos : [];
      if (!videos.length && Array.isArray(dataset.posts) && dataset.posts.length) {
        videos = dataset.posts.map(rebuildTikTokVideoFromPost).filter(Boolean);
      }
      const safeVideos = sanitizeItems(videos, "tiktok");
      let tiktokAnalysis = dataset.metadata?.tiktokAnalysis;
      if (!tiktokAnalysis) {
        tiktokAnalysis = analyzeTikTokVideos(safeVideos);
        dataset.metadata = dataset.metadata || {};
        dataset.metadata.tiktokAnalysis = tiktokAnalysis;
        if (!dataset.videos?.length) {
          dataset.videos = safeVideos;
        }
        await dataset.save();
      }

      return res.json({
        success: true,
        datasetId,
        platform,
        analysis: tiktokAnalysis,
        videoCount: safeVideos.length
      });
    }

    const posts = (dataset.posts || []).filter((post) => (post.platform || dataset.platform || platform) === platform);
    if (!posts.length) {
      return res.json({
        success: true,
        datasetId,
        platform,
        analysis: null,
        videoCount: 0
      });
    }

    const summary = analyzeContent(posts, { platformFilter: platform });
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const dates = posts
      .map((post) => {
        const date = new Date(post.date || post.timestamp);
        return Number.isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean)
      .sort((a, b) => a - b);

    const formatted = {
      bestPostingHours: summary.bestTimes?.hours || summary.bestPostingHours || [],
      postingDaysOfWeek: summary.bestDays?.days || summary.bestDaysOfWeek || [],
      topVideos: summary.virality?.viralVideos || summary.topPostsByLikes || [],
      globalStats: {
        totalVideos: posts.length,
        totalLikes,
        avgLikes: posts.length ? Math.round(totalLikes / posts.length) : 0,
        firstPostDate: dates[0]?.toISOString(),
        lastPostDate: dates[dates.length - 1]?.toISOString()
      }
    };

    return res.json({
      success: true,
      datasetId,
      platform,
      analysis: formatted,
      videoCount: posts.length
    });
  } catch (error) {
    console.error("Analysis fetch error:", error);
    return res.status(500).json({ success: false, message: "Analyse konnte nicht geladen werden" });
  }
});

module.exports = router;


const express = require("express");
const multer = require("multer");
const { clampPlatform } = require("../utils/normalizedPost.js");
const { processUploadBuffer } = require("../utils/multiPlatformEngine.js");
const analyzeUnifiedItems = require("../utils/unifiedAnalyzer.js");
const { analyzeTikTokVideos } = require("../utils/tiktokAnalyzer.js");
const safeTikTokStreamParser = require("../utils/safeTikTokStreamParser.js");
const auth = require("../middleware/auth");
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
const MAX_ANALYSIS_ITEMS = 10_000;
const MAX_ANALYSIS_POST_PREVIEW = 50;

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
    const hashtags = Array.isArray(item.hashtags)
      ? item.hashtags
      : typeof item.hashtags === "string"
      ? item.hashtags.split(/[, ]+/)
      : [];
    const normalizedHashtags = [...new Set(hashtags.map((tag) => tag.replace("#", "").toLowerCase()).filter(Boolean))];
    const timestamp = isoDate ? new Date(isoDate).getTime() : Number(item.timestamp) || null;
    const meta = { ...(item.meta || {}) };
    if (meta.raw) delete meta.raw;
    return {
      id: item.id || item.link || `item-${index}`,
      platform: (item.platform || fallbackPlatform || "unknown").toLowerCase(),
      date: isoDate,
      timestamp,
      link: item.link || "",
      likes: Number.isFinite(item.likes) ? item.likes : Number(item.likes) || 0,
      comments: Number.isFinite(item.comments) ? item.comments : Number(item.comments) || 0,
      shares: Number.isFinite(item.shares) ? item.shares : Number(item.shares) || 0,
      views: Number.isFinite(item.views) ? item.views : Number(item.views) || 0,
      caption: item.caption || item.title || "",
      soundOrAudio: item.sound || item.soundOrAudio || "",
      location: item.location || "",
      coverImage: item.coverImage || null,
      hashtags: normalizedHashtags,
      isDeleted: Boolean(item.isDeleted),
      meta
    };
  });
}

function buildPerPlatformSummary(items = []) {
  return items.reduce((acc, item) => {
    const key = item.platform || "unknown";
    acc[key] = acc[key] || { count: 0 };
    acc[key].count += 1;
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

function respondGracefully(res, { message = SAFE_RESPONSE_MESSAGE, ignoredEntries = [], extras = {} } = {}) {
  return res.status(200).json({
    success: true,
    message,
    datasetId: null,
    posts: [],
    items: [],
    analysis: {},
    ignoredEntries,
    ...extras
  });
}

function parseDateRange(query = {}) {
  const fromDate = query.fromDate ? new Date(query.fromDate) : null;
  const toDate = query.toDate ? new Date(query.toDate) : null;
  const start = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  let end = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;
  if (end) {
    end.setHours(23, 59, 59, 999);
  }
  return {
    from: start,
    to: end
  };
}

function filterItemsByDate(items = [], range = {}) {
  if (!range.from && !range.to) return items;
  return items.filter((item) => {
    const ts =
      typeof item.timestamp === "number"
        ? item.timestamp
        : item.timestamp
        ? Number(item.timestamp)
        : item.date
        ? new Date(item.date).getTime()
        : null;
    if (!ts || Number.isNaN(ts)) {
      return false;
    }
    if (range.from && ts < range.from.getTime()) return false;
    if (range.to && ts > range.to.getTime()) return false;
    return true;
  });
}

function formatDateRange(range = {}) {
  return {
    from: range.from ? range.from.toISOString() : null,
    to: range.to ? range.to.toISOString() : null
  };
}

function collectTikTokItems(dataset = {}) {
  if (!dataset || typeof dataset !== "object") return [];
  const videos = Array.isArray(dataset.videos) ? dataset.videos : [];
  const legacyPosts = Array.isArray(dataset.posts) ? dataset.posts : [];
  const combined = [...videos, ...legacyPosts].filter((item) => (item.platform || dataset.platform || "tiktok") === "tiktok");
  if (!combined.length) {
    return [];
  }
  return sanitizeItems(combined, "tiktok");
}

function buildTikTokAnalysisResult(items = []) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return {
      message: "Kein analysierbares TikTok-Material gefunden",
      count: 0,
      analysis: null,
      posts: []
    };
  }
  const workingItems =
    safeItems.length > MAX_ANALYSIS_ITEMS ? safeItems.slice(0, MAX_ANALYSIS_ITEMS) : safeItems;
  const analysis = analyzeTikTokVideos(workingItems);
  const posts = workingItems.slice(0, MAX_ANALYSIS_POST_PREVIEW);
  return {
    message: "Analyse erfolgreich",
    count: safeItems.length,
    analysis,
    posts
  };
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
  const result = await safeTikTokStreamParser(file.buffer, {
    fileName: file.originalname || "upload.json",
    fileSize: file.size
  });
  const items = result.posts || [];
  const ignoredEntries = result.ignored || [];
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
      reason: result.flags?.metadataOnly ? "metadata-only" : "safe-parser",
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
    const parsed = await safeTikTokStreamParser(file.buffer, {
      fileName: file.originalname || "folder.json",
      fileSize: file.size
    });

    const items = parsed.posts || [];
    const ignored = parsed.ignored || [];
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
      reason: parsed.flags?.metadataOnly ? "metadata-only" : "safe-parser",
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

router.post("/", auth, upload.single("file"), async (req, res) => {
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
    responsePayload.posts = sanitizedItems;
    responsePayload.analysis = analysis;
    return res.json(responsePayload);
  } catch (error) {
    console.error("Upload/Analyze error:", error);
    return respondGracefully(res, {
      message: SAFE_RESPONSE_MESSAGE,
      ignoredEntries: [{ reason: error?.message || "unbekannter-fehler" }]
    });
  }
});

router.post("/folder", auth, upload.array("files"), async (req, res) => {
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
    responsePayload.posts = sanitizedItems;
    responsePayload.analysis = analysis;
    return res.json(responsePayload);
  } catch (error) {
    console.error("Folder upload error:", error);
    return respondGracefully(res, {
      message: SAFE_RESPONSE_MESSAGE,
      ignoredEntries: [{ reason: error?.message || "ordner-fehler" }]
    });
  }
});

router.get("/datasets", auth, async (req, res) => {
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

router.get("/datasets/:id", auth, async (req, res) => {
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

router.get("/analysis/unified/:datasetId", auth, async (req, res) => {
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

    const range = parseDateRange(req.query || {});
    const items = Array.isArray(dataset.videos) ? dataset.videos : [];
    const scopedItems = filterItemsByDate(items, range);
    const analysis = analyzeUnifiedItems(scopedItems);
    return res.json({
      success: true,
      datasetId: dataset._id,
      analysis,
      dateRange: formatDateRange(range),
      itemCount: scopedItems.length
    });
  } catch (error) {
    console.error("Unified analysis fetch error:", error);
    return res.status(500).json({ success: false, message: "Analyse konnte nicht geladen werden" });
  }
});

router.get("/analysis/:platform", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login erforderlich" });
    }
    const platform = req.params.platform?.toLowerCase();
    if (!SUPPORTED_ANALYSIS_PLATFORMS.includes(platform)) {
      return res.json({
        success: true,
        message: "Unbekannte Plattform",
        datasetId: null,
        analysis: null,
        posts: [],
        count: 0
      });
    }
    const datasetId = req.query.datasetId;
    if (!datasetId) {
      return res.json({
        success: true,
        datasetId: null,
        platform,
        analysis: null,
        posts: [],
        count: 0,
        message: "datasetId fehlt"
      });
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
        posts: [],
        count: 0,
        message: "Dataset nicht gefunden"
      });
    }

    const range = parseDateRange(req.query || {});

    if (platform === "tiktok") {
      const tikTokItems = filterItemsByDate(collectTikTokItems(dataset), range);
      const result = buildTikTokAnalysisResult(tikTokItems);
      return res.json({
        success: true,
        datasetId,
        platform,
        message: result.message,
        count: result.count,
        analysis: result.analysis,
        posts: result.posts,
        ignoredEntries: dataset.ignoredEntries || [],
        dateRange: formatDateRange(range),
        itemCount: tikTokItems.length
      });
    }

    const videos = Array.isArray(dataset.videos) ? dataset.videos : [];
    const posts = videos.filter((post) => (post.platform || dataset.platform || platform) === platform);
    const scopedPosts = filterItemsByDate(posts, range);
    if (!scopedPosts.length) {
      return res.json({
        success: true,
        datasetId,
        platform,
        analysis: null,
        posts: [],
        count: 0,
        dateRange: formatDateRange(range),
        message: "Kein analysierbares Material gefunden"
      });
    }

    const unifiedResult = analyzeUnifiedItems(scopedPosts);
    const platformInsights = unifiedResult.perPlatform[platform] || analyzeUnifiedItems(scopedPosts).global;
    const totalLikes = scopedPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalComments = scopedPosts.reduce((sum, post) => sum + (post.comments || 0), 0);
    const dates = scopedPosts
      .map((post) => {
        const date = new Date(post.date || post.timestamp);
        return Number.isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean)
      .sort((a, b) => a - b);

    const formatted = {
      bestPostingHours: platformInsights.bestPostingHours || [],
      postingDaysOfWeek: platformInsights.bestWeekdays || [],
      topHashtags: platformInsights.topHashtags || [],
      topVideos: scopedPosts
        .slice()
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, MAX_ANALYSIS_POST_PREVIEW),
      globalStats: {
        totalVideos: scopedPosts.length,
        totalLikes,
        avgLikes: scopedPosts.length ? Math.round(totalLikes / scopedPosts.length) : 0,
        avgComments: scopedPosts.length ? Math.round(totalComments / scopedPosts.length) : 0,
        firstPostDate: dates[0]?.toISOString(),
        lastPostDate: dates[dates.length - 1]?.toISOString()
      }
    };

    return res.json({
      success: true,
      datasetId,
      platform,
      message: "Analyse erfolgreich",
      analysis: formatted,
      posts: formatted.topVideos,
      count: scopedPosts.length,
      dateRange: formatDateRange(range)
    });
  } catch (error) {
    console.error("Analysis fetch error:", error);
    return res.json({
      success: true,
      message: "Analyse konnte nicht durchgeführt werden (interner Fallback)",
      count: 0,
      analysis: null,
      posts: [],
      error: error?.message
    });
  }
});

module.exports = router;
module.exports.__helpers = {
  collectTikTokItems,
  buildTikTokAnalysisResult
};


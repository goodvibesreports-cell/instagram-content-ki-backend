import express from "express";
import multer from "multer";
import analyzeContent from "../utils/contentAnalyzer.js";
import { clampPlatform } from "../utils/normalizedPost.js";
import { analyzeTikTokVideos } from "../utils/tiktokAnalyzer.js";
import { processSingleFileUpload, processFolderUpload } from "../utils/universalUploader.js";
import { optionalAuth } from "../middleware/auth.js";
import UploadDataset from "../models/UploadDataset.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB to support very large exports/ZIPs
  }
});

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

function summarizeDataset(dataset) {
  if (!dataset) return null;
  return {
    _id: dataset._id,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    platform: dataset.platform,
    status: dataset.status,
    totals: dataset.totals,
    sourceFilename: dataset.sourceFilename,
    fileSize: dataset.fileSize
  };
}

function buildMetaPayload(aggregate) {
  return {
    summary: aggregate.summary,
    totals: aggregate.totals,
    ignoredEntries: aggregate.ignoredEntries,
    rawFilesMeta: aggregate.rawFilesMeta
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
router.post("/", optionalAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Keine Datei hochgeladen" });
    }
    if (!req.file.size) {
      return res.status(400).json({ success: false, message: "Datei ist leer (0 Bytes)" });
    }

    const platformHint = clampPlatform(req.body?.platform || req.query?.platform || "tiktok");
    const aggregate = processSingleFileUpload(req.file, { platformHint });

    if (aggregate.platform === "unknown" && !aggregate.normalizedPosts.length) {
      return res.status(400).json({
        success: false,
        message: "Dateiformat konnte nicht erkannt werden",
        meta: buildMetaPayload(aggregate)
      });
    }

    const normalizedPosts = aggregate.normalizedPosts;
    const analysis = analyzeContent(normalizedPosts, { platformFilter: aggregate.platform });
    const tiktokAnalysis = aggregate.platform === "tiktok" ? analyzeTikTokVideos(aggregate.videos) : null;

    let dataset = null;
    try {
      dataset = await UploadDataset.create({
        userId: req.user?.id || null,
        platform: aggregate.platform,
        rawPlatform: aggregate.platform,
        status: normalizedPosts.length ? "completed" : "failed",
        sourceFilename: req.file.originalname,
        fileSize: req.file.size,
        sourceType: "upload-single",
        rawJsonSnippet: aggregate.rawSnippet,
        totals: {
          posts: normalizedPosts.length,
          links: normalizedPosts.length
        },
        posts: normalizedPosts,
        videos: aggregate.videos,
        rawFilesMeta: aggregate.rawFilesMeta,
        ignoredEntries: aggregate.ignoredEntries,
        metadata: {
          analysis,
          tiktokAnalysis,
          meta: buildMetaPayload(aggregate)
        }
      });
    } catch (persistError) {
      console.error("Dataset persistence error:", persistError);
    }

    const responsePayload = {
      success: true,
      platform: aggregate.platform,
      detectedType: aggregate.detectedType,
      message: normalizedPosts.length
        ? `Datei (${aggregate.platform}) erfolgreich verarbeitet`
        : aggregate.totals.watchHistory
        ? "Keine gültigen TikTok-Videodaten gefunden (nur Watch-History erkannt)"
        : "Keine Posts im Upload gefunden",
      totalPosts: normalizedPosts.length,
      postsPreview: normalizedPosts.slice(0, 10),
      analysis,
      tiktokAnalysis,
      meta: buildMetaPayload(aggregate),
      datasetId: dataset?._id || null,
      dataset: summarizeDataset(dataset),
      fileName: req.file.originalname,
      fileSize: req.file.size
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Upload/Analyze error:", error);
    return res.status(400).json({
      success: false,
      message: "Fehler beim Verarbeiten des Exports",
      error: error?.message || "Unbekannter Fehler"
    });
  }
});

router.post("/folder", optionalAuth, upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "Keine Dateien hochgeladen" });
    }

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const platformHint = clampPlatform(req.body?.platform || req.query?.platform || "tiktok");
    const aggregate = processFolderUpload(files, { platformHint, totalFiles: files.length });

    if (aggregate.platform === "unknown" && !aggregate.normalizedPosts.length) {
      return res.status(400).json({
        success: false,
        message: "Keine relevanten Dateien im Ordner gefunden",
        meta: buildMetaPayload(aggregate)
      });
    }

    const normalizedPosts = aggregate.normalizedPosts;
    const analysis = analyzeContent(normalizedPosts, { platformFilter: aggregate.platform });
    const tiktokAnalysis = aggregate.platform === "tiktok" ? analyzeTikTokVideos(aggregate.videos) : null;
    const deletedCount = aggregate.videos.filter((video) => video.isDeleted).length;

    let dataset = null;
    try {
      dataset = await UploadDataset.create({
        userId: req.user?.id || null,
        platform: aggregate.platform,
        rawPlatform: aggregate.platform,
        status: normalizedPosts.length ? "completed" : "failed",
        sourceFilename: files[0]?.originalname || "folder-upload",
        fileSize: totalSize,
        sourceType: "upload-folder",
        rawJsonSnippet: aggregate.rawSnippet,
        totals: {
          posts: normalizedPosts.length,
          links: normalizedPosts.length
        },
        posts: normalizedPosts,
        videos: aggregate.videos,
        rawFilesMeta: aggregate.rawFilesMeta,
        ignoredEntries: aggregate.ignoredEntries,
        metadata: {
          analysis,
          tiktokAnalysis,
          meta: buildMetaPayload(aggregate)
        }
      });
    } catch (error) {
      console.error("Dataset persistence error (folder upload):", error);
    }

    return res.json({
      success: true,
      platform: aggregate.platform,
      totalFiles: aggregate.summary.totalFiles,
      processedFiles: aggregate.summary.processedFiles,
      ignoredFiles: aggregate.summary.ignoredFiles,
      videoCount: aggregate.videos.length,
      deletedCount,
      analysis,
      tiktokAnalysis,
      meta: buildMetaPayload(aggregate),
      datasetId: dataset?._id || null,
      dataset: summarizeDataset(dataset)
    });
  } catch (error) {
    console.error("Folder upload error:", error);
    return res.status(400).json({
      success: false,
      message: "Ordner-Upload fehlgeschlagen",
      error: error?.message || "Unbekannter Fehler"
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
      return res.status(404).json({ success: false, message: "Dataset nicht gefunden" });
    }

    if (platform === "tiktok") {
      let videos = Array.isArray(dataset.videos) && dataset.videos.length ? dataset.videos : [];
      if (!videos.length && Array.isArray(dataset.posts) && dataset.posts.length) {
        videos = dataset.posts.map(rebuildTikTokVideoFromPost).filter(Boolean);
      }

      let tiktokAnalysis = dataset.metadata?.tiktokAnalysis;
      if (!tiktokAnalysis && videos.length) {
        tiktokAnalysis = analyzeTikTokVideos(videos);
        dataset.metadata = dataset.metadata || {};
        dataset.metadata.tiktokAnalysis = tiktokAnalysis;
        if (!dataset.videos?.length) {
          dataset.videos = videos;
        }
        await dataset.save();
      }

      return res.json({
        success: true,
        datasetId,
        platform,
        analysis: tiktokAnalysis || analyzeTikTokVideos([]),
        videoCount: videos.length
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

export default router;


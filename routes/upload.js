import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { parseTiktokJson } from "../utils/parsers/tiktokParser.js";
import { parseInstagramJson } from "../utils/parsers/instagramParser.js";
import { parseFacebookJson } from "../utils/parsers/facebookParser.js";
import analyzeContent from "../utils/contentAnalyzer.js";
import { clampPlatform, normalizedFromTikTokVideo } from "../utils/normalizedPost.js";
import { parseTikTokExport } from "../utils/tiktokParser.js";
import { analyzeTikTokVideos } from "../utils/tiktokAnalyzer.js";
import { parseFolderFiles } from "../utils/folderParser.js";
import { optionalAuth } from "../middleware/auth.js";
import UploadDataset from "../models/UploadDataset.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB to support large exports
  }
});

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

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
router.post("/", optionalAuth, upload.single("file"), async (req, res) => {
  try {
    let json;
    let sourceFilename = null;
    let fileSize = null;

    if (req.file) {
      const filePath = req.file.path;
      sourceFilename = req.file.originalname;
      fileSize = req.file.size;

      let raw;
      try {
        raw = await fs.promises.readFile(filePath, "utf8");
      } catch (error) {
        await safeUnlink(filePath);
        return res.status(500).json({ success: false, message: "Datei konnte nicht gelesen werden" });
      }

      try {
        json = JSON.parse(raw);
      } catch (error) {
        await safeUnlink(filePath);
        return res.status(400).json({ success: false, message: "Datei ist keine gültige JSON" });
      }

      await safeUnlink(filePath);
    } else if (req.body && Object.keys(req.body).length) {
      const payload = req.body.json || req.body.data || req.body;
      if (typeof payload === "string") {
        try {
          json = JSON.parse(payload);
        } catch {
          return res.status(400).json({ success: false, message: "JSON-Body ungültig" });
        }
      } else {
        json = payload;
      }
    } else {
      return res.status(400).json({ success: false, message: "Keine Datei hochgeladen" });
    }

    const requestedPlatform = clampPlatform(req.body?.platform || req.query?.platform || "tiktok");
    const parserMap = {
      tiktok: parseTiktokJson,
      instagram: parseInstagramJson,
      facebook: parseFacebookJson
    };
    const parser = parserMap[requestedPlatform];
    if (!parser) {
      return res.status(400).json({ success: false, message: `Unsupported platform: ${requestedPlatform}` });
    }

    const normalizedPosts = parser(json) || [];
    if (!normalizedPosts.length) {
      console.warn(`[Upload] Keine Posts erkannt für Plattform ${requestedPlatform}`);
      return res.status(400).json({ success: false, message: "Keine Posts im Upload gefunden" });
    }

    const analysis = analyzeContent(normalizedPosts, { platformFilter: requestedPlatform });

    let dataset = null;
    try {
      dataset = await UploadDataset.create({
        userId: req.user?.id || null,
        platform: requestedPlatform,
        rawPlatform: requestedPlatform,
        status: normalizedPosts.length ? "completed" : "failed",
        sourceFilename: sourceFilename || "direct-json",
        fileSize: fileSize || 0,
        totals: {
          posts: normalizedPosts.length,
          links: normalizedPosts.length
        },
        posts: normalizedPosts,
        metadata: {
          analysis
        },
        rawJsonSnippet: json?.Profile || json?.profile || {}
      });
    } catch (persistError) {
      console.error("Dataset persistence error:", persistError);
    }

    const datasetSummary = dataset
      ? {
          _id: dataset._id,
          createdAt: dataset.createdAt,
          updatedAt: dataset.updatedAt,
          platform: dataset.platform,
          status: dataset.status,
          totals: dataset.totals,
          sourceFilename: dataset.sourceFilename,
          fileSize: dataset.fileSize
        }
      : null;

    return res.status(200).json({
      success: true,
      platform: requestedPlatform,
      message: `Datei (${requestedPlatform}) erfolgreich verarbeitet`,
      totalPosts: normalizedPosts.length,
      postsPreview: normalizedPosts.slice(0, 10),
      analysis,
      datasetId: dataset?._id || null,
      dataset: datasetSummary
    });
  } catch (error) {
    console.error("Upload/Analyze error:", error);
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
    return res.status(400).json({
      success: false,
      message: "Fehler beim Verarbeiten des Exports",
      error: error?.message || "Unbekannter Fehler"
    });
  }
});

router.post("/folder", optionalAuth, upload.array("files"), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ success: false, message: "Keine Dateien hochgeladen" });
  }

  const fileEntries = [];
  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size || 0;
    try {
      const buffer = await fs.promises.readFile(file.path);
      fileEntries.push({ buffer, fileName: file.originalname, fileSize: file.size });
    } catch (error) {
      console.error("Folder Upload read error:", error);
    } finally {
      await safeUnlink(file.path);
    }
  }

  const { videos, deletedCount, summary } = parseFolderFiles(fileEntries);

  if (!videos.length) {
    return res.json({
      platform: "tiktok",
      totalFiles: summary.totalFiles,
      processedFiles: summary.processedFiles,
      ignoredFiles: summary.ignoredFiles,
      videoCount: 0,
      deletedCount: 0,
      analysis: {
        postingTimes: { hours: [], days: [] },
        viralVideos: [],
        patterns: {},
        creatorDNA: {}
      }
    });
  }

  const normalizedPosts = videos.map(normalizedFromTikTokVideo).filter(Boolean);
  const postingAnalysis = analyzeTikTokVideos(videos);
  const deepAnalysis = analyzeContent(normalizedPosts, { platformFilter: "tiktok" });
  const analysisPayload = {
    postingTimes: {
      hours: postingAnalysis.bestPostingHours,
      days: postingAnalysis.postingDaysOfWeek
    },
    viralVideos: postingAnalysis.topVideos,
    patterns: {
      keywords: deepAnalysis.themes?.dominantThemes || [],
      sounds: deepAnalysis.sounds?.topSounds || [],
      stats: deepAnalysis.stats
    },
    creatorDNA: deepAnalysis.creatorDNA
  };

  let datasetId = null;
  let datasetSummary = null;
  try {
    const dataset = await UploadDataset.create({
      userId: req.user?.id || null,
      platform: "tiktok",
      rawPlatform: "tiktok",
      status: "completed",
      sourceFilename: files[0]?.originalname || "folder-upload",
      fileSize: totalSize,
      totals: {
        posts: normalizedPosts.length,
        links: normalizedPosts.length
      },
      posts: normalizedPosts,
      videos,
      ignoredEntries: summary.ignoredEntries,
      sourceType: "upload-folder",
      metadata: {
        summary,
        analysis: analysisPayload
      }
    });
    datasetId = dataset._id;
    datasetSummary = {
      _id: dataset._id,
      platform: dataset.platform,
      status: dataset.status,
      totals: dataset.totals,
      sourceFilename: dataset.sourceFilename,
      fileSize: dataset.fileSize,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt
    };
  } catch (error) {
    console.error("Dataset persistence error (folder upload):", error);
  }

  return res.json({
    platform: "tiktok",
    totalFiles: summary.totalFiles,
    processedFiles: summary.processedFiles,
    ignoredFiles: summary.ignoredFiles,
    videoCount: videos.length,
    deletedCount,
    analysis: analysisPayload,
    datasetId,
    dataset: datasetSummary
  });
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


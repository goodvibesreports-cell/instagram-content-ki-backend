import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import parseTikTokJson from "../utils/tiktokParser.js";
import analyzeTikTokPosts from "../utils/tiktokAnalyzer.js";
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

router.post("/", optionalAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Keine Datei hochgeladen" });
    }

    const filePath = req.file.path;
    let raw;

    try {
      raw = await fs.promises.readFile(filePath, "utf8");
    } catch (error) {
      await safeUnlink(filePath);
      return res.status(500).json({ success: false, message: "Datei konnte nicht gelesen werden" });
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      await safeUnlink(filePath);
      return res.status(400).json({ success: false, message: "Datei ist keine gültige JSON" });
    }

    await safeUnlink(filePath);

    const { links, posts, stats } = parseTikTokJson(json);
    const analysis = analyzeTikTokPosts(posts, stats);

    const dataset = await UploadDataset.create({
      userId: req.user?.id || null,
      platform: "tiktok",
      status: posts.length ? "completed" : "failed",
      sourceFilename: req.file.originalname,
      fileSize: req.file.size,
      totals: {
        links: links.length,
        posts: posts.length,
        ignoredLinks: stats.ignoredLinks || 0
      },
      links,
      posts,
      metadata: {
        stats,
        analysis
      }
    });

    const count = posts.length;
    const datasetSummary = {
      _id: dataset._id,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
      platform: dataset.platform,
      status: dataset.status,
      totals: dataset.totals,
      sourceFilename: dataset.sourceFilename,
      fileSize: dataset.fileSize
    };

    return res.status(200).json({
      success: true,
      message: count
        ? "TikTok Datei erfolgreich analysiert"
        : "Keine gültigen TikTok-Videodaten gefunden (nur Watch-History erkannt)",
      count,
      datasetId: dataset._id,
      dataset: datasetSummary,
      fileName: dataset.sourceFilename,
      fileSize: dataset.fileSize,
      analysis,
      ignoredLinks: stats.ignoredLinks || 0,
      processedLinks: stats.processedLinks || 0,
      links,
      posts
    });
  } catch (error) {
    console.error("Upload Error:", error);
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
    return res.status(500).json({
      success: false,
      message: "Serverfehler beim Verarbeiten der Datei"
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
      .select("-posts.raw");

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

export default router;


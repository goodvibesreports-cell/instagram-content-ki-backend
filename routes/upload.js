import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import parseTikTokJson from "../utils/tiktokParser.js";

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

router.post("/", upload.single("file"), async (req, res) => {
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

    const links = parseTikTokJson(json);

    if (!links.length) {
      return res.status(200).json({
        success: true,
        message: "Datei verarbeitet, aber keine TikTok-Links gefunden",
        links: []
      });
    }

    return res.status(200).json({
      success: true,
      message: "TikTok Datei erfolgreich verarbeitet",
      count: links.length,
      links
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

export default router;


import authRoutes from "./routes/auth.js";
// backend/index.js
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import dotenv from "dotenv";
import OpenAI from "openai";
import { connectDB } from "./config/db.js";

dotenv.config();
connectDB(); // <-- MongoDB Verbindung starten

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: "uploads/" });

// Speicher fÃ¼r hochgeladene Posts
let uploadedPosts = [];

// ==============================
// Healthcheck
// ==============================
app.get("/healthz", (req, res) => {
  res.json({ status: "OK", mongo: "connected" });
});

// ==============================
// Datei Upload
// ==============================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const content = await fs.readFile(filePath, "utf8");

    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (err) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: "Invalid JSON format" });
    }

    if (!Array.isArray(jsonData)) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: "JSON must be an array of posts" });
    }

    uploadedPosts = jsonData;
    await fs.unlink(filePath);

    return res.json({
      message: `Upload erfolgreich: ${uploadedPosts.length} Posts`,
      count: uploadedPosts.length,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ==============================
// Prompts generieren
// ==============================
app.post("/generate-prompts", async (req, res) => {
  try {
    const { category, variantsPerPost = 3 } = req.body;

    if (!uploadedPosts.length) {
      return res.status(400).json({ error: "No posts uploaded" });
    }

    const systemMessage = `
Du bist ein professioneller Social Media Content Creator.
Erstelle kreative Instagram-Reels-Prompts basierend auf den analysierten Posts.
`.trim();

    const userMessage = `
Kategorie: ${category || "Auto"}.
Erstelle ${variantsPerPost} Varianten pro Post.
Posts: ${JSON.stringify(uploadedPosts)}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      max_tokens: 600,
    });

    const choices = response.choices || [];
    const prompts = choices
      .map((c) => c.message?.content)
      .filter(Boolean);

    if (!prompts.length) {
      return res.status(500).json({ error: "AI returned no prompts" });
    }

    return res.json({ prompts });
  } catch (err) {
    console.error("Prompt generation error:", err);
    res.status(500).json({ error: "Prompt generation failed" });
  }
});

// ==============================
// Videoideen generieren
// ==============================
app.post("/generate-video-ideas", async (req, res) => {
  try {
    const { prompts } = req.body;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: "No prompts provided" });
    }

    const videoIdeas = [];

    for (const prompt of prompts) {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Du bist ein professioneller Instagram Reel Script Writer.
Erstelle:
- Handlung
- Voiceover
- Texteinblendungen
- Hashtags
`.trim(),
          },
          {
            role: "user",
            content: `Skript erstellen fÃ¼r: "${prompt}"`,
          },
        ],
        max_tokens: 600,
      });

      const idea = response?.choices?.[0]?.message?.content || "Keine Idee generiert";
      videoIdeas.push({ prompt, idea });
    }

    res.json({ videoIdeas });
  } catch (err) {
    console.error("Video idea generation error:", err);
    res.status(500).json({ error: "Video ideas generation failed" });
  }
});

// ==============================
// Server starten
// ==============================
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ðŸš€ Backend lÃ¤uft auf Port ${PORT}`));


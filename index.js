// backend/index.js - Instagram Content KI v2.0
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

// Config & Database
import { connectDB } from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin.js";
import batchRoutes from "./routes/batch.js";
import calendarRoutes from "./routes/calendar.js";
import teamRoutes from "./routes/team.js";
import settingsRoutes from "./routes/settings.js";

// Models
import Post from "./models/Post.js";
import GeneratedContent from "./models/GeneratedContent.js";
import User from "./models/User.js";

// Middleware
import auth, { optionalAuth } from "./middleware/auth.js";
import { generalLimiter, authLimiter, aiLimiter, uploadLimiter, abuseDetection } from "./middleware/rateLimiter.js";

// Validators
import { validate, validateArray, generatePromptsSchema, generateVideoIdeasSchema, uploadPostsSchema } from "./validators/schemas.js";

// Utils
import { createErrorResponse, createSuccessResponse, errorMiddleware } from "./utils/errorHandler.js";
import { logger, requestLogger } from "./utils/logger.js";

// Services
import { cacheService } from "./services/cacheService.js";
import { CREDIT_COSTS } from "./services/aiService.js";

dotenv.config();

// ==============================
// App Setup
// ==============================
const app = express();

// CORS
const corsOptions = {
  origin: [
    "https://instagram-content-ki-frontend.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);
app.use(abuseDetection);
app.use(generalLimiter);

// OpenAI Client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==============================
// Multer Upload Config
// ==============================
const uploadDir = path.join(process.cwd(), "uploads");
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/json", "text/plain"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Nur JSON-Dateien erlaubt"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Cleanup
async function cleanupUploads() {
  try {
    const files = await fs.readdir(uploadDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs < oneHourAgo) {
        await fs.unlink(filePath);
      }
    }
  } catch (err) {
    logger.error("Cleanup error", { error: err.message });
  }
}
setInterval(cleanupUploads, 30 * 60 * 1000);

// ==============================
// Routes
// ==============================
app.use("/auth", authLimiter, authRoutes);
app.use("/ai", aiRoutes);
app.use("/admin", adminRoutes);
app.use("/batch", batchRoutes);
app.use("/calendar", calendarRoutes);
app.use("/team", teamRoutes);
app.use("/settings", settingsRoutes);

// ==============================
// Healthcheck
// ==============================
app.get("/healthz", (req, res) => {
  res.json(createSuccessResponse({
    status: "OK",
    version: "2.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

// ==============================
// User Profile & Credits
// ==============================
app.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json(createErrorResponse("NOT_FOUND"));
    }
    
    return res.json(createSuccessResponse({
      user: {
        id: user._id,
        email: user.email,
        credits: user.credits,
        bonusCredits: user.bonusCredits,
        totalCredits: user.totalCredits,
        premium: user.premium,
        premiumTier: user.premiumTier,
        usage: user.usage,
        settings: user.settings,
        createdAt: user.createdAt
      },
      creditCosts: CREDIT_COSTS
    }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// Update Settings
app.put("/profile/settings", auth, async (req, res) => {
  try {
    const { defaultLanguage, defaultTone, emailNotifications, darkMode } = req.body;
    
    const user = await User.findById(req.user.id);
    if (defaultLanguage) user.settings.defaultLanguage = defaultLanguage;
    if (defaultTone) user.settings.defaultTone = defaultTone;
    if (emailNotifications !== undefined) user.settings.emailNotifications = emailNotifications;
    if (darkMode !== undefined) user.settings.darkMode = darkMode;
    
    await user.save();
    
    return res.json(createSuccessResponse({ settings: user.settings }, "Einstellungen gespeichert"));
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// POST Upload
// ==============================
app.post("/upload", optionalAuth, uploadLimiter, upload.single("file"), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json(createErrorResponse("UPLOAD_NO_FILE"));
    }

    const filePath = req.file.path;
    logger.info(`File uploaded: ${req.file.originalname}`, { size: req.file.size });

    const content = await fs.readFile(filePath, "utf8");
    
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch {
      await fs.unlink(filePath);
      return res.status(400).json(createErrorResponse("UPLOAD_INVALID_JSON"));
    }

    // Validate with Zod
    const validation = uploadPostsSchema.safeParse(jsonData);
    if (!validation.success) {
      await fs.unlink(filePath);
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", validation.error.errors));
    }

    const userId = req.user?.id || null;

    const postsToInsert = validation.data.map(post => ({
      userId,
      content: post.content || post.text || post.caption || post.description,
      caption: post.caption || post.description || "",
      hashtags: post.hashtags || [],
      likes: post.likes || post.likeCount || 0,
      comments: post.comments || post.commentCount || 0,
      engagement: post.engagement || 0,
      category: post.category || req.body?.category || "general",
      source: "upload",
      metadata: { originalData: post, uploadedAt: new Date() }
    }));

    if (userId) {
      await Post.deleteMany({ userId, source: "upload" });
      await User.findByIdAndUpdate(userId, { $inc: { "usage.uploadsCount": 1 } });
    }
    
    const insertedPosts = await Post.insertMany(postsToInsert);
    await fs.unlink(filePath);

    const duration = Date.now() - startTime;
    logger.success(`Upload complete: ${insertedPosts.length} posts`, { duration: `${duration}ms` });

    return res.json(createSuccessResponse({
      count: insertedPosts.length,
      posts: insertedPosts.map(p => ({ id: p._id, content: p.content.substring(0, 100) }))
    }, `${insertedPosts.length} Posts erfolgreich hochgeladen`));

  } catch (err) {
    logger.error("Upload error", { error: err.message });
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json(createErrorResponse("UPLOAD_FAILED", err.message));
  }
});

// ==============================
// GET Posts
// ==============================
app.get("/posts", optionalAuth, async (req, res) => {
  try {
    const { category, limit = 50, page = 1 } = req.query;
    const userId = req.user?.id || null;
    
    const query = userId ? { userId } : {};
    if (category) query.category = category;
    
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Post.countDocuments(query);
    
    return res.json(createSuccessResponse({
      posts,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Generate Prompts
// ==============================
app.post("/generate-prompts", optionalAuth, aiLimiter, validate(generatePromptsSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { category, variantsPerPost, style, tone, language } = req.validatedBody;
    const userId = req.user?.id || null;

    // Credit Check
    if (userId) {
      const user = await User.findById(userId);
      if (user.totalCredits < CREDIT_COSTS.prompt) {
        return res.status(402).json(createErrorResponse("VALIDATION_ERROR", "Nicht genügend Credits"));
      }
    }

    // Check Cache
    const cacheKey = { category, variantsPerPost, style, tone };
    const cached = await cacheService.get("prompt", cacheKey);
    if (cached) {
      return res.json(createSuccessResponse({
        prompts: [cached.content],
        metadata: { fromCache: true, generationTime: "0ms" }
      }, "Prompts aus Cache geladen"));
    }

    const query = userId ? { userId } : {};
    if (category && category !== "general") query.category = category;
    
    const posts = await Post.find(query).sort({ createdAt: -1 }).limit(20);

    if (!posts.length) {
      return res.status(400).json(createErrorResponse("POSTS_EMPTY"));
    }

    const systemMessage = `Du bist ein erfahrener Social Media Stratege und Content Creator.
Sprache: ${language === "en" ? "Englisch" : "Deutsch"}
Stil: ${style}
Ton: ${tone}

Erstelle für jeden analysierten Post ${variantsPerPost} einzigartige Instagram Reel Prompts.

FORMAT für jeden Prompt:
---
🎬 PROMPT #[Nummer]
Titel: [Catchy Titel]
Hook: [Erste 3 Sekunden]
Konzept: [Kurze Beschreibung]
Virales Potenzial: [1-10]
---`;

    const userMessage = `Kategorie: ${category}
Analysiere diese Posts und erstelle Prompts:
${posts.map((p, i) => `[${i + 1}] ${p.content.substring(0, 200)}... (Likes: ${p.likes})`).join("\n")}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.8
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent) {
      return res.status(500).json(createErrorResponse("AI_NO_RESPONSE"));
    }

    // Deduct Credits & Save
    if (userId) {
      const user = await User.findById(userId);
      await user.useCredits(CREDIT_COSTS.prompt);
      await user.trackUsage("prompt");
      
      await GeneratedContent.create({
        userId,
        type: "prompt",
        prompt: userMessage.substring(0, 500),
        content: generatedContent,
        category,
        metadata: { model: "gpt-4o-mini", tokens: response.usage?.total_tokens, generationTime: Date.now() - startTime }
      });
    }

    // Cache
    await cacheService.set("prompt", cacheKey, { content: generatedContent });

    const duration = Date.now() - startTime;
    logger.ai("Prompts generated", { tokens: response.usage?.total_tokens, duration });

    return res.json(createSuccessResponse({
      prompts: [generatedContent],
      metadata: { postsAnalyzed: posts.length, generationTime: `${duration}ms`, model: "gpt-4o-mini", fromCache: false }
    }, "Prompts erfolgreich generiert"));

  } catch (err) {
    logger.error("Prompt generation error", { error: err.message });
    if (err.status === 429) return res.status(429).json(createErrorResponse("AI_RATE_LIMITED"));
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Generate Video Ideas
// ==============================
app.post("/generate-video-ideas", optionalAuth, aiLimiter, validate(generateVideoIdeasSchema), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { prompts, detailed } = req.validatedBody;
    const userId = req.user?.id || null;

    // Credit Check
    if (userId) {
      const user = await User.findById(userId);
      const totalCost = CREDIT_COSTS.video_idea * prompts.length;
      if (user.totalCredits < totalCost) {
        return res.status(402).json(createErrorResponse("VALIDATION_ERROR", `Nicht genügend Credits. Benötigt: ${totalCost}`));
      }
    }

    const videoIdeas = [];

    for (const prompt of prompts) {
      // Check Cache
      const cached = await cacheService.get("video_idea", prompt);
      if (cached) {
        videoIdeas.push({ prompt, idea: cached.content, fromCache: true });
        continue;
      }

      const systemMessage = `Du bist ein professioneller Instagram Reel Script Writer.
      
OUTPUT-FORMAT:
📹 VIDEO-SKRIPT
━━━━━━━━━━━━━━
🎬 TITEL: [Titel]
⏱️ HOOK (0-3s): [Hook]
📖 HANDLUNG:
1. [Szene]
2. [Szene]
🎙️ VOICEOVER: [Text]
✨ TEXT-OVERLAYS: [Texte]
🎯 CTA: [Call-to-Action]
#️⃣ HASHTAGS: [10-15 Tags]
📊 VIRAL-SCORE: [1-10]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: `Erstelle ein ${detailed ? "detailliertes" : "kurzes"} Video-Skript für: "${prompt}"` }
        ],
        max_tokens: detailed ? 1500 : 800,
        temperature: 0.7
      });

      const idea = response.choices[0]?.message?.content || "Keine Idee generiert";
      videoIdeas.push({ prompt, idea, tokens: response.usage?.total_tokens, fromCache: false });

      // Cache
      await cacheService.set("video_idea", prompt, { content: idea });
    }

    // Deduct Credits & Save
    if (userId) {
      const user = await User.findById(userId);
      const actualCost = videoIdeas.filter(v => !v.fromCache).length * CREDIT_COSTS.video_idea;
      if (actualCost > 0) {
        await user.useCredits(actualCost);
        await user.trackUsage("script");
      }
      
      for (const v of videoIdeas.filter(vi => !vi.fromCache)) {
        await GeneratedContent.create({
          userId,
          type: "video_idea",
          prompt: v.prompt.substring(0, 500),
          content: v.idea,
          metadata: { model: "gpt-4o-mini", tokens: v.tokens }
        });
      }
    }

    const duration = Date.now() - startTime;

    return res.json(createSuccessResponse({
      videoIdeas: videoIdeas.map(v => ({ prompt: v.prompt, idea: v.idea, fromCache: v.fromCache })),
      metadata: { count: videoIdeas.length, generationTime: `${duration}ms` }
    }, `${videoIdeas.length} Video-Ideen generiert`));

  } catch (err) {
    logger.error("Video idea error", { error: err.message });
    if (err.status === 429) return res.status(429).json(createErrorResponse("AI_RATE_LIMITED"));
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// History
// ==============================
app.get("/history", auth, async (req, res) => {
  try {
    const { type, limit = 20, page = 1 } = req.query;
    
    const query = { userId: req.user.id };
    if (type) query.type = type;
    
    const content = await GeneratedContent.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await GeneratedContent.countDocuments(query);
    
    return res.json(createSuccessResponse({
      history: content,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Error Handler
// ==============================
app.use(errorMiddleware);

// ==============================
// Server Start
// ==============================
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      logger.success(`🚀 Instagram Content KI v2.0 läuft auf Port ${PORT}`);
      logger.info(`Features: Validation, Rate Limiting, Caching, Credits, AI Generators`);
    });
    
    cleanupUploads();
    
  } catch (err) {
    logger.error("Server start failed", { error: err.message });
    process.exit(1);
  }
}

startServer();

import express from "express";
import auth, { optionalAuth } from "../middleware/auth.js";
import { dynamicLimiter } from "../middleware/rateLimiter.js";
import { createSuccessResponse, createErrorResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import { cacheService } from "../services/cacheService.js";
import User from "../models/User.js";
import GeneratedContent from "../models/GeneratedContent.js";
import OpenAI from "openai";

const router = express.Router();

// Credit cost for batch
const BATCH_CREDIT_COST = 5;

// Language map
const LANGUAGES = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  tr: "Türkçe",
  pl: "Polski",
  ru: "Русский"
};

// ==============================
// Batch Generator - 10 Prompts + 10 Hooks + 10 Captions
// ==============================
router.post("/generate", auth, dynamicLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { topic, niche, platform = "instagram", language = "de" } = req.body;
    
    if (!topic || topic.length < 3) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Thema erforderlich (min. 3 Zeichen)"));
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "User nicht gefunden"));
    }
    
    // Check credits (unless user has own API key)
    const useOwnKey = user.useOwnApiKeys && user.apiKeys.openai;
    if (!useOwnKey && user.totalCredits < BATCH_CREDIT_COST) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", `Nicht genügend Credits. Benötigt: ${BATCH_CREDIT_COST}`));
    }
    
    // Check cache
    const cacheKey = { topic, niche, platform, language };
    const cached = await cacheService.get("batch", cacheKey);
    if (cached && !req.body.skipCache) {
      return res.json(createSuccessResponse({
        ...cached,
        fromCache: true
      }, "Batch aus Cache geladen"));
    }
    
    // Get OpenAI client (user's key or platform key)
    const apiKey = useOwnKey ? user.getApiKey("openai") : process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });
    
    // Get user's style prompt
    const stylePrompt = user.getStylePrompt();
    const langName = LANGUAGES[language] || "Deutsch";
    
    // System prompt for batch generation
    const systemPrompt = `Du bist ein erfahrener Social Media Content Stratege.
Erstelle Content auf ${langName}.
Plattform: ${platform.toUpperCase()}
${niche ? `Nische: ${niche}` : ""}
${stylePrompt}

WICHTIG:
- Alle Outputs müssen einzigartig und kreativ sein
- Verwende aktuelle Trends und Sprache
- Optimiere für maximales Engagement
- Direkte Ansprache (Du-Form)`;

    // Generate all content in one call
    const userPrompt = `THEMA: "${topic}"

Generiere EXAKT dieses Format:

=== 10 REEL PROMPTS ===
1. [Prompt]
2. [Prompt]
3. [Prompt]
4. [Prompt]
5. [Prompt]
6. [Prompt]
7. [Prompt]
8. [Prompt]
9. [Prompt]
10. [Prompt]

=== 10 HOOKS ===
1. [Hook - max 10 Wörter, scroll-stoppend]
2. [Hook]
3. [Hook]
4. [Hook]
5. [Hook]
6. [Hook]
7. [Hook]
8. [Hook]
9. [Hook]
10. [Hook]

=== 10 CAPTIONS ===
1. [Caption mit Emojis und 5 Hashtags]
2. [Caption]
3. [Caption]
4. [Caption]
5. [Caption]
6. [Caption]
7. [Caption]
8. [Caption]
9. [Caption]
10. [Caption]

Jeder Output muss einzigartig sein. Keine Wiederholungen!`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.85
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json(createErrorResponse("AI_NO_RESPONSE"));
    }

    // Parse the response
    const parseSection = (text, sectionName) => {
      const regex = new RegExp(`=== ${sectionName} ===([\\s\\S]*?)(?====|$)`, "i");
      const match = text.match(regex);
      if (!match) return [];
      
      return match[1]
        .split(/\d+\.\s+/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    };

    const prompts = parseSection(content, "10 REEL PROMPTS");
    const hooks = parseSection(content, "10 HOOKS");
    const captions = parseSection(content, "10 CAPTIONS");

    const result = {
      topic,
      niche,
      platform,
      language,
      prompts,
      hooks,
      captions,
      metadata: {
        generatedAt: new Date().toISOString(),
        tokens: response.usage?.total_tokens,
        generationTime: `${Date.now() - startTime}ms`
      }
    };

    // Deduct credits
    if (!useOwnKey) {
      await user.useCredits(BATCH_CREDIT_COST);
    }
    await user.trackUsage("batch", response.usage?.total_tokens);

    // Save to history
    await GeneratedContent.create({
      userId: user._id,
      type: "batch",
      prompt: topic,
      content: JSON.stringify(result),
      metadata: {
        model: "gpt-4o-mini",
        tokens: response.usage?.total_tokens,
        generationTime: Date.now() - startTime
      }
    });

    // Cache result
    await cacheService.set("batch", cacheKey, result, 12 * 60 * 60 * 1000); // 12h cache

    const duration = Date.now() - startTime;
    logger.ai("Batch generated", { topic, tokens: response.usage?.total_tokens, duration });

    return res.json(createSuccessResponse({
      ...result,
      fromCache: false,
      creditsRemaining: user.totalCredits
    }, "Batch erfolgreich generiert: 10 Prompts, 10 Hooks, 10 Captions"));

  } catch (err) {
    logger.error("Batch generation error", { error: err.message });
    if (err.status === 429) return res.status(429).json(createErrorResponse("AI_RATE_LIMITED"));
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Get Batch History
// ==============================
router.get("/history", auth, async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const batches = await GeneratedContent.find({
      userId: req.user.id,
      type: "batch"
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await GeneratedContent.countDocuments({
      userId: req.user.id,
      type: "batch"
    });
    
    // Parse JSON content
    const parsedBatches = batches.map(b => ({
      id: b._id,
      prompt: b.prompt,
      ...JSON.parse(b.content),
      createdAt: b.createdAt
    }));
    
    return res.json(createSuccessResponse({
      batches: parsedBatches,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    }));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

export default router;


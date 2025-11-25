import express from "express";
import auth, { optionalAuth } from "../middleware/auth.js";
import { dynamicLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../validators/schemas.js";
import {
  generateHooksSchema,
  generateCaptionsSchema,
  generateTitleSchema,
  trendAnalysisSchema,
  viralityAnalysisSchema
} from "../validators/schemas.js";
import {
  generateHooks,
  generateCaptions,
  generateTitles,
  analyzeTrends,
  analyzeVirality,
  CREDIT_COSTS
} from "../services/aiService.js";
import { createSuccessResponse, createErrorResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import User from "../models/User.js";
import GeneratedContent from "../models/GeneratedContent.js";

const router = express.Router();

// Helper: Check and deduct credits
async function checkCredits(userId, type) {
  if (!userId) return { allowed: true, remaining: 999 };
  
  const user = await User.findById(userId);
  if (!user) return { allowed: false, remaining: 0, error: "User not found" };
  
  const cost = CREDIT_COSTS[type] || 1;
  
  if (user.totalCredits < cost) {
    return { 
      allowed: false, 
      remaining: user.totalCredits,
      error: `Nicht genügend Credits. Benötigt: ${cost}, Vorhanden: ${user.totalCredits}`
    };
  }
  
  await user.useCredits(cost);
  await user.trackUsage(type === "video_idea" ? "script" : type);
  
  return { allowed: true, remaining: user.totalCredits, cost };
}

// ==============================
// Hook Generator
// ==============================
router.post("/hooks", optionalAuth, dynamicLimiter, validate(generateHooksSchema), async (req, res) => {
  try {
    const { topic, count, style } = req.validatedBody;
    
    // Credit Check
    const creditCheck = await checkCredits(req.user?.id, "hook");
    if (!creditCheck.allowed) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", creditCheck.error));
    }

    const result = await generateHooks(topic, count, style);
    
    // Save to history
    if (req.user?.id) {
      await GeneratedContent.create({
        userId: req.user.id,
        type: "hook",
        prompt: topic,
        content: result.content,
        metadata: {
          model: result.model,
          tokens: result.tokens,
          generationTime: result.duration,
          fromCache: result.fromCache
        }
      });
    }

    return res.json(createSuccessResponse({
      hooks: result.content,
      metadata: {
        topic,
        count,
        style,
        generationTime: `${result.duration}ms`,
        fromCache: result.fromCache,
        creditsRemaining: creditCheck.remaining
      }
    }, `${count} Hooks erfolgreich generiert`));

  } catch (err) {
    logger.error("Hook generation error", { error: err.message });
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Caption Generator
// ==============================
router.post("/captions", optionalAuth, dynamicLimiter, validate(generateCaptionsSchema), async (req, res) => {
  try {
    const { topic, tone, includeEmojis, includeHashtags, count } = req.validatedBody;
    
    const creditCheck = await checkCredits(req.user?.id, "caption");
    if (!creditCheck.allowed) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", creditCheck.error));
    }

    const result = await generateCaptions(topic, { tone, includeEmojis, includeHashtags, count });
    
    if (req.user?.id) {
      await GeneratedContent.create({
        userId: req.user.id,
        type: "caption",
        prompt: topic,
        content: result.content,
        metadata: { model: result.model, tokens: result.tokens, fromCache: result.fromCache }
      });
    }

    return res.json(createSuccessResponse({
      captions: result.content,
      metadata: {
        topic,
        tone,
        generationTime: `${result.duration}ms`,
        fromCache: result.fromCache,
        creditsRemaining: creditCheck.remaining
      }
    }, `${count} Captions erfolgreich generiert`));

  } catch (err) {
    logger.error("Caption generation error", { error: err.message });
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Title Generator
// ==============================
router.post("/titles", optionalAuth, dynamicLimiter, validate(generateTitleSchema), async (req, res) => {
  try {
    const { topic, style, count } = req.validatedBody;
    
    const creditCheck = await checkCredits(req.user?.id, "title");
    if (!creditCheck.allowed) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", creditCheck.error));
    }

    const result = await generateTitles(topic, style, count);

    return res.json(createSuccessResponse({
      titles: result.content,
      metadata: {
        topic,
        style,
        generationTime: `${result.duration}ms`,
        fromCache: result.fromCache,
        creditsRemaining: creditCheck.remaining
      }
    }, `${count} Titel erfolgreich generiert`));

  } catch (err) {
    logger.error("Title generation error", { error: err.message });
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Trend Analysis
// ==============================
router.post("/trends", optionalAuth, dynamicLimiter, validate(trendAnalysisSchema), async (req, res) => {
  try {
    const { niche, platform, timeframe } = req.validatedBody;
    
    const creditCheck = await checkCredits(req.user?.id, "trend");
    if (!creditCheck.allowed) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", creditCheck.error));
    }

    const result = await analyzeTrends(niche, platform, timeframe);

    if (req.user?.id) {
      await GeneratedContent.create({
        userId: req.user.id,
        type: "trend",
        prompt: `${niche} - ${platform} - ${timeframe}`,
        content: result.content,
        metadata: { model: result.model, tokens: result.tokens }
      });
    }

    return res.json(createSuccessResponse({
      analysis: result.content,
      metadata: {
        niche,
        platform,
        timeframe,
        generationTime: `${result.duration}ms`,
        fromCache: result.fromCache,
        creditsRemaining: creditCheck.remaining
      }
    }, "Trend-Analyse erfolgreich"));

  } catch (err) {
    logger.error("Trend analysis error", { error: err.message });
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Virality Analysis
// ==============================
router.post("/virality", optionalAuth, dynamicLimiter, validate(viralityAnalysisSchema), async (req, res) => {
  try {
    const { content, type } = req.validatedBody;
    
    const creditCheck = await checkCredits(req.user?.id, "virality");
    if (!creditCheck.allowed) {
      return res.status(402).json(createErrorResponse("VALIDATION_ERROR", creditCheck.error));
    }

    const result = await analyzeVirality(content, type);

    return res.json(createSuccessResponse({
      analysis: result.content,
      metadata: {
        contentLength: content.length,
        type,
        generationTime: `${result.duration}ms`,
        fromCache: result.fromCache,
        creditsRemaining: creditCheck.remaining
      }
    }, "Virality-Analyse erfolgreich"));

  } catch (err) {
    logger.error("Virality analysis error", { error: err.message });
    return res.status(500).json(createErrorResponse("AI_GENERATION_FAILED", err.message));
  }
});

// ==============================
// Get Credit Costs
// ==============================
router.get("/costs", (req, res) => {
  return res.json(createSuccessResponse({
    costs: CREDIT_COSTS,
    description: {
      prompt: "Instagram Reel Prompts generieren",
      video_idea: "Detaillierte Video-Skripte erstellen",
      hook: "Scroll-stoppende Hooks generieren",
      caption: "Instagram Captions erstellen",
      title: "Virale Reel-Titel generieren",
      trend: "Trend-Analyse für deine Nische",
      virality: "Virality-Score berechnen"
    }
  }));
});

export default router;


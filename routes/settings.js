const express = require("express");
const auth = require("../middleware/auth");
const { createSuccessResponse, createErrorResponse } = require("../utils/errorHandler.js");
const { logger } = require("../utils/logger.js");
const User = require("../models/User");

const router = express.Router();

// ==============================
// Get Full Profile
// ==============================
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("organization", "name slug plan maxMembers");
    
    if (!user) {
      return res.status(404).json(createErrorResponse("NOT_FOUND"));
    }
    
    return res.json(createSuccessResponse({
      user: {
        ...user.toObject(),
        totalCredits: user.totalCredits,
        isPremium: user.isPremium
      }
    }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Update Content Style (Persönlicher Assistent)
// ==============================
router.put("/style", auth, async (req, res) => {
  try {
    const {
      toneOfVoice,
      writingStyle,
      targetAudience,
      niche,
      brandKeywords,
      avoidWords,
      emojiUsage,
      hashtagStyle,
      sampleContent,
      customInstructions
    } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (toneOfVoice) user.contentStyle.toneOfVoice = toneOfVoice;
    if (writingStyle) user.contentStyle.writingStyle = writingStyle;
    if (targetAudience !== undefined) user.contentStyle.targetAudience = targetAudience;
    if (niche !== undefined) user.contentStyle.niche = niche;
    if (brandKeywords) user.contentStyle.brandKeywords = brandKeywords;
    if (avoidWords) user.contentStyle.avoidWords = avoidWords;
    if (emojiUsage) user.contentStyle.emojiUsage = emojiUsage;
    if (hashtagStyle) user.contentStyle.hashtagStyle = hashtagStyle;
    if (sampleContent) user.contentStyle.sampleContent = sampleContent.slice(0, 5); // Max 5 samples
    if (customInstructions !== undefined) user.contentStyle.customInstructions = customInstructions;
    
    await user.save();
    
    logger.info(`User ${user.email} updated content style`);
    
    return res.json(createSuccessResponse({
      contentStyle: user.contentStyle
    }, "Content-Stil gespeichert"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Update Language Settings
// ==============================
router.put("/language", auth, async (req, res) => {
  try {
    const { language, outputLanguages } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (language) user.language = language;
    if (outputLanguages) user.outputLanguages = outputLanguages;
    
    await user.save();
    
    return res.json(createSuccessResponse({
      language: user.language,
      outputLanguages: user.outputLanguages
    }, "Sprach-Einstellungen gespeichert"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Update General Settings
// ==============================
router.put("/general", auth, async (req, res) => {
  try {
    const { darkMode, emailNotifications, autoSaveHistory, defaultLanguage, defaultTone } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (darkMode !== undefined) user.settings.darkMode = darkMode;
    if (emailNotifications !== undefined) user.settings.emailNotifications = emailNotifications;
    if (autoSaveHistory !== undefined) user.settings.autoSaveHistory = autoSaveHistory;
    if (defaultLanguage) user.settings.defaultLanguage = defaultLanguage;
    if (defaultTone) user.settings.defaultTone = defaultTone;
    
    await user.save();
    
    return res.json(createSuccessResponse({
      settings: user.settings
    }, "Einstellungen gespeichert"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Add Sample Content for Learning
// ==============================
router.post("/style/samples", auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.length < 20) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Content zu kurz (min. 20 Zeichen)"));
    }
    
    const user = await User.findById(req.user.id);
    
    if (user.contentStyle.sampleContent.length >= 5) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Maximum 5 Beispiele erlaubt. Lösche zuerst ein bestehendes."));
    }
    
    user.contentStyle.sampleContent.push(content);
    await user.save();
    
    return res.json(createSuccessResponse({
      sampleCount: user.contentStyle.sampleContent.length
    }, "Beispiel-Content hinzugefügt"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Remove Sample Content
// ==============================
router.delete("/style/samples/:index", auth, async (req, res) => {
  try {
    const { index } = req.params;
    const idx = parseInt(index);
    
    const user = await User.findById(req.user.id);
    
    if (idx < 0 || idx >= user.contentStyle.sampleContent.length) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Ungültiger Index"));
    }
    
    user.contentStyle.sampleContent.splice(idx, 1);
    await user.save();
    
    return res.json(createSuccessResponse({
      sampleCount: user.contentStyle.sampleContent.length
    }, "Beispiel-Content entfernt"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

module.exports = router;


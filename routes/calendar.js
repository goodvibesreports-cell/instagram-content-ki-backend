import express from "express";
import auth from "../middleware/auth.js";
import { createSuccessResponse, createErrorResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import CalendarEntry from "../models/CalendarEntry.js";

const router = express.Router();

// ==============================
// Get Calendar Entries
// ==============================
router.get("/", auth, async (req, res) => {
  try {
    const { startDate, endDate, status, platform } = req.query;
    
    const query = { userId: req.user.id };
    
    if (startDate && endDate) {
      query.scheduledFor = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) query.status = status;
    if (platform) query.platform = platform;
    
    const entries = await CalendarEntry.find(query).sort({ scheduledFor: 1 });
    
    return res.json(createSuccessResponse({ entries }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Get Single Entry
// ==============================
router.get("/:id", auth, async (req, res) => {
  try {
    const entry = await CalendarEntry.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!entry) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "Eintrag nicht gefunden"));
    }
    
    return res.json(createSuccessResponse({ entry }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Create Calendar Entry
// ==============================
router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      content,
      contentType = "custom",
      platform = "instagram",
      scheduledFor,
      scheduledTime = "12:00",
      hashtags = [],
      notes,
      color,
      aiGenerated = false,
      sourcePrompt,
      viralityScore
    } = req.body;
    
    if (!title || !content || !scheduledFor) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Titel, Content und Datum erforderlich"));
    }
    
    const entry = await CalendarEntry.create({
      userId: req.user.id,
      title,
      content,
      contentType,
      platform,
      scheduledFor: new Date(scheduledFor),
      scheduledTime,
      hashtags,
      notes,
      color,
      aiGenerated,
      sourcePrompt,
      viralityScore,
      status: "scheduled"
    });
    
    logger.info(`Calendar entry created: ${entry._id}`);
    
    return res.status(201).json(createSuccessResponse({ entry }, "Eintrag erstellt"));
  } catch (err) {
    logger.error("Create calendar entry error", { error: err.message });
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Update Calendar Entry
// ==============================
router.put("/:id", auth, async (req, res) => {
  try {
    const allowedUpdates = [
      "title", "content", "contentType", "platform",
      "scheduledFor", "scheduledTime", "status",
      "hashtags", "notes", "color"
    ];
    
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    
    if (updates.scheduledFor) {
      updates.scheduledFor = new Date(updates.scheduledFor);
    }
    
    const entry = await CalendarEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true }
    );
    
    if (!entry) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "Eintrag nicht gefunden"));
    }
    
    return res.json(createSuccessResponse({ entry }, "Eintrag aktualisiert"));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Delete Calendar Entry
// ==============================
router.delete("/:id", auth, async (req, res) => {
  try {
    const entry = await CalendarEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!entry) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "Eintrag nicht gefunden"));
    }
    
    return res.json(createSuccessResponse(null, "Eintrag gelöscht"));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Get Upcoming Posts
// ==============================
router.get("/upcoming/list", auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const entries = await CalendarEntry.getUpcoming(req.user.id, parseInt(limit));
    return res.json(createSuccessResponse({ entries }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Get Calendar Stats
// ==============================
router.get("/stats/:year/:month", auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const stats = await CalendarEntry.getStats(req.user.id, parseInt(month) - 1, parseInt(year));
    return res.json(createSuccessResponse({ stats }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Bulk Create from Generated Content
// ==============================
router.post("/bulk", auth, async (req, res) => {
  try {
    const { items } = req.body; // Array of { title, content, scheduledFor, platform }
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Items Array erforderlich"));
    }
    
    if (items.length > 30) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Maximal 30 Einträge pro Bulk-Operation"));
    }
    
    const entries = await CalendarEntry.insertMany(
      items.map(item => ({
        userId: req.user.id,
        title: item.title,
        content: item.content,
        platform: item.platform || "instagram",
        scheduledFor: new Date(item.scheduledFor),
        scheduledTime: item.scheduledTime || "12:00",
        status: "scheduled",
        aiGenerated: true
      }))
    );
    
    return res.status(201).json(createSuccessResponse({
      count: entries.length,
      entries
    }, `${entries.length} Einträge erstellt`));
    
  } catch (err) {
    logger.error("Bulk create error", { error: err.message });
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

export default router;


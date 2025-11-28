const {
  generatePromptIdeas,
  generateVideoScript,
  analyzeUpload,
  generateSeriesBlueprint
} = require("../services/aiService.js");
const { getCreatorProfile } = require("../services/creatorService.js");
const { getCurrentUser } = require("../services/authService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");
const History = require("../models/History.js");

async function ensureProfile(userId) {
  try {
    return await getCreatorProfile(userId);
  } catch {
    const err = new Error("Bitte Creator DNA zuerst ausfüllen");
    err.status = 400;
    throw err;
  }
}

async function promptIdeas(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generatePromptIdeas(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      action: "promptIdeas",
      meta: {
        platform: req.validated.platform,
        input: req.validated,
        output: result.content
      }
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

async function videoScript(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generateVideoScript(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      action: "videoScript",
      meta: {
        platform: req.validated.platform,
        input: req.validated,
        output: result.content
      }
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

async function uploadAnalyze(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await analyzeUpload(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      action: "uploadAnalyze",
      meta: {
        platform: req.validated.platform,
        input: req.validated,
        output: result.content
      }
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

async function seriesBlueprint(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generateSeriesBlueprint(userDoc, profile, req.validated);
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  promptIdeas,
  videoScript,
  uploadAnalyze,
  seriesBlueprint
};


import { generatePromptIdeas, generateVideoScript, analyzeUpload, generateSeriesBlueprint } from "../services/aiService.js";
import { getCreatorProfile } from "../services/creatorService.js";
import { getCurrentUser } from "../services/authService.js";
import { createSuccessResponse } from "../utils/errorHandler.js";
import History from "../models/History.js";

async function ensureProfile(userId) {
  try {
    return await getCreatorProfile(userId);
  } catch {
    const err = new Error("Bitte Creator DNA zuerst ausfüllen");
    err.status = 400;
    throw err;
  }
}

export async function promptIdeas(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generatePromptIdeas(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      type: "prompt",
      platform: req.validated.platform,
      input: req.validated,
      output: result.content
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

export async function videoScript(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generateVideoScript(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      type: "script",
      platform: req.validated.platform,
      input: req.validated,
      output: result.content
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

export async function uploadAnalyze(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await analyzeUpload(userDoc, profile, req.validated);
    await History.create({
      userId: req.user.id,
      type: "analysis",
      platform: req.validated.platform,
      input: req.validated,
      output: result.content
    });
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}

export async function seriesBlueprint(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const userDoc = req.userDoc || await getCurrentUser(req.user.id);
    const result = await generateSeriesBlueprint(userDoc, profile, req.validated);
    res.json(createSuccessResponse({ result }));
  } catch (err) {
    next(err);
  }
}


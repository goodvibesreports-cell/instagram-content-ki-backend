import { getCreatorProfile, saveCreatorProfile } from "../services/creatorService.js";
import { createSuccessResponse } from "../utils/errorHandler.js";

export async function getProfile(req, res, next) {
  try {
    const profile = await getCreatorProfile(req.user.id);
    res.json(createSuccessResponse({ profile }));
  } catch (err) {
    next(err);
  }
}

export async function upsertProfile(req, res, next) {
  try {
    const profile = await saveCreatorProfile(req.user.id, req.validated);
    res.json(createSuccessResponse({ profile }, "Creator DNA gespeichert"));
  } catch (err) {
    next(err);
  }
}


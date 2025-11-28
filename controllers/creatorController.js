const { getCreatorProfile, saveCreatorProfile } = require("../services/creatorService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

async function getProfile(req, res, next) {
  try {
    const profile = await getCreatorProfile(req.user.id);
    res.json(createSuccessResponse({ profile }));
  } catch (err) {
    next(err);
  }
}

async function upsertProfile(req, res, next) {
  try {
    const profile = await saveCreatorProfile(req.user.id, req.validated);
    res.json(createSuccessResponse({ profile }, "Creator DNA gespeichert"));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  upsertProfile
};


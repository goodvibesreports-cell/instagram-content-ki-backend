const { getCreatorProfile, saveCreatorProfile } = require("../services/creatorService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

function computeTotalCredits(user) {
  if (!user) return 0;
  if (typeof user.totalCredits === "number") return user.totalCredits;
  const credits = user.credits || 0;
  const bonusCredits = user.bonusCredits || 0;
  return credits + bonusCredits;
}

function buildProfilePayload(profileDoc, user, fallbackUserId) {
  const totalCredits = computeTotalCredits(user);
  if (!profileDoc) {
    return {
      userId: fallbackUserId,
      niche: null,
      toneOfVoice: null,
      targetAudience: null,
      contentGoals: [],
      exampleHooks: [],
      exampleCaptions: [],
      bannedWords: [],
      creatorStatement: "",
      totalCredits,
      usedCredits: 0
    };
  }
  const plain = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
  plain.totalCredits =
    typeof plain.totalCredits === "number" ? plain.totalCredits : totalCredits;
  plain.usedCredits = plain.usedCredits || 0;
  if (!plain.userId) {
    plain.userId = fallbackUserId;
  }
  return plain;
}

async function getProfile(req, res, next) {
  try {
    const profile = await getCreatorProfile(req.user.id);
    const payload = buildProfilePayload(profile, req.user || req.userDoc, req.user.id);
    res.json(createSuccessResponse({ profile: payload }));
  } catch (err) {
    next(err);
  }
}

async function upsertProfile(req, res, next) {
  try {
    const profile = await saveCreatorProfile(req.user.id, req.validated);
    const payload = buildProfilePayload(profile, req.user || req.userDoc, req.user.id);
    res.json(createSuccessResponse({ profile: payload }, "Creator DNA gespeichert"));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  upsertProfile
};


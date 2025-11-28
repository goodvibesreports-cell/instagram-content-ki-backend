const { getCreatorProfile, saveCreatorProfile } = require("../services/creatorService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

function computeTotalCredits(user) {
  if (!user) return 0;
  const credits = Number(user.credits ?? 0);
  const bonusCredits = Number(user.bonusCredits ?? 0);
  return credits + bonusCredits;
}

function normalizeProfileDoc(profileDoc, fallbackUserId) {
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
      creatorStatement: ""
    };
  }
  const plain = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
  plain.userId = plain.userId || fallbackUserId;
  return plain;
}

function buildCreatorPayload(profileDoc, user, userId) {
  const profile = normalizeProfileDoc(profileDoc, userId);
  return {
    totalCredits: computeTotalCredits(user),
    usedCredits: profileDoc?.usedCredits || 0,
    plan: profileDoc?.plan || user?.plan || "free",
    tier: profileDoc?.tier || user?.tier || "basic",
    limits: profileDoc?.limits || {},
    profile
  };
}

async function getProfile(req, res, next) {
  try {
    const profileDoc = await getCreatorProfile(req.user.id);
    const payload = buildCreatorPayload(profileDoc, req.user || req.userDoc, req.user.id);
    res.json(createSuccessResponse(payload));
  } catch (err) {
    console.error("[CREATOR] Fehler beim Laden des Profils:", err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden des Creator-Profils"
    });
  }
}

async function upsertProfile(req, res, next) {
  try {
    const profileDoc = await saveCreatorProfile(req.user.id, req.validated);
    const payload = buildCreatorPayload(profileDoc, req.user || req.userDoc, req.user.id);
    res.json(createSuccessResponse(payload, "Creator DNA gespeichert"));
  } catch (err) {
    console.error("[CREATOR] Fehler beim Speichern des Profils:", err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Speichern des Creator-Profils"
    });
  }
}

module.exports = {
  getProfile,
  upsertProfile
};


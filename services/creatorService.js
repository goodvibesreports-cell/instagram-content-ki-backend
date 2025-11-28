"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildCreatorPrompt = buildCreatorPrompt;
exports.getCreatorProfile = getCreatorProfile;
exports.saveCreatorProfile = saveCreatorProfile;
var _CreatorProfile = _interopRequireDefault(require("../models/CreatorProfile.js"));
var _User = _interopRequireDefault(require("../models/User"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
async function getCreatorProfile(userId) {
  return _CreatorProfile.default.findOne({
    userId
  });
}
async function saveCreatorProfile(userId, data) {
  const profile = await _CreatorProfile.default.findOneAndUpdate({
    userId
  }, {
    ...data,
    userId
  }, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  });
  await _User.default.findByIdAndUpdate(userId, {
    creatorProfile: profile._id
  });
  return profile;
}
function buildCreatorPrompt(user, profile) {
  const lines = [];
  lines.push(`Creator Nische: ${profile?.niche || "unbekannt"}`);
  lines.push(`Ton: ${profile?.toneOfVoice || "neutral"}`);
  if (profile?.targetAudience) lines.push(`Zielgruppe: ${profile.targetAudience}`);
  if (profile?.contentGoals?.length) lines.push(`Ziele: ${profile.contentGoals.join(", ")}`);
  if (profile?.bannedWords?.length) lines.push(`Vermeide: ${profile.bannedWords.join(", ")}`);
  if (profile?.exampleHooks?.length) {
    lines.push("Beispiele für Hooks:");
    profile.exampleHooks.slice(0, 3).forEach((hook, idx) => {
      lines.push(`${idx + 1}. ${hook}`);
    });
  }
  if (profile?.exampleCaptions?.length) {
    lines.push("Beispiele für Captions:");
    profile.exampleCaptions.slice(0, 2).forEach((c, idx) => lines.push(`${idx + 1}. ${c}`));
  }
  lines.push(`Aktueller Plattform Modus: ${user.platformMode}`);
  return lines.join("\n");
}
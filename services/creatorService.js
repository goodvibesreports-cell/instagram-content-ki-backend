import CreatorProfile from "../models/CreatorProfile.js";
import User from "../models/User.js";

export async function getCreatorProfile(userId) {
  return CreatorProfile.findOne({ userId });
}

export async function saveCreatorProfile(userId, data) {
  const profile = await CreatorProfile.findOneAndUpdate(
    { userId },
    { ...data, userId },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await User.findByIdAndUpdate(userId, { creatorProfile: profile._id });
  return profile;
}

export function buildCreatorPrompt(user, profile) {
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


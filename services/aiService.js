import OpenAI from "openai";
import { cacheService } from "./cacheService.js";
import { logger } from "../utils/logger.js";
import { buildCreatorPrompt } from "./creatorService.js";
import { PLATFORM_TEMPLATES } from "../utils/platformTemplates.js";
import { scorePerformance } from "../utils/scoring.js";

export const CREDIT_COSTS = Object.freeze({
  prompt: 1,
  video_idea: 2,
  hook: 1,
  caption: 1,
  title: 1,
  trend: 3,
  virality: 2,
  batch: 5
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function callOpenAI(messages, { type = "general", maxTokens = 1200, temperature = 0.7, cacheKey = null } = {}) {
  if (!openai) {
    return {
      content: "⚠️ OPENAI_API_KEY fehlt – Demo Output.",
      tokens: 0,
      model: "mock",
      fromCache: false
    };
  }

  if (cacheKey) {
    const cached = await cacheService.get(type, cacheKey);
    if (cached) return { ...cached, fromCache: true };
  }

  const start = Date.now();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: maxTokens,
    temperature
  });

  const result = {
    content: response.choices[0]?.message?.content,
    tokens: response.usage?.total_tokens,
    duration: Date.now() - start,
    model: "gpt-4o-mini",
    fromCache: false
  };

  if (cacheKey && result.content) {
    await cacheService.set(type, cacheKey, result);
  }
  logger.ai(`${type} generated`, { tokens: result.tokens, duration: result.duration });
  return result;
}

export async function generatePromptIdeas(user, profile, { topic, platform, count = 5 }) {
  const platformHint = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.instagram;
  const dna = buildCreatorPrompt(user, profile);

  const system = `Du bist eine Shortform-Strategin für ${platformHint.label}.
Nutze den Stil des Creators und liefere Serien-Ideen, keine generischen Vorschläge.`;
  const userPrompt = `Creator DNA:
${dna}

PLATFORM MODE HINWEISE:
${platformHint.prompt}

THEMA: ${topic}
ANZAHL IDEEN: ${count}

FORMAT:
1. Serienname
2. Episodenidee (Hook + Kernaussage)
3. CTA
4. Warum passt es zur Creator DNA`;

  return callOpenAI([
    { role: "system", content: system },
    { role: "user", content: userPrompt }
  ], { type: "prompt", cacheKey: { topic, platform, dna } });
}

export async function generateVideoScript(user, profile, { prompt, platform }) {
  const platformHint = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.instagram;
  const dna = buildCreatorPrompt(user, profile);

  const system = `Du schreibst präzise Reels/TikTok Scripts im ${platformHint.label}-Format.
Berücksichtige Hook, Szenen, Voiceover, Text-Overlays und CTA.`;

  const content = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: `Creator DNA:\n${dna}\n\nPLATFORM MODE:\n${platformHint.prompt}\n\nPrompt:\n${prompt}` }
  ], { type: "script", maxTokens: 1800 });

  return content;
}

export async function analyzeUpload(user, profile, payload) {
  const platformHint = PLATFORM_TEMPLATES[payload.platform] || PLATFORM_TEMPLATES.instagram;
  const dna = buildCreatorPrompt(user, profile);

  const system = `Du bist ein Upload-Analyser für Shortform Videos.
Bewerte Hook, Story, CTA, Hashtags und gib konkrete Scores (0-100).`;

  const response = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: `Creator DNA:\n${dna}\n\nPLATFORM:\n${platformHint.prompt}\n\nCONTENT:\n${payload.caption}\n\nMETRICS: ${JSON.stringify(payload.metrics || {})}` }
  ], { type: "analysis", maxTokens: 1600, temperature: 0.4 });

  return response;
}

export async function generateSeriesBlueprint(user, profile, { topic, episodes = 10, platform }) {
  const platformHint = PLATFORM_TEMPLATES[platform] || PLATFORM_TEMPLATES.instagram;
  const dna = buildCreatorPrompt(user, profile);

  const system = `Du bist die Series Factory.
Erstelle Serien-Formate mit Episodenübersicht für ${platformHint.label}.`;

  return callOpenAI([
    { role: "system", content: system },
    { role: "user", content: `Creator DNA:\n${dna}\n\nPLATFORM HINWEIS:\n${platformHint.prompt}\n\nSerie Topic: ${topic}\nAnzahl Episoden: ${episodes}` }
  ], { type: "series", maxTokens: 2200 });
}

export function calculateMomentum(performance) {
  return scorePerformance(performance);
}

// ==============================
// Advanced Generators (Hooks, Captions, Titles)
// ==============================

export async function generateHooks(topic, count = 10, style = "mixed") {
  const system = "Du bist ein Hook-Copywriter für kurze Video-Formate. Schreibe radikale, scroll-stoppende Hooks.";
  const userPrompt = `THEMA: ${topic}
ANZAHL: ${count}
STIL: ${style}

FORMAT:
1. [Hook Text]
2. [Hook Text]
...`;

  return callOpenAI(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    { type: "hook", maxTokens: 800, cacheKey: { topic, count, style } }
  );
}

export async function generateCaptions(topic, { tone = "casual", includeEmojis = true, includeHashtags = true, count = 3 } = {}) {
  const system = "Du bist ein Instagram Caption Writer. Jede Caption enthält Hook, Story und CTA.";
  const userPrompt = `THEMA: ${topic}
TONALITÄT: ${tone}
EMOJIS: ${includeEmojis ? "Ja" : "Nein"}
HASHTAGS: ${includeHashtags ? "Ja" : "Nein"}
ANZAHL: ${count}

FORMAT:
---
Caption #[Nummer]
Text: ...
CTA: ...
Hashtags: ...
---`;

  return callOpenAI(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    { type: "caption", maxTokens: 1200, cacheKey: { topic, tone, includeEmojis, includeHashtags, count } }
  );
}

export async function generateTitles(topic, style = "clickbait", count = 5) {
  const system = "Du bist ein Title-Generator für Reels/TikTok. Schreibe ultra-kurze Titel mit maximal 55 Zeichen.";
  const userPrompt = `THEMA: ${topic}
STIL: ${style}
ANZAHL: ${count}

FORMAT:
1. Titel
2. Titel`;

  return callOpenAI(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    { type: "title", maxTokens: 400, cacheKey: { topic, style, count } }
  );
}

// ==============================
// Analysen
// ==============================

export async function analyzeTrends(niche, platform = "instagram", timeframe = "week") {
  const system = "Du bist ein Trend-Analyst für Social Media. Liefere Insights anhand aktueller Best Practices.";
  const userPrompt = `NISCHE: ${niche}
PLATTFORM: ${platform}
ZEITRAUM: ${timeframe}

FORMAT:
- Trending Content Formate
- Viral Hooks
- Content Gaps
- Handlungsempfehlungen`;

  return callOpenAI(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    { type: "trend", maxTokens: 1500, cacheKey: { niche, platform, timeframe } }
  );
}

export async function analyzeVirality(content, type = "full") {
  const system = "Du bist ein Virality-Analyst. Bewerte Content nach Story, Emotion, Hook und CTA.";
  const userPrompt = `KONTENT-TYP: ${type}
INHALT:
${content}

FORMAT:
🎯 Score (0-10)
✅ Was funktioniert
⚠️ Risiken
🚀 Verbesserungen
💡 Neue Hook/CTA`;

  return callOpenAI(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    { type: "virality", maxTokens: 1000, cacheKey: { content, type } }
  );
}

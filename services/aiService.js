import OpenAI from "openai";
import { cacheService } from "./cacheService.js";
import { logger } from "../utils/logger.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==============================
// Credit Costs per Feature
// ==============================
export const CREDIT_COSTS = {
  prompt: 1,
  video_idea: 2,
  hook: 1,
  caption: 1,
  title: 1,
  trend: 3,
  virality: 2
};

// ==============================
// Base AI Call with Caching
// ==============================
async function callAI(systemPrompt, userPrompt, options = {}) {
  const {
    type = "general",
    maxTokens = 1000,
    temperature = 0.7,
    useCache = true,
    cacheTTL = 24 * 60 * 60 * 1000
  } = options;

  const cacheKey = { system: systemPrompt.substring(0, 100), user: userPrompt };
  
  // Check Cache
  if (useCache) {
    const cached = await cacheService.get(type, cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  const startTime = Date.now();
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    });

    const content = response.choices[0]?.message?.content;
    const duration = Date.now() - startTime;
    
    const result = {
      content,
      tokens: response.usage?.total_tokens,
      duration,
      model: "gpt-4o-mini",
      fromCache: false
    };

    // Save to Cache
    if (useCache && content) {
      await cacheService.set(type, cacheKey, result, cacheTTL);
    }

    logger.ai(`${type} generated`, { tokens: result.tokens, duration });
    
    return result;
  } catch (err) {
    logger.error(`AI ${type} error`, { error: err.message });
    throw err;
  }
}

// ==============================
// Hook Generator
// ==============================
export async function generateHooks(topic, count = 10, style = "mixed") {
  const systemPrompt = `Du bist ein Experte für virale Social Media Hooks.
Ein Hook ist der erste Satz/die ersten 3 Sekunden eines Videos, der die Aufmerksamkeit fesselt.

HOOK-STILE:
- question: Fragen, die Neugier wecken
- statement: Mutige, kontroverse Aussagen
- shocking: Überraschende Fakten
- story: "Ich habe..." / "Als ich..."
- mixed: Mischung aus allen

REGELN:
1. Jeder Hook MUSS in den ersten 3 Sekunden fesseln
2. Keine generischen Hooks
3. Spezifisch und unique
4. Direkte Ansprache (Du/Ihr)
5. Emotional triggernd

FORMAT:
Nummeriere jeden Hook und füge einen Emoji + Wirkungskategorie hinzu.
Beispiel:
1. 🔥 [NEUGIER] "Warum 90% der Menschen diesen Fehler machen..."`;

  const userPrompt = `Thema: "${topic}"
Stil: ${style}
Anzahl: ${count}

Generiere ${count} einzigartige, scroll-stoppende Hooks für dieses Thema.`;

  const result = await callAI(systemPrompt, userPrompt, {
    type: "hook",
    maxTokens: 1500,
    temperature: 0.8
  });

  return result;
}

// ==============================
// Caption Generator
// ==============================
export async function generateCaptions(topic, options = {}) {
  const { tone = "casual", includeEmojis = true, includeHashtags = true, count = 3 } = options;

  const systemPrompt = `Du bist ein Instagram Caption Spezialist.
Deine Captions sind optimiert für:
- Engagement (Likes, Kommentare, Saves)
- Algorithmus-Freundlichkeit
- Call-to-Action

STRUKTUR einer perfekten Caption:
1. Hook (erste Zeile - erscheint in Preview)
2. Wert/Story (2-3 Absätze)
3. Call-to-Action
4. Hashtags (wenn gewünscht)

EMOJI-NUTZUNG: ${includeEmojis ? "Ja, strategisch einsetzen" : "Nein, keine Emojis"}
HASHTAGS: ${includeHashtags ? "10-15 relevante Hashtags" : "Keine Hashtags"}
TON: ${tone}

FORMAT:
---
CAPTION #[Nummer]
[Die Caption hier]

🎯 Zweck: [Was soll erreicht werden]
💡 CTA-Typ: [Frage/Aufforderung/Share]
---`;

  const userPrompt = `Thema: "${topic}"
Ton: ${tone}
Anzahl: ${count}

Erstelle ${count} verschiedene Instagram Captions.`;

  const result = await callAI(systemPrompt, userPrompt, {
    type: "caption",
    maxTokens: 2000,
    temperature: 0.7
  });

  return result;
}

// ==============================
// Reel Title Generator
// ==============================
export async function generateTitles(topic, style = "clickbait", count = 5) {
  const systemPrompt = `Du bist ein Experte für virale Reel-Titel.

TITEL-STILE:
- clickbait: Neugier weckend, zum Klicken verleitend
- informative: Klar und informativ
- question: Als Frage formuliert
- how-to: Anleitungs-Format
- listicle: Listen-Format ("5 Wege...", "3 Gründe...")

REGELN:
1. Maximal 40 Zeichen für beste Darstellung
2. Zahlen und Power-Wörter nutzen
3. Emotional triggernd
4. Spezifisch, nicht generisch

POWER-WÖRTER: Geheimnis, Fehler, Warum, Jetzt, Sofort, Einfach, Nie wieder, Unglaublich

FORMAT:
1. [TITEL] (Zeichen: X) - [Stärke: 1-10]`;

  const userPrompt = `Thema: "${topic}"
Stil: ${style}
Anzahl: ${count}

Generiere ${count} scroll-stoppende Reel-Titel.`;

  const result = await callAI(systemPrompt, userPrompt, {
    type: "title",
    maxTokens: 800,
    temperature: 0.8
  });

  return result;
}

// ==============================
// Trend Analysis
// ==============================
export async function analyzeTrends(niche, platform = "instagram", timeframe = "week") {
  const systemPrompt = `Du bist ein Social Media Trend-Analyst mit Expertise in ${platform}.

DEINE AUFGABE:
Analysiere aktuelle Trends in der gegebenen Nische und liefere actionable Insights.

OUTPUT-FORMAT:
📈 TREND REPORT: ${niche.toUpperCase()}
Plattform: ${platform} | Zeitraum: ${timeframe}
━━━━━━━━━━━━━━━━━━━━━

🔥 TOP 5 TRENDS:
1. [Trend Name]
   - Beschreibung: ...
   - Virales Potenzial: [1-10]
   - Content-Idee: ...
   - Hashtags: #...

💡 CONTENT EMPFEHLUNGEN:
- [3-5 konkrete Content-Ideen]

📊 TIMING:
- Beste Postzeiten
- Optimale Frequenz

⚠️ TRENDS ZU VERMEIDEN:
- [Was nicht mehr funktioniert]

🎯 QUICK WINS:
- [Einfach umsetzbare Ideen]`;

  const userPrompt = `Nische: "${niche}"
Plattform: ${platform}
Zeitraum: ${timeframe}

Analysiere die aktuellen Trends und gib konkrete Empfehlungen.`;

  const result = await callAI(systemPrompt, userPrompt, {
    type: "trend",
    maxTokens: 2500,
    temperature: 0.6,
    cacheTTL: 6 * 60 * 60 * 1000 // 6 Stunden Cache für Trends
  });

  return result;
}

// ==============================
// Virality Analysis
// ==============================
export async function analyzeVirality(content, type = "full") {
  const systemPrompt = `Du bist ein Virality-Analyst mit Deep-Knowledge über Social Media Algorithmen.

ANALYSE-KRITERIEN:
1. Hook Strength (Wie gut fesselt der Anfang?)
2. Emotional Trigger (Welche Emotionen werden ausgelöst?)
3. Shareability (Würde man es teilen?)
4. Watch Time Prediction (Bleibt man dran?)
5. Engagement Potential (Kommentare, Likes)
6. Algorithm Friendliness (Passt es zum Algo?)

OUTPUT-FORMAT:
🔬 VIRALITY ANALYSE
━━━━━━━━━━━━━━━━━━━━━

📊 GESAMT-SCORE: [X/100]

📈 DETAIL-SCORES:
- Hook Strength: [X/10] - [Begründung]
- Emotional Impact: [X/10] - [Welche Emotion]
- Shareability: [X/10] - [Warum/Warum nicht]
- Watch Time: [X/10] - [Prognose]
- Engagement: [X/10] - [Erwartung]
- Algo Score: [X/10] - [Erklärung]

💪 STÄRKEN:
- [Liste der Stärken]

⚠️ SCHWÄCHEN:
- [Liste der Schwächen]

🔧 VERBESSERUNGSVORSCHLÄGE:
1. [Konkrete Änderung 1]
2. [Konkrete Änderung 2]
3. [Konkrete Änderung 3]

🎯 OPTIMIERTER HOOK:
[Verbesserte Version des Hooks]

📱 PLATTFORM-EMPFEHLUNG:
- Am besten für: [Plattform]
- Postzeit: [Empfehlung]`;

  const userPrompt = `CONTENT ZUR ANALYSE:
"${content}"

Analyse-Typ: ${type}

Führe eine detaillierte Virality-Analyse durch.`;

  const result = await callAI(systemPrompt, userPrompt, {
    type: "virality",
    maxTokens: 2000,
    temperature: 0.5
  });

  return result;
}

// ==============================
// Export all
// ==============================
export default {
  generateHooks,
  generateCaptions,
  generateTitles,
  analyzeTrends,
  analyzeVirality,
  CREDIT_COSTS
};


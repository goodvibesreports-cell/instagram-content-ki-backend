import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

export async function generateScripts(req, res) {
  try {
    const { prompts } = req.body || {};
    if (!Array.isArray(prompts) || !prompts.length) {
      return res.status(400).json({ error: "Keine Prompts übergeben" });
    }

    const videoIdeas = [];

    for (const prompt of prompts) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Du bist ein professioneller Social Media Video Creator." },
          {
            role: "user",
            content: `Erstelle aus folgendem Prompt ein kurzes Instagram-Reel-Skript mit Handlung, Voiceover, Hashtags: "${prompt}"`
          }
        ],
        max_completion_tokens: 500
      });

      const idea = response.choices?.[0]?.message?.content || "Keine Idee generiert";
      videoIdeas.push({ prompt, idea });
    }

    return res.json({ videoIdeas });
  } catch (err) {
    console.error("Script generation error:", err);
    return res.status(500).json({ error: "Fehler bei der Videoideen-Generierung" });
  }
}


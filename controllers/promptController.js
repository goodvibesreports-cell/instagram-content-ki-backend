import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

export async function generatePrompt(req, res) {
  try {
    const data = req.body || {};
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "Keine Daten übergeben" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist ein professioneller Social Media Content Creator." },
        { role: "user", content: `Analysiere diese Daten und generiere 3-5 virale Prompts: ${JSON.stringify(data)}` }
      ],
      max_completion_tokens: 400
    });

    const prompts = response.choices?.map((choice) => choice.message?.content).filter(Boolean) || [];
    return res.json({ prompts });
  } catch (err) {
    console.error("Prompt generation error:", err);
    return res.status(500).json({ error: "Fehler bei der Prompt-Generierung" });
  }
}


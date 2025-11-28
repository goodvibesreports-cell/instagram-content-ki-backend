require("dotenv").config();
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generatePrompt(req, res) {
  try {
    const data = req.body || {};
    if (!Object.keys(data).length) {
      return res.status(400).json({ success: false, message: "Keine Daten übergeben" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist ein professioneller Social Media Content Creator." },
        { role: "user", content: `Analysiere diese Daten und generiere 3-5 virale Prompts: ${JSON.stringify(data)}` }
      ],
      max_completion_tokens: 400
    });

    const prompts = response.choices?.map((choice) => choice.message?.content).filter(Boolean) || [];
    return res.json({ success: true, prompts });
  } catch (err) {
    console.error("Prompt generation error:", err);
    return res.status(500).json({ success: false, message: "Fehler bei der Prompt-Generierung" });
  }
}

module.exports = { generatePrompt };


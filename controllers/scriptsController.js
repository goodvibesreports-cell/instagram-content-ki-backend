const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

const generateScripts = async (req, res) => {
  try {
    const { prompts } = req.body;
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: 'Keine Prompts übergeben' });
    }

    const videoIdeas = [];

    for (let prompt of prompts) {
      const response = await openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Du bist ein professioneller Social Media Video Creator.' },
          { role: 'user', content: `Erstelle aus folgendem Prompt ein kurzes Instagram-Reel-Skript mit Handlung, Voiceover, Hashtags: "${prompt}"` }
        ],
        max_tokens: 500
      });

      const idea = response.data.choices[0].message.content;
      videoIdeas.push({ prompt, idea });
    }

    res.json({ videoIdeas });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler bei der Videoideen-Generierung' });
  }
};

module.exports = { generateScripts };

const { Configuration, OpenAIApi } = require('openai');
const validateData = require('../utils/validateData');
require('dotenv').config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

const generatePrompt = async (req, res) => {
  try {
    const data = req.body;
    const { valid, error } = validateData(data);
    if (!valid) return res.status(400).json({ error });

    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Du bist ein professioneller Social Media Content Creator.' },
        { role: 'user', content: `Analysiere diese Daten und generiere 3-5 virale Prompts: ${JSON.stringify(data)}` }
      ],
      max_tokens: 400
    });

    const prompts = response.data.choices.map(c => c.message.content);
    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler bei der Prompt-Generierung' });
  }
};

module.exports = { generatePrompt };

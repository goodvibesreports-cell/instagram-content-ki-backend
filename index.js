import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: 'uploads/' });

// Speicher für hochgeladene Posts
let uploadedPosts = [];

// Healthcheck
app.get('/healthz', (req, res) => res.json({ status: 'OK' }));

// Datei-Upload
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const data = await fs.readFile(req.file.path, 'utf-8');
    let json;
    try {
      json = JSON.parse(data);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }
    if (!Array.isArray(json)) return res.status(400).json({ error: 'JSON must be an array of posts' });

    uploadedPosts = json;
    await fs.unlink(req.file.path);

    res.json({ message: `Upload erfolgreich: ${uploadedPosts.length} Posts` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Dynamische Prompts generieren
app.post('/generate-prompts', async (req, res) => {
  try {
    const { category } = req.body;
    if (!uploadedPosts.length) return res.status(400).json({ error: 'No posts uploaded' });

    const systemMessage = `Du bist ein professioneller Social Media Content Creator. Analysiere die Posts und generiere 3-5 virale Instagram-Reel-Prompts.`;

    const userMessage = category 
      ? `Kategorie: ${category}. Analysiere diese Posts und erstelle Prompts in dieser Kategorie:\n${JSON.stringify(uploadedPosts)}`
      : `Analysiere diese Posts und erstelle 3-5 virale Prompts:\n${JSON.stringify(uploadedPosts)}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500
    });

    const prompts = response.choices.map(c => c.message.content);
    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Prompt generation failed' });
  }
});

// Videoideen generieren
app.post('/generate-video-ideas', async (req, res) => {
  try {
    const { prompts } = req.body;
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: 'No prompts provided' });
    }

    const videoIdeas = [];
    for (let prompt of prompts) {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du bist ein professioneller Social Media Video Creator.' },
          { role: 'user', content: `Erstelle aus folgendem Prompt ein Instagram-Reel-Skript mit Handlung, Voiceover, Text und Hashtags: "${prompt}"` }
        ],
        max_tokens: 500
      });
      videoIdeas.push({ prompt, idea: response.choices[0].message.content });
    }

    res.json({ videoIdeas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Video ideas generation failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

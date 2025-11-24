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
let uploadedPosts = [];

// Healthcheck
app.get('/healthz', (req, res) => res.json({ status: 'OK' }));

// Datei-Upload
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = await fs.readFile(req.file.path, 'utf-8');
    const json = JSON.parse(data);
    uploadedPosts = json;
    await fs.unlink(req.file.path);
    res.json({ message: `Upload erfolgreich: ${uploadedPosts.length} Posts` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Content generieren
app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt missing' });
    if (!uploadedPosts.length) return res.status(400).json({ error: 'No posts uploaded' });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: `${prompt}\n\n${JSON.stringify(uploadedPosts)}` }
      ]
    });

    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

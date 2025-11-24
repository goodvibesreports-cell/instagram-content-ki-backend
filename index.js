// index.js
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Upload Endpoint
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
  }

  const file = req.files.file;
  const data = file.data.toString('utf8');

  try {
    let json;
    if (file.name.endsWith('.csv')) {
      // CSV → JSON konvertieren (einfaches Beispiel)
      const lines = data.split('\n');
      const headers = lines.shift().split(',');
      json = lines.map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim() || '';
        });
        return obj;
      });
    } else if (file.name.endsWith('.json')) {
      json = JSON.parse(data);
    } else {
      return res.status(400).json({ error: 'Nur CSV oder JSON erlaubt.' });
    }
    res.json({ data: json });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Einlesen der Datei.', details: err.message });
  }
});

// Generate Endpoint
app.post('/generate', async (req, res) => {
  const posts = req.body.posts;
  if (!posts || !Array.isArray(posts)) {
    return res.status(400).json({ error: 'Keine Posts übergeben.' });
  }

  try {
    const suggestions = [];
    for (const post of posts) {
      const prompt = `Erstelle einen neuen Social-Media-Post basierend auf: ${JSON.stringify(post)}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });
      suggestions.push(completion.choices[0].message.content);
    }
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'OpenAI Fehler', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

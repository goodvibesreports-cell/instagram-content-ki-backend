"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PLATFORM_TEMPLATES = void 0;
const PLATFORM_TEMPLATES = exports.PLATFORM_TEMPLATES = {
  instagram: {
    label: "Instagram Reels",
    prompt: `Sprache: Deutsch, Tempo hoch, Jump-Cuts.
Hook < 3 Sekunden, Emojis erlaubt, 3-5 Hashtags. CTA: Kommentare/Saves.`
  },
  tiktok: {
    label: "TikTok",
    prompt: `Ton: frech, Cuts aggressiv, Trend-Sounds erwähnen.
Mutige Statements, Meme-Potenzial, CTA: Duetten oder Stitch.`
  },
  youtube: {
    label: "YouTube Shorts",
    prompt: `Storytelling, Aufbau Spannung, Hook 5 Sekunden möglich.
Call-To-Action auf Kanal/Playlist.`
  },
  twitter: {
    label: "Twitter/X Clips",
    prompt: `Kurze Statements, Thought-Leadership, klare Messages, CTA: Reply oder Quote.`
  },
  linkedin: {
    label: "LinkedIn Video",
    prompt: `Professionell, Mehrwert, Business Cases, CTA: Insights teilen oder diskutieren.`
  }
};
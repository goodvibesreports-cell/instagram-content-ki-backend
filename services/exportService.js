"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateInsightsCsv = generateInsightsCsv;
exports.generateInsightsPdf = generateInsightsPdf;
var _pdfkit = _interopRequireDefault(require("pdfkit"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  return Buffer.from(parts[1], "base64");
}
async function fetchImageBuffer(url) {
  try {
    if (!url || typeof fetch !== "function") return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
async function generateInsightsPdf({
  analysis = {},
  videos = [],
  creatorDNA = {},
  aiSummary = null,
  meta = {},
  datasetName = "TikTok Export",
  profileName = "Creator",
  charts = []
} = {}) {
  const chartBuffers = charts.map(chart => ({
    title: chart.title,
    buffer: dataUrlToBuffer(chart.dataUrl || chart.image)
  }));
  const videoImages = await Promise.all(videos.slice(0, 3).map(async video => ({
    ...video,
    imageBuffer: await fetchImageBuffer(video.coverImage)
  })));
  return await new Promise((resolve, reject) => {
    const doc = new _pdfkit.default({
      size: "A4",
      margin: 40
    });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const now = new Date().toLocaleString("de-DE");
    doc.fontSize(20).fillColor("#111827").text("TikTok Performance Report", {
      align: "center"
    });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor("#6b7280").text(`Erstellt am ${now}`, {
      align: "center"
    });
    doc.moveDown();
    doc.fontSize(12).fillColor("#374151").text(`Creator: ${profileName}`, {
      continued: false
    });
    doc.text(`Dataset: ${datasetName}`);
    doc.text(`Analysierte Links: ${meta.processed_links_count ?? 0}`);
    doc.moveDown();
    doc.fontSize(14).fillColor("#111827").text("Key Metrics");
    doc.moveDown(0.3);
    const stats = analysis.stats || {};
    const summaryRows = [["Total Posts", stats.totalPosts ?? "-"], ["Average Likes", stats.avgLikes ? Math.round(stats.avgLikes) : "-"], ["Median Likes", stats.medianLikes ? Math.round(stats.medianLikes) : "-"], ["Best Hour", analysis.bestTimes?.bestHour ?? "-"], ["Best Day", analysis.bestDays?.bestDay ?? "-"]];
    summaryRows.forEach(([label, value]) => {
      doc.fontSize(12).fillColor("#111827").text(`${label}: `, {
        continued: true
      });
      doc.fillColor("#1f2937").text(String(value));
    });
    doc.moveDown();
    if (chartBuffers.some(chart => chart.buffer)) {
      doc.fontSize(14).fillColor("#111827").text("Performance Charts");
      doc.moveDown(0.3);
      chartBuffers.forEach(chart => {
        if (chart.buffer) {
          doc.fontSize(12).fillColor("#374151").text(chart.title || "Chart");
          doc.moveDown(0.2);
          doc.image(chart.buffer, {
            fit: [480, 220],
            align: "center"
          });
          doc.moveDown(0.6);
        }
      });
    }
    doc.addPage();
    doc.fontSize(14).fillColor("#111827").text("Creator DNA");
    doc.moveDown(0.4);
    const dnaRows = [["Tone", creatorDNA.tone || "-"], ["Mood", creatorDNA.mood || "-"], ["Narrative Style", creatorDNA.narrativeStyle || "-"], ["Posting Behavior", creatorDNA.postingBehavior || "-"]];
    dnaRows.forEach(([label, value]) => {
      doc.fontSize(12).fillColor("#111827").text(`${label}: `, {
        continued: true
      });
      doc.fillColor("#1f2937").text(value);
    });
    if (creatorDNA.contentPatterns?.length) {
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor("#111827").text("Content Patterns:");
      creatorDNA.contentPatterns.slice(0, 5).forEach(pattern => {
        doc.fontSize(11).fillColor("#374151").text(`• ${pattern}`);
      });
    }
    doc.moveDown();
    doc.fontSize(14).fillColor("#111827").text("Top Videos");
    doc.moveDown(0.3);
    videoImages.forEach((video, index) => {
      doc.fontSize(12).fillColor("#111827").text(`${index + 1}. ${video.title || "TikTok Video"}`);
      doc.fontSize(11).fillColor("#374151").text(`Likes: ${video.likes ?? 0} | Datum: ${video.timestamp || "-"}`);
      if (video.imageBuffer) {
        doc.moveDown(0.2);
        doc.image(video.imageBuffer, {
          fit: [460, 200],
          align: "center"
        });
      }
      doc.moveDown(0.8);
    });
    if (aiSummary) {
      doc.addPage();
      doc.fontSize(14).fillColor("#111827").text("AI Summary & Recommendations");
      doc.moveDown(0.4);
      const items = [["Best Time Strategy", aiSummary.bestTimeStrategy], ["Content Style", aiSummary.contentStyle], ["Hook Type", aiSummary.hookType], ["Posting Frequency", aiSummary.postingFrequency], ["What To Stop Doing", aiSummary.stopDoing]];
      items.forEach(([label, value]) => {
        if (!value) return;
        doc.fontSize(12).fillColor("#111827").text(`${label}:`);
        doc.fontSize(11).fillColor("#374151").text(value);
        doc.moveDown(0.5);
      });
    }
    doc.end();
  });
}
function generateInsightsCsv(posts = []) {
  const header = ["date", "link", "likes", "caption", "sound", "location", "hourPosted", "dayPosted", "engagementScore"];
  const rows = posts.map(post => {
    const date = post.date || post.timestamp || post.createdAt || null;
    const parsedDate = date ? new Date(date) : null;
    const hourPosted = parsedDate ? parsedDate.getHours() : "";
    const dayPosted = parsedDate ? parsedDate.toLocaleDateString("de-DE", {
      weekday: "long"
    }) : "";
    const likes = Number(post.likes) || 0;
    const comments = Number(post.comments) || 0;
    const views = Number(post.views) || 0;
    const engagementScore = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : "0";
    return [parsedDate ? parsedDate.toISOString() : "", post.link || "", likes, (post.caption || post.title || "").replace(/\r?\n/g, " "), post.sound || "", post.location || "", hourPosted, dayPosted, engagementScore];
  });
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  return Buffer.from(csv, "utf8");
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseFacebookHtml = parseFacebookHtml;
exports.toUnifiedItems = toUnifiedItems;
var _cheerio = require("cheerio");
var _normalizedPost = require("./normalizedPost.js");
function parseNumber(text = "", labelRegex) {
  if (!text) return 0;
  const match = text.match(labelRegex);
  if (!match) return 0;
  const value = match[2] ?? match[1];
  return Number(value.replace(/[.\s,]/g, "")) || 0;
}
function parseDateValue(value = "", fallbackText = "") {
  if (value) {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      const parsed = new Date(numeric > 9999999999 ? numeric : numeric * 1000);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  if (fallbackText) {
    const parsed = new Date(fallbackText);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}
function parseFacebookHtml(html, fileName = "facebook.html") {
  const posts = [];
  if (!html || typeof html !== "string") {
    return posts;
  }
  const $ = (0, _cheerio.load)(html);
  $("a[href*='facebook.com']").each((_, anchor) => {
    const url = $(anchor).attr("href");
    if (!url || !url.includes("facebook.com")) return;
    const container = $(anchor).closest("div").length ? $(anchor).closest("div") : $(anchor).parent();
    const timeElement = container.find("time").first();
    const rawDate = timeElement.attr("data-utime") || timeElement.attr("datetime") || timeElement.text();
    const isoDate = parseDateValue(rawDate, timeElement.text());
    const caption = container.find(".content").text().trim() || container.clone().children("a,time").remove().end().text().trim();
    const likes = parseNumber(container.text(), /(reactions?|likes?|Gefällt mir)\D*([\d.,]+)/i);
    const comments = parseNumber(container.text(), /(comments?|kommentare)\D*([\d.,]+)/i);
    const shares = parseNumber(container.text(), /(shares?|geteilte? beiträge)\D*([\d.,]+)/i);
    posts.push({
      platform: "facebook",
      id: url,
      url,
      caption,
      date: isoDate,
      likes,
      comments,
      shares,
      raw: {
        fileName,
        url,
        caption,
        rawDate
      }
    });
  });
  return posts;
}
function toUnifiedItems(facebookPosts = [], meta = {}) {
  return facebookPosts.map(post => (0, _normalizedPost.createNormalizedPost)({
    platform: "facebook",
    id: post.id || post.url,
    link: post.url || "",
    date: post.date || new Date().toISOString(),
    likes: post.likes || 0,
    comments: post.comments || 0,
    shares: post.shares || 0,
    caption: post.caption || "",
    hashtags: (post.caption || "").match(/#([a-z0-9_]+)/gi)?.map(tag => tag.replace("#", "").toLowerCase()) || [],
    meta: {
      sourceFile: meta.fileName,
      raw: post.raw || post
    }
  })).filter(Boolean);
}
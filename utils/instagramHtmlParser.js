import { load } from "cheerio";
import { createNormalizedPost } from "./normalizedPost.js";

function parseNumberFromText(text = "", pattern) {
  if (!text) return 0;
  const match = text.match(pattern);
  if (!match) return 0;
  const value = match[2] ?? match[1];
  return Number(value.replace(/[.\s,]/g, "")) || 0;
}

function parseDateValue(value = "") {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    const parsed = new Date(numeric > 9999999999 ? numeric : numeric * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function parseInstagramHtml(html, fileName = "instagram.html") {
  const posts = [];
  if (!html || typeof html !== "string") {
    return posts;
  }

  const $ = load(html);
  $("a[href*='instagram.com/p/']").each((_, anchor) => {
    const url = $(anchor).attr("href");
    if (!url) return;
    const container = $(anchor).closest("div").length ? $(anchor).closest("div") : $(anchor).parent();
    const timeElement = container.find("time").first();
    const rawDate = timeElement.attr("datetime") || timeElement.attr("title") || timeElement.text();
    const isoDate = parseDateValue(rawDate);
    const caption =
      container.find(".caption").text().trim() ||
      container.find("blockquote").text().trim() ||
      container.clone().children("a,time").remove().end().text().trim();
    const likes = parseNumberFromText(container.text(), /(likes?|Gefällt mir)\D*([\d.,]+)/i);
    const comments = parseNumberFromText(container.text(), /(comments?|Kommentare)\D*([\d.,]+)/i);

    posts.push({
      platform: "instagram",
      id: url,
      url,
      caption,
      date: isoDate,
      likes,
      comments,
      raw: { fileName, url, caption, rawDate }
    });
  });
  return posts;
}

export function toUnifiedItems(instagramPosts = [], meta = {}) {
  return instagramPosts
    .map((post) =>
      createNormalizedPost({
        platform: "instagram",
        id: post.id || post.url,
        link: post.url || "",
        date: post.date || new Date().toISOString(),
        likes: post.likes || 0,
        comments: post.comments || 0,
        caption: post.caption || "",
        hashtags: (post.caption || "").match(/#([a-z0-9_]+)/gi)?.map((tag) => tag.replace("#", "").toLowerCase()) || [],
        meta: {
          sourceFile: meta.fileName,
          raw: post.raw || post
        }
      })
    )
    .filter(Boolean);
}



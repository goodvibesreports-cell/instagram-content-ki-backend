import { createNormalizedPost } from "../normalizedPost.js";

export function parseFacebookJson(payload) {
  try {
    if (!payload || typeof payload !== "object") return [];
    const postsArray = Array.isArray(payload.posts) ? payload.posts : Array.isArray(payload) ? payload : [];
    return postsArray
      .map((item) => {
        const date = item.published_time || item.created_time || item.date;
        const isoDate = date ? new Date(date).toISOString() : new Date().toISOString();
        return createNormalizedPost({
          id: item.id || item.post_id || item.permalink_url || item.url,
          platform: "facebook",
          date: isoDate,
          link: item.permalink_url || item.link || "",
          likes: Number(item.reactions || item.likes || 0),
          comments: Number(item.comments || 0),
          shares: Number(item.shares || item.share_count || 0),
          caption: item.message || item.story || "",
          location: item.place?.name || "",
          meta: {
            mediaType: item.type || "",
            attachments: item.attachments || [],
            raw: item
          }
        });
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("[Parser] Facebook JSON konnte nicht verarbeitet werden:", error.message);
    return [];
  }
}



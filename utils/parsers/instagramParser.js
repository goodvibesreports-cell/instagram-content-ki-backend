import { createNormalizedPost } from "../normalizedPost.js";

export function parseInstagramJson(payload) {
  try {
    if (!payload || typeof payload !== "object") return [];
    const mediaItems = Array.isArray(payload?.media) ? payload.media : Array.isArray(payload) ? payload : [];
    return mediaItems
      .map((item) => {
        const date = item.taken_at || item.timestamp || item.created_time;
        const isoDate = date ? new Date(date).toISOString() : new Date().toISOString();
        return createNormalizedPost({
          id: item.id || item.code || item.permalink || item.url,
          platform: "instagram",
          date: isoDate,
          link: item.permalink || item.url || "",
          likes: Number(item.like_count || item.likes || 0),
          comments: Number(item.comment_count || item.comments || 0),
          caption: item.caption || item.title || "",
          location: item.location || "",
          views: Number(item.play_count || 0),
          meta: {
            hashtags: (item.caption || "").match(/#([a-z0-9_]+)/gi)?.map((tag) => tag.replace("#", "").toLowerCase()) || [],
            mediaType: item.media_type || item.type || "",
            raw: item
          }
        });
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("[Parser] Instagram JSON konnte nicht verarbeitet werden:", error.message);
    return [];
  }
}



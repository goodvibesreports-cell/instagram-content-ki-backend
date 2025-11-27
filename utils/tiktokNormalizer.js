import { parseTikTokExport } from "./tiktokParser.js";

export function normalizeTikTokJson(json, sourceFileName = "unknown") {
  const result = parseTikTokExport(json, sourceFileName);
  const videos = result.videos || [];
  const deletedCount = videos.filter((video) => video.isDeleted).length;

  return {
    videos,
    deletedCount,
    ignoredEntries: result.ignoredEntries || []
  };
}


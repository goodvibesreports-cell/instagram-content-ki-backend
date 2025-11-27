import { detectPlatform, PLATFORM_DATA_TYPES } from "./platformDetector.js";
import { normalizeTikTokJson } from "./tiktokNormalizer.js";

function mergeIgnoredEntries(target, source = []) {
  source.forEach((entry) => {
    const existing = target.find((item) => item.reason === entry.reason);
    if (existing) {
      existing.count += entry.count;
      entry.examples.forEach((example) => {
        if (existing.examples.length < 5 && !existing.examples.includes(example)) {
          existing.examples.push(example);
        }
      });
    } else {
      target.push({ ...entry, examples: [...entry.examples] });
    }
  });
}

export function parseFolderFiles(fileEntries = []) {
  const summary = {
    totalFiles: fileEntries.length,
    processedFiles: 0,
    ignoredFiles: 0,
    ignoredEntries: []
  };

  const videos = [];
  let deletedCount = 0;

  fileEntries.forEach(({ buffer, fileName }) => {
    if (!buffer) {
      summary.ignoredFiles += 1;
      return;
    }

    let json;
    try {
      json = JSON.parse(buffer.toString("utf8"));
    } catch (error) {
      summary.ignoredFiles += 1;
      mergeIgnoredEntries(summary.ignoredEntries, [
        {
          reason: "invalid_json",
          count: 1,
          examples: [`${fileName}: ${error.message}`]
        }
      ]);
      return;
    }

    const detection = detectPlatform(json, fileName);
    if (detection.platform !== "tiktok" || detection.dataType === PLATFORM_DATA_TYPES.UNKNOWN) {
      summary.ignoredFiles += 1;
      return;
    }

    const normalized = normalizeTikTokJson(json, fileName);
    videos.push(...normalized.videos);
    deletedCount += normalized.deletedCount;
    summary.processedFiles += 1;
    mergeIgnoredEntries(summary.ignoredEntries, normalized.ignoredEntries);
  });

  return {
    videos,
    deletedCount,
    summary
  };
}


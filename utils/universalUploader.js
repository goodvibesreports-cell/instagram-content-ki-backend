import path from "path";
import AdmZip from "adm-zip";
import { detectPlatform, PLATFORM_DATA_TYPES } from "./platformDetector.js";
import { parseTikTokExport } from "./tiktokParser.js";
import { normalizedFromTikTokVideo } from "./normalizedPost.js";

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_MIME_TYPES = new Set(["application/zip", "application/x-zip-compressed", "multipart/x-zip"]);
const JSON_MIME_TYPES = new Set(["application/json", "text/json", "text/plain"]);
const TEXTUAL_EXTENSIONS = new Set([".json", ".txt", ".log"]);
const ZIP_EXTENSIONS = new Set([".zip"]);

function mergeIgnoredEntries(target, source = []) {
  source.forEach((entry) => {
    const existing = target.find((item) => item.reason === entry.reason);
    if (existing) {
      existing.count += entry.count;
      entry.examples?.forEach((example) => {
        if (existing.examples.length < 5 && !existing.examples.includes(example)) {
          existing.examples.push(example);
        }
      });
    } else {
      target.push({
        reason: entry.reason,
        count: entry.count,
        examples: Array.isArray(entry.examples) ? [...entry.examples] : []
      });
    }
  });
}

function toInternalFile(file = {}) {
  if (!file || !file.buffer) {
    throw new Error("Ungültige Dateiinstanz");
  }
  return {
    buffer: file.buffer,
    fileName: file.originalname || file.fileName || "upload.json",
    mimetype: file.mimetype || "",
    size: typeof file.size === "number" ? file.size : file.buffer.length || 0
  };
}

function looksLikeZip(buffer) {
  if (!buffer || buffer.length < ZIP_SIGNATURE.length) return false;
  return ZIP_SIGNATURE.every((byte, index) => buffer[index] === byte);
}

export function detectFileType(file = {}) {
  const extension = path.extname(file.fileName || "").toLowerCase();
  if (ZIP_EXTENSIONS.has(extension) || ZIP_MIME_TYPES.has(file.mimetype) || looksLikeZip(file.buffer)) {
    return "zip";
  }
  if (TEXTUAL_EXTENSIONS.has(extension) || JSON_MIME_TYPES.has(file.mimetype)) {
    return "json";
  }
  if (extension === ".csv") return "csv";
  if (extension === ".html" || extension === ".htm") return "html";
  if (extension) return extension.replace(".", "");
  return file.mimetype || "unknown";
}

export function expandZip(buffer, parentName = "archive.zip") {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  return entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      buffer: entry.getData(),
      fileName: `${parentName}:${entry.entryName}`,
      mimetype: "",
      size: entry.header.size || entry.getData().length || 0
    }));
}

export function autoCollectRelevantFiles(files = []) {
  const queue = files
    .filter(Boolean)
    .map((file) => {
      try {
        return toInternalFile(file);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const collected = [];
  const ignored = [];

  while (queue.length) {
    const current = queue.shift();
    const type = detectFileType(current);
    if (type === "zip") {
      try {
        const expanded = expandZip(current.buffer, current.fileName);
        queue.push(...expanded);
      } catch (error) {
        ignored.push({ fileName: current.fileName, reason: `zip_extract_failed: ${error.message}` });
      }
      continue;
    }
    if (type === "json") {
      collected.push({ ...current, detectedType: type });
    } else {
      ignored.push({ fileName: current.fileName, reason: `unsupported_type:${type}` });
    }
  }

  return { collected, ignored };
}

export function detectPlatformAndContent(json, fileName) {
  return detectPlatform(json, fileName);
}

function normalizeTikTokPayload(json, fileName) {
  const parsed = parseTikTokExport(json, fileName);
  const normalizedPosts = parsed.videos
    .map((video) => normalizedFromTikTokVideo({ ...video, sourceFile: fileName }))
    .filter(Boolean);
  return {
    platform: "tiktok",
    detectedType: parsed.sourceType || PLATFORM_DATA_TYPES.POSTS,
    videos: parsed.videos,
    normalizedPosts,
    ignoredEntries: parsed.ignoredEntries,
    rawSnippet: parsed.rawJsonSnippet,
    totals: parsed.totals
  };
}

function normalizePayloadByPlatform(json, fileName, platform) {
  if (platform === "tiktok") {
    return normalizeTikTokPayload(json, fileName);
  }
  return {
    platform,
    detectedType: PLATFORM_DATA_TYPES.UNKNOWN,
    videos: [],
    normalizedPosts: [],
    ignoredEntries: [],
    rawSnippet: null,
    totals: { videos: 0, ignored: 0, watchHistory: 0 }
  };
}

export function normalize(json, fileName, platform = "tiktok") {
  return normalizePayloadByPlatform(json, fileName, platform);
}

function parseJsonBuffer(entry) {
  const rawText = entry.buffer.toString("utf8");
  return JSON.parse(rawText);
}

function emptyAggregate(totalFiles) {
  return {
    platform: "unknown",
    detectedType: PLATFORM_DATA_TYPES.UNKNOWN,
    videos: [],
    normalizedPosts: [],
    ignoredEntries: [],
    rawSnippet: null,
    totals: { videos: 0, ignored: 0, watchHistory: 0 },
    summary: {
      totalFiles,
      processedFiles: 0,
      ignoredFiles: 0,
      ignoredFilesDetail: []
    },
    rawFilesMeta: []
  };
}

export function processCollectedFiles(collected = [], { platformHint, totalFiles } = {}) {
  const aggregate = emptyAggregate(typeof totalFiles === "number" ? totalFiles : collected.length);

  collected.forEach((entry) => {
    let json;
    try {
      json = parseJsonBuffer(entry);
    } catch (error) {
      aggregate.summary.ignoredFiles += 1;
      aggregate.summary.ignoredFilesDetail.push({
        fileName: entry.fileName,
        reason: `invalid_json:${error.message}`
      });
      return;
    }

    const detection = detectPlatformAndContent(json, entry.fileName);
    const platform = platformHint || detection.platform;
    if (platform === "unknown") {
      aggregate.summary.ignoredFiles += 1;
      aggregate.summary.ignoredFilesDetail.push({
        fileName: entry.fileName,
        reason: `unrecognized_platform:${detection.reason}`
      });
      return;
    }

    const normalized = normalizePayloadByPlatform(json, entry.fileName, platform);
    aggregate.platform = normalized.platform;
    aggregate.detectedType = normalized.detectedType || detection.dataType;
    aggregate.videos.push(...normalized.videos);
    aggregate.normalizedPosts.push(...normalized.normalizedPosts);
    aggregate.rawFilesMeta.push({
      fileName: entry.fileName,
      fileSize: entry.size,
      platform: platform,
      dataType: detection.dataType,
      confidence: detection.confidence
    });
    aggregate.summary.processedFiles += 1;
    aggregate.totals.videos += normalized.totals.videos;
    aggregate.totals.ignored += normalized.totals.ignored;
    aggregate.totals.watchHistory += normalized.totals.watchHistory;
    mergeIgnoredEntries(aggregate.ignoredEntries, normalized.ignoredEntries);
    if (!aggregate.rawSnippet && normalized.rawSnippet) {
      aggregate.rawSnippet = normalized.rawSnippet;
    }
  });

  return aggregate;
}

export function processSingleFileUpload(file, options = {}) {
  const { collected, ignored } = autoCollectRelevantFiles([file]);
  const aggregate = processCollectedFiles(collected, {
    ...options,
    totalFiles: options.totalFiles ?? (collected.length || 1) + ignored.length
  });
  aggregate.summary.ignoredFilesDetail.push(...ignored);
  aggregate.summary.ignoredFiles += ignored.length;
  return aggregate;
}

export function processFolderUpload(files = [], options = {}) {
  const { collected, ignored } = autoCollectRelevantFiles(files);
  const aggregate = processCollectedFiles(collected, {
    ...options,
    totalFiles: options.totalFiles ?? (files?.length ?? collected.length + ignored.length)
  });
  aggregate.summary.ignoredFilesDetail.push(...ignored);
  aggregate.summary.totalFiles += ignored.length;
  aggregate.summary.ignoredFiles += ignored.length;
  return aggregate;
}



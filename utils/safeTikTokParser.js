const { Readable } = require("stream");
const { parser } = require("stream-json");

const FIVE_MB = 5 * 1024 * 1024;
const SAMPLE_BYTES = 128 * 1024;
const STREAM_DEPTH_LIMIT = 6;
const BLOCKED_LINK_PREFIX = "https://www.tiktokv.com/share/video/";
const BASE64_PATTERNS = [/data:video\/mp4;base64/i, /data:image\/jpeg;base64/i, /data:image\/png;base64/i];
const KEY_WHITELIST = new Set(["Date", "Link", "Description", "Sound", "Likes", "Comments", "Views"]);

const DEFAULT_FLAGS = {
  usedSafeParser: true
};

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (["n/a", "none", "null", "undefined"].includes(trimmed.toLowerCase())) {
    return "";
  }
  return trimmed;
}

function sanitizeLink(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("tiktok")) return null;
  return trimmed;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  const candidate = String(value).trim();
  if (!candidate) return null;
  const normalized = candidate.includes("T") ? candidate : candidate.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summarizeIgnored(reason, example, store) {
  if (!reason) return;
  const entry = store.get(reason) || { reason, count: 0, examples: [] };
  entry.count += 1;
  if (example && entry.examples.length < 5 && !entry.examples.includes(example)) {
    entry.examples.push(example);
  }
  store.set(reason, entry);
}

function normalizeRecord(record) {
  const link = sanitizeLink(record.Link);
  if (!link || link.startsWith(BLOCKED_LINK_PREFIX)) {
    return null;
  }
  const date = normalizeDate(record.Date);
  if (!date) {
    return null;
  }
  return {
    platform: "tiktok",
    date: date.toISOString(),
    timestamp: date.getTime(),
    link,
    caption: sanitizeText(record.Description),
    title: sanitizeText(record.Description),
    sound: sanitizeText(record.Sound),
    likes: toNumber(record.Likes),
    comments: toNumber(record.Comments),
    views: toNumber(record.Views),
    sourceSection: "safe-parser"
  };
}

async function safeTikTokParser(buffer, { fileName = "upload.json", maxBytes = FIVE_MB, streaming = false } = {}) {
  const flags = { ...DEFAULT_FLAGS, streaming: Boolean(streaming) };
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      primaryPlatform: "tiktok",
      items: [],
      ignoredEntries: [{ reason: "invalid-buffer", fileName }],
      totals: { scanned: 0, parsed: 0, ignored: 0 },
      flags,
      rawSnippet: null,
      summary: { message: "Kein gültiger Buffer" }
    };
  }

  const truncated = buffer.length > maxBytes;
  flags.truncated = truncated;
  const limitedBuffer = truncated ? buffer.slice(0, maxBytes) : buffer;

  const sample = limitedBuffer.slice(0, Math.min(SAMPLE_BYTES, limitedBuffer.length)).toString("utf8");
  const rawSnippet = sample.split("\n").slice(0, 20).join("\n");

  if (BASE64_PATTERNS.some((pattern) => pattern.test(sample))) {
    flags.heavyBase64Detected = true;
    return {
      primaryPlatform: "tiktok",
      items: [],
      ignoredEntries: [
        {
          reason: "heavy_base64_blocked",
          detail: "Eingebettete Base64 Medien erkannt",
          fileName
        }
      ],
      totals: { scanned: 0, parsed: 0, ignored: 1 },
      flags,
      rawSnippet,
      summary: { message: "Abgebrochen wegen Base64-Medien im Export" }
    };
  }

  return new Promise((resolve) => {
    const ignoredMap = new Map();
    const posts = [];
    const totals = { scanned: 0, parsed: 0, ignored: 0 };

    let resolved = false;
    const done = (extra = {}) => {
      if (resolved) return;
      resolved = true;
      const ignoredEntries = [...ignoredMap.values()];
      resolve({
        primaryPlatform: "tiktok",
        items: posts,
        ignoredEntries,
        totals,
        flags: { ...flags, ...extra.flags },
        rawSnippet,
        summary: {
          totalPosts: posts.length,
          ignored: totals.ignored,
          truncated
        }
      });
    };

    const stream = Readable.from(limitedBuffer);
    const jsonParser = parser();
    const stack = [];

    jsonParser.on("data", (token) => {
      const current = stack[stack.length - 1];
      switch (token.name) {
        case "startObject": {
          if (stack.length >= STREAM_DEPTH_LIMIT) {
            stack.push({ skip: true });
          } else {
            stack.push({ skip: false, data: {}, currentKey: null });
          }
          break;
        }
        case "endObject": {
          stack.pop();
          if (!current || current.skip) break;
          totals.scanned += 1;
          const normalized = normalizeRecord(current.data);
          if (normalized) {
            posts.push(normalized);
            totals.parsed += 1;
          } else {
            totals.ignored += 1;
            summarizeIgnored("invalid_video_entry", current.data?.Link, ignoredMap);
          }
          break;
        }
        case "keyValue": {
          if (current && !current.skip) {
            current.currentKey = token.value;
          }
          break;
        }
        case "stringValue":
        case "numberValue":
        case "nullValue":
        case "trueValue":
        case "falseValue": {
          if (!current || current.skip || !current.currentKey) break;
          if (KEY_WHITELIST.has(current.currentKey)) {
            current.data[current.currentKey] = token.value;
          }
          current.currentKey = null;
          break;
        }
        default:
          break;
      }
    });

    jsonParser.on("error", (error) => {
      summarizeIgnored("parse_error", error.message, ignoredMap);
      done({ flags: { parseError: error.message } });
    });

    jsonParser.on("end", () => done());

    stream.on("error", (error) => {
      summarizeIgnored("stream_error", error.message, ignoredMap);
      done({ flags: { streamError: error.message } });
    });

    stream.pipe(jsonParser);
  });
}

module.exports = safeTikTokParser;


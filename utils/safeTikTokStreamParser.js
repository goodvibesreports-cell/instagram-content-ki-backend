const { Readable } = require("stream");
const { parser } = require("stream-json");

const FIELD_MAP = {
  date: ["Date", "date", "timestamp", "createTime", "create_time"],
  link: ["Link", "link", "url"],
  likes: ["Likes", "likes", "diggCount", "likeCount"],
  comments: ["Comments", "commentCount", "comments", "comment_count"],
  views: ["Views", "playCount", "views", "play_count"],
  description: ["Description", "desc", "title", "caption"],
  sound: ["Sound", "sound"]
};

const BASE64_PATTERNS = [/data:video\/mp4;base64/i, /data:image\/jpeg;base64/i, /data:image\/png;base64/i];
const MAX_DEPTH = 6;
const STREAM_THRESHOLD = 10 * 1024 * 1024;
const METADATA_ONLY_THRESHOLD = 250 * 1024 * 1024;
const SAMPLE_BYTES = 512 * 1024;

function sanitizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || ["null", "undefined", "n/a"].includes(trimmed.toLowerCase())) {
    return "";
  }
  return trimmed;
}

function sanitizeLink(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes("tiktok")) return null;
  return trimmed;
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchField(key) {
  if (!key) return null;
  const lower = key.toLowerCase();
  return Object.entries(FIELD_MAP).find(([, aliases]) => aliases.some((alias) => alias.toLowerCase() === lower))?.[0] || null;
}

function containsBase64(text = "") {
  if (typeof text !== "string") return false;
  return BASE64_PATTERNS.some((pattern) => pattern.test(text));
}

function createStream(input, limitBytes) {
  if (Buffer.isBuffer(input)) {
    const buffer = limitBytes ? input.slice(0, limitBytes) : input;
    return Readable.from(buffer);
  }
  return input;
}

async function safeTikTokStreamParser(buffer, { fileName = "upload.json", fileSize = 0 } = {}) {
  const posts = [];
  const ignored = [];
  const errors = [];
  const flags = {
    streamed: fileSize >= STREAM_THRESHOLD || buffer.length >= STREAM_THRESHOLD,
    metadataOnly: fileSize >= METADATA_ONLY_THRESHOLD,
    fileName
  };

  const limitedBytes = flags.metadataOnly ? SAMPLE_BYTES : null;
  const stream = createStream(buffer, limitedBytes);
  let resolved = false;

  const snippet = buffer?.slice?.(0, SAMPLE_BYTES).toString("utf8") || "";

  const finalize = () => ({
    posts,
    ignored,
    errors,
    flags,
    rawSnippet: snippet.split("\n").slice(0, 20).join("\n")
  });

  return new Promise((resolve) => {
    const jsonParser = parser();
    const stack = [];

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(finalize());
    };

    jsonParser.on("data", (token) => {
      if (resolved) return;
      const current = stack[stack.length - 1];
      switch (token.name) {
        case "startObject": {
          if (stack.length >= MAX_DEPTH) {
            stack.push({ skip: true });
          } else {
            stack.push({ skip: false, target: {}, currentKey: null });
          }
          break;
        }
        case "endObject": {
          stack.pop();
          if (!current || current.skip) break;
          const normalized = buildPostFromRecord(current.target);
          if (normalized) {
            posts.push(normalized);
          } else {
            ignored.push({
              reason: "invalid_video_entry",
              sample: current.target?.Link || current.target?.link || fileName
            });
          }
          break;
        }
        case "keyValue": {
          if (!current || current.skip) break;
          current.currentKey = token.value;
          break;
        }
        case "stringValue":
        case "numberValue":
        case "nullValue":
        case "trueValue":
        case "falseValue": {
          if (!current || current.skip || !current.currentKey) break;
          if (containsBase64(token.value)) {
            ignored.push({ reason: "base64_skipped", sample: current.currentKey });
            current.currentKey = null;
            break;
          }
          const field = matchField(current.currentKey);
          if (field) {
            current.target[field] = token.value;
          }
          current.currentKey = null;
          break;
        }
        default:
          break;
      }
    });

    jsonParser.on("error", (err) => {
      errors.push({ message: err.message });
      finish();
    });

    jsonParser.on("end", finish);

    stream.on("error", (err) => {
      errors.push({ message: err.message });
      finish();
    });

    stream.pipe(jsonParser);
  });
}

function buildPostFromRecord(record = {}) {
  const link = sanitizeLink(record.link || record.Link);
  if (!link) return null;
  const date = normalizeDate(record.date || record.Date);
  if (!date) return null;
  return {
    platform: "tiktok",
    date,
    link,
    likes: parseNumber(record.likes || record.Likes),
    comments: parseNumber(record.comments || record.commentCount || record.Comments),
    views: parseNumber(record.views || record.playCount || record.Views),
    caption: sanitizeText(record.description || record.Description),
    title: sanitizeText(record.description || record.Description),
    sound: sanitizeText(record.sound || record.Sound)
  };
}

module.exports = safeTikTokStreamParser;


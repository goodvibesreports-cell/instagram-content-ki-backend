const STORAGE_LINK_REGEX = /https:\/\/[a-z0-9-]+\.tiktokv\.(?:com|eu|us)\/storage\//i;
const SHARE_LINK_PREFIX = "https://www.tiktokv.com/share/video/";
const BLOCKED_LINK_PATTERNS = [
  "tiktok.com/login",
  "redirect_url=",
  "webapp-useastred",
  "tos-no1a-ve-0068c001-no%2F"
];

const TITLE_FIELDS = ["Caption", "Video Caption", "Title", "Description", "videoCaption"];
const LIKE_FIELDS = ["Likes", "Like Count", "like_count"];
const VIEW_FIELDS = ["Views", "Play Count", "Plays", "view_count"];
const COMMENT_FIELDS = ["Comments", "Comment Count", "comment_count"];
const TIMESTAMP_FIELDS = ["Date", "Create Time", "Timestamp", "Created", "time", "CreationTime"];

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeCaption(item) {
  for (const key of TITLE_FIELDS) {
    if (item[key]) {
      const value = String(item[key]).trim();
      if (value && value !== "N/A") {
        return value;
      }
    }
  }
  return "";
}

function hasMetric(item) {
  return (
    LIKE_FIELDS.some(key => item[key] !== undefined) ||
    VIEW_FIELDS.some(key => item[key] !== undefined) ||
    COMMENT_FIELDS.some(key => item[key] !== undefined)
  );
}

function isShareLink(link) {
  return typeof link === "string" && link.startsWith(SHARE_LINK_PREFIX);
}

function isStorageLink(link) {
  return typeof link === "string" && STORAGE_LINK_REGEX.test(link);
}

function sanitizeLink(linkCandidate = "") {
  if (!isStorageLink(linkCandidate)) {
    return "";
  }
  if (BLOCKED_LINK_PATTERNS.some(pattern => linkCandidate.includes(pattern))) {
    return "";
  }
  return linkCandidate;
}

function buildPostPayload(item, linkCandidate = "") {
  const caption =
    normalizeCaption(item) ||
    (item.Title && item.Title !== "N/A" ? item.Title : "") ||
    item.Description ||
    item.text ||
    item.caption ||
    item.Link ||
    item.URL ||
    item.Date ||
    "TikTok Post";

  return {
    caption: caption.trim(),
    likes: LIKE_FIELDS.reduce((val, key) => (val !== 0 ? val : toNumber(item[key])), 0),
    views: VIEW_FIELDS.reduce((val, key) => (val !== 0 ? val : toNumber(item[key])), 0),
    comments: COMMENT_FIELDS.reduce((val, key) => (val !== 0 ? val : toNumber(item[key])), 0),
    link: linkCandidate || "",
    hashtags: extractHashtags(caption),
    timestamp: parseTimestamp(item),
    raw: item
  };
}

function extractHashtags(text = "") {
  const matches = text.match(/#([A-Za-z0-9_]+)/g);
  if (!matches) return [];
  return matches.map(tag => tag.toLowerCase());
}

function parseTimestamp(item) {
  for (const key of TIMESTAMP_FIELDS) {
    if (item[key]) {
      const ts = Date.parse(item[key]);
      if (!Number.isNaN(ts)) {
        return new Date(ts);
      }
    }
  }
  return undefined;
}

function parseTikTokJson(json) {
  const links = new Set();
  const posts = [];

  const stats = {
    processedLinks: 0,
    ignoredLinks: 0
  };

  function shouldSkipCandidate(item) {
    if (!item || typeof item !== "object") {
      return true;
    }
    const linkCandidate = item.Link || item.URL || item.ShareLink;
    if (!linkCandidate) {
      return true;
    }
    if (isShareLink(linkCandidate)) {
      stats.ignoredLinks += 1;
      return true;
    }
    if (!isStorageLink(linkCandidate)) {
      stats.ignoredLinks += 1;
      return true;
    }
    if (!item.Date) {
      stats.ignoredLinks += 1;
      return true;
    }
    return false;
  }

  function processItem(item) {
    if (shouldSkipCandidate(item)) {
      return;
    }
    const linkCandidate = sanitizeLink(item.Link || item.URL || item.ShareLink);
    if (!linkCandidate) {
      stats.ignoredLinks += 1;
      return;
    }
    stats.processedLinks += 1;
    links.add(linkCandidate);
    posts.push(buildPostPayload(item, linkCandidate));
  }

  function collectFromPostList(list) {
    list.forEach(item => processItem(item));
  }

  function extract(node) {
    if (node === null || node === undefined) return;

    if (typeof node === "string") {
      const sanitized = sanitizeLink(node);
      if (sanitized) {
        links.add(sanitized);
      } else if (isShareLink(node)) {
        stats.ignoredLinks += 1;
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(child => extract(child));
      return;
    }

    if (typeof node === "object") {
      if (Array.isArray(node.PostList)) {
        collectFromPostList(node.PostList);
      }

      Object.values(node).forEach(value => {
        if (Array.isArray(value) && value.every(item => typeof item === "object" && "Link" in item)) {
          collectFromPostList(value);
          return;
        }
        if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
          extract(value);
        }
      });

      const maybeCaption =
        node.caption ||
        node.text ||
        node.title ||
        node.description ||
        node.Caption ||
        (node.Title && node.Title !== "N/A" ? node.Title : "");
      if (node.Link || node.URL || node.ShareLink) {
        processItem(node);
      } else if (maybeCaption || hasMetric(node)) {
        posts.push(buildPostPayload(node, ""));
      }
    }
  }

  extract(json);
  return {
    links: Array.from(links),
    posts,
    stats
  };
}

export default parseTikTokJson;


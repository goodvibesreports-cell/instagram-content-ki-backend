const VIDEO_PATTERNS = [
  "tiktokv.com/share/video/",
  "tiktok.com/",
  "vm.tiktok.com/"
];

function parseTikTokJson(json) {
  const links = new Set();

  function extractLinks(node) {
    if (node === null || node === undefined) return;

    if (typeof node === "string") {
      if (VIDEO_PATTERNS.some(pattern => node.includes(pattern))) {
        links.add(node);
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(child => extractLinks(child));
      return;
    }

    if (typeof node === "object") {
      Object.values(node).forEach(value => extractLinks(value));
    }
  }

  extractLinks(json);
  return Array.from(links);
}

export default parseTikTokJson;


import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstagramHtml, toUnifiedItems } from "../utils/instagramHtmlParser.js";

const SAMPLE_HTML = `
<html>
  <body>
    <div class="post">
      <a href="https://www.instagram.com/p/ABC123/">Beitrag</a>
      <time datetime="2025-01-02T10:00:00Z">2. Januar 2025</time>
      <div class="caption">Hello CreatorOS #Meta</div>
      <div class="likes">Likes: 120</div>
      <div class="comments">Comments: 4</div>
    </div>
  </body>
</html>
`;

test("parseInstagramHtml extrahiert Posts aus HTML", () => {
  const posts = parseInstagramHtml(SAMPLE_HTML, "posts.html");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://www.instagram.com/p/ABC123/");
  assert.equal(posts[0].likes, 120);
  assert.equal(posts[0].comments, 4);
});

test("toUnifiedItems liefert normalisierte Inhalte", () => {
  const posts = parseInstagramHtml(SAMPLE_HTML, "posts.html");
  const items = toUnifiedItems(posts, { fileName: "posts.html" });
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.platform, "instagram");
  assert.equal(item.likes, 120);
  assert.ok(item.hashtags.includes("meta"));
});



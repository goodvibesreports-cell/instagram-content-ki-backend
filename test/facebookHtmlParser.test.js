const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseFacebookHtml, toUnifiedItems } = require("../utils/facebookHtmlParser.js");

const SAMPLE_HTML = `
<html>
  <body>
    <div class="fb-post">
      <a href="https://www.facebook.com/user/posts/1">Permalink</a>
      <time data-utime="1735689600">1. Januar 2025</time>
      <div class="content">CreatorOS startet durch!</div>
      <span class="likes">Reactions: 58</span>
      <span class="comments">Comments: 6</span>
      <span class="shares">Shares: 2</span>
    </div>
  </body>
</html>
`;

test("parseFacebookHtml findet Timeline Beiträge", () => {
  const posts = parseFacebookHtml(SAMPLE_HTML, "timeline.html");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].likes, 58);
  assert.equal(posts[0].shares, 2);
});

test("toUnifiedItems liefert normalisierte Facebook Inhalte", () => {
  const posts = parseFacebookHtml(SAMPLE_HTML, "timeline.html");
  const items = toUnifiedItems(posts, { fileName: "timeline.html" });
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.platform, "facebook");
  assert.equal(item.caption, "CreatorOS startet durch!");
});



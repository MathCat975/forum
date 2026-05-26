const forumBoard = document.getElementById("forum-board");
const boardLoading = document.getElementById("board-loading");
const searchInput = document.getElementById("global-search");
const searchForm = document.getElementById("topbarSearch");

const clusterColors = ["post-cluster--blue", "post-cluster--lime", "post-cluster--cyan"];
const glyphClasses = ["post-glyph--primary", "post-glyph--tertiary", "post-glyph--primary"];

function formatRelativeTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const mins = Math.max(1, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getGlyph(title) {
  const t = String(title ?? "").trim();
  return t ? forumEscapeHtml(t.charAt(0).toUpperCase()) : "#";
}

function buildPostRow(post, glyphClass) {
  const title = forumEscapeHtml(post.title || "Untitled");
  const excerpt = forumEscapeHtml(
    (post.message || "").length > 80 ? post.message.slice(0, 80) + "..." : post.message || ""
  );
  const glyph = getGlyph(post.title);
  const postId = encodeURIComponent(post.id);
  const when = formatRelativeTime(post.created_at || post.createdAt);
  const author = forumEscapeHtml(
    post.username || post.author || (post.author_id ? `#${post.author_id}` : "")
  );

  return `
    <article class="post-row">
      <div class="post-glyph ${glyphClass}" aria-hidden="true">${glyph}</div>
      <div class="post-copy">
        <a href="/post?id=${postId}">${title}</a>
        <p>${excerpt}</p>
      </div>
      <div class="post-stat">
        <strong>&nbsp;</strong>
        <span>&nbsp;</span>
      </div>
      <div class="post-activity">
        <a href="/post?id=${postId}">${title}</a>
        <span>${when}${author ? " by " + author : ""}</span>
      </div>
    </article>
  `;
}

function buildCluster(category, posts, colorIdx) {
  const color = clusterColors[colorIdx % clusterColors.length];
  const glyph = glyphClasses[colorIdx % glyphClasses.length];
  const catName = forumEscapeHtml(category.name);
  const group = category.group ? `<span class="cluster-group">${forumEscapeHtml(category.group)}</span>` : "";
  const catId = `cat-${category.id}`;

  const rows = posts.length > 0
    ? posts.map((p) => buildPostRow(p, glyph)).join("")
    : `<div class="cluster-empty">No posts yet</div>`;

  return `
    <section class="post-cluster ${color}" aria-labelledby="${catId}">
      <header class="cluster-head">
        <div>
          <h3 id="${catId}">${catName}</h3>
          ${group}
        </div>
        <span>${posts.length} thread${posts.length !== 1 ? "s" : ""}</span>
      </header>
      <div class="cluster-rows">${rows}</div>
    </section>
  `;
}

async function loadForumBoard() {
  try {
    const categories = await forumFetch("/api/categories");

    const groups = await Promise.all(
      categories.map(async (cat) => {
        const payload = await forumFetch(`/api/posts/list?category_id=${cat.id}&size=5&page=1`);
        return { category: cat, posts: payload.posts || [] };
      })
    );

    if (boardLoading) boardLoading.remove();

    const html = groups.map((g, i) => buildCluster(g.category, g.posts, i)).join("");
    const existing = forumBoard.querySelectorAll(".post-cluster");
    existing.forEach((el) => el.remove());

    forumBoard.insertAdjacentHTML("beforeend", html);
  } catch (err) {
    if (boardLoading) {
      boardLoading.textContent = "Could not load forums. " + (err.message || "Try again later.");
    }
  }
}

searchForm?.addEventListener("submit", (e) => {
  e.preventDefault();
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
  }
});

(async () => {
  try {
    const resp = await fetch("/api/user/me", { credentials: "include" });
    if (resp.ok) {
      const data = await resp.json();
      if (data.role === "admin") {
        const link = document.getElementById("admin-link");
        if (link) link.hidden = false;
      }
    }
  } catch {}
})();

loadForumBoard();

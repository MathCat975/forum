const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const TOKEN_RE = /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|`[^`\n]+?`|\*[^*\n]+?\*)/g;

function renderInline(text) {
  let cursor = 0;
  let html = "";
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0], i = m.index ?? 0;
    html += escapeHtml(text.slice(cursor, i));
    if (t.startsWith("**") && t.endsWith("**")) html += `<strong>${escapeHtml(t.slice(2, -2))}</strong>`;
    else if (t.startsWith("*") && t.endsWith("*")) html += `<em>${escapeHtml(t.slice(1, -1))}</em>`;
    else if (t.startsWith("~~") && t.endsWith("~~")) html += `<s>${escapeHtml(t.slice(2, -2))}</s>`;
    else if (t.startsWith("`") && t.endsWith("`")) html += `<code>${escapeHtml(t.slice(1, -1))}</code>`;
    else html += escapeHtml(t);
    cursor = i + t.length;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

function renderMarkdown(raw) {
  return raw.split("\n").map((line) => {
    const align = line.match(/^\[(left|center|right)\](.*)\[\/\1\]$/);
    if (align) return `<div style="text-align:${align[1]}">${renderInline(align[2])}</div>`;
    if (line.startsWith("# ")) return `<h3>${renderInline(line.slice(2))}</h3>`;
    if (line.startsWith("## ")) return `<h4>${renderInline(line.slice(3))}</h4>`;
    if (line.startsWith("> ")) return `<blockquote>${renderInline(line.slice(2))}</blockquote>`;
    if (line.startsWith("#- ")) return `<li>${renderInline(line.slice(3))}</li>`;
    if (line.trim() === "") return "<br>";
    return `<p>${renderInline(line)}</p>`;
  }).join("");
}

function avatarSrc(url) {
  if (!url || url === "default.png") return "/assets/img/profile/profil.png";
  return url;
}

const threadTitleHeading = document.querySelector(".thread-header h1");
const threadStats = document.querySelector(".thread-stats");
const primaryThreadCard = document.querySelector(".thread-card--primary");
const replyTemplate = document.getElementById("reply-template");
const replyForm = document.getElementById("reply-form");
const replyInput = document.getElementById("reply-box");

let currentPostId = null;
let currentUserRole = null;
let currentUserId = null;
let currentUserVote = 0;

const formatRelativeTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
};

async function fetchCurrentUser() {
  try {
    const resp = await fetch("/api/user/me", { credentials: "include", cache: "no-store" });
    if (resp.status === 403) { window.location.href = "/ban"; return; }
    if (!resp.ok) return;
    const data = await resp.json();
    currentUserRole = data.role;
    if (currentUserRole === "admin") {
      const adminLink = document.getElementById("admin-link");
      if (adminLink) adminLink.hidden = false;
    }
  } catch {}
}

function updateVoteUI(likes, dislikes, userVote) {
  currentUserVote = userVote;
  const likeCount = document.getElementById("like-count");
  const dislikeCount = document.getElementById("dislike-count");
  if (likeCount) likeCount.textContent = likes;
  if (dislikeCount) dislikeCount.textContent = dislikes;

  const likeBtn = document.querySelector(".vote-like");
  const dislikeBtn = document.querySelector(".vote-dislike");
  if (likeBtn) likeBtn.classList.toggle("vote-active", userVote === 1);
  if (dislikeBtn) dislikeBtn.classList.toggle("vote-active", userVote === -1);
}

async function sendVote(value) {
  if (!currentPostId) return;
  try {
    const resp = await fetch("/api/posts/vote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: Number(currentPostId), value }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      if (resp.status === 401) {
        alert("Log in to vote.");
        return;
      }
      alert(err?.error || "Vote failed");
      return;
    }
    const data = await resp.json();
    const newVote = currentUserVote === value ? 0 : value;
    updateVoteUI(data.likes, data.dislikes, newVote);
  } catch (err) {
    alert("Vote failed.");
  }
}

document.querySelector(".vote-like")?.addEventListener("click", () => sendVote(1));
document.querySelector(".vote-dislike")?.addEventListener("click", () => sendVote(-1));

async function deletePost(postId) {
  if (!confirm("Delete this post and all its comments?")) return;
  try {
    const resp = await fetch(`/api/posts?id=${postId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      alert(err?.error || "Delete failed");
      return;
    }
    window.location.href = "/index";
  } catch {
    alert("Delete failed.");
  }
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;
  try {
    const resp = await fetch(`/api/comments?id=${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      alert(err?.error || "Delete failed");
      return;
    }
    await loadPostFromApi();
  } catch {
    alert("Delete failed.");
  }
}

const hydratePost = (postPayload) => {
  const post = postPayload?.post || postPayload?.Post || postPayload;
  if (!post) return;
  currentPostId = post.id || post.ID || currentPostId;

  updateVoteUI(post.likes || 0, post.dislikes || 0, post.user_vote || 0);

  if (threadTitleHeading) {
    threadTitleHeading.textContent = post.title || "Untitled post";
  }

  const replies = (Array.isArray(post.comments) ? post.comments : []).filter((reply) =>
    String(reply.message || "").trim()
  );

  if (threadStats) {
    threadStats.innerHTML = `
      <span>${escapeHtml(formatRelativeTime(post.created_at || post.createdAt))}</span>
      <span>${replies.length} replies</span>
    `;
  }

  if (primaryThreadCard) {
    const username = postPayload?.username || post.username || "Unknown";
    primaryThreadCard.dataset.replyAuthor = username;
    primaryThreadCard.dataset.replyLabel = "Original post";
    primaryThreadCard.dataset.replyMessage = post.message || "";

    const copy = primaryThreadCard.querySelector(".thread-copy");
    if (copy) {
      const body = String(post.message || "").trim();
      const rendered = body ? renderMarkdown(body) : "<p></p>";

      const actions = copy.querySelector(".thread-actions");
      copy.innerHTML = rendered;
      if (actions) {
        copy.appendChild(actions);
      }
    }

    const authorStrong = primaryThreadCard.querySelector(".thread-author strong");
    if (authorStrong) {
      authorStrong.innerHTML = `<a href="/profile?username=${encodeURIComponent(username)}" class="author-link">${escapeHtml(username)}</a>`;
    }

    const avatarFrame = primaryThreadCard.querySelector(".avatar-frame");
    if (avatarFrame) {
      avatarFrame.innerHTML = `<img src="${avatarSrc(post.avatar_url)}" alt="" class="avatar-img">`;
    }

    if (currentUserRole === "admin") {
      const deleteBtn = document.getElementById("admin-delete-post");
      if (deleteBtn) {
        deleteBtn.hidden = false;
        deleteBtn.onclick = () => deletePost(currentPostId);
      }
    }
  }

  const threadWrap = primaryThreadCard?.parentElement;
  if (replyTemplate && threadWrap && replies.length > 0) {
    threadWrap.querySelectorAll("[data-rendered-reply='1']").forEach((node) => node.remove());

    const templateCard = replyTemplate.content.querySelector(".thread-card--reply");
    if (!templateCard) return;

    replies.forEach((reply, idx) => {
      const clone = templateCard.cloneNode(true);
      clone.setAttribute("data-rendered-reply", "1");
      const replyUsername =
        reply.username || reply.author || reply.author_username || "Unknown";
      clone.dataset.replyAuthor = replyUsername;
      clone.dataset.replyLabel = `Post #${idx + 1}`;
      clone.dataset.replyMessage = reply.message || "";

      const strong = clone.querySelector(".thread-author strong");
      if (strong) strong.innerHTML = `<a href="/profile?username=${encodeURIComponent(replyUsername)}" class="author-link">${escapeHtml(replyUsername)}</a>`;

      const replyAvatarFrame = clone.querySelector(".avatar-frame");
      if (replyAvatarFrame) {
        replyAvatarFrame.innerHTML = `<img src="${avatarSrc(reply.avatar_url)}" alt="" class="avatar-img">`;
      }

      const quote = clone.querySelector(".reply-quote");
      if (quote) quote.textContent = "";

      const bodyP = clone.querySelector(".thread-copy > p:not(.reply-quote)");
      if (bodyP) bodyP.outerHTML = renderMarkdown(reply.message || "");

      const metaSpans = clone.querySelectorAll(".reply-meta span");
      if (metaSpans[0]) metaSpans[0].textContent = `Post #${idx + 1}`;
      if (metaSpans[1]) metaSpans[1].textContent = formatRelativeTime(reply.created_at || reply.createdAt);

      if (currentUserRole === "admin") {
        const deleteCommentBtn = clone.querySelector(".admin-delete-comment");
        if (deleteCommentBtn) {
          deleteCommentBtn.hidden = false;
          deleteCommentBtn.onclick = () => deleteComment(reply.id);
        }
      }

      threadWrap.insertBefore(clone, replyForm);
    });
  } else if (threadWrap) {
    threadWrap.querySelectorAll("[data-rendered-reply='1']").forEach((node) => node.remove());
  }
};

const loadPostFromApi = async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;
  currentPostId = id;

  const resp = await fetch(`/api/posts?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!resp.ok) return;
  const payload = await resp.json().catch(() => null);
  hydratePost(payload);
};

(async () => {
  await fetchCurrentUser();
  await loadPostFromApi();
})();

if (replyForm && replyInput) {
  replyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = replyInput.value.trim();
    if (!message) return;
    if (!currentPostId) return;

    const submitBtn = replyForm.querySelector(".composer-button--primary");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const resp = await fetch("/api/posts/reply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: Number(currentPostId), message }),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(payload?.error || payload?.message || `Reply failed (${resp.status})`);
      }
      replyInput.value = "";
      await loadPostFromApi();
    } catch (err) {
      alert(err?.message || "Reply failed.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

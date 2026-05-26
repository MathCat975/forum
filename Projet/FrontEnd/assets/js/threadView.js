const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const threadTitleHeading = document.querySelector(".thread-header h1");
const threadStats = document.querySelector(".thread-stats");
const primaryThreadCard = document.querySelector(".thread-card--primary");
const replyTemplate = document.getElementById("reply-template");
const replyForm = document.getElementById("reply-form");
const replyInput = document.getElementById("reply-box");

let currentPostId = null;

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

const hydratePost = (postPayload) => {
  const post = postPayload?.post || postPayload?.Post || postPayload;
  if (!post) return;
  currentPostId = post.id || post.ID || currentPostId;

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
      <span>1 view</span>
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
      const paragraphs = body
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
        .join("");

      const actions = copy.querySelector(".thread-actions");
      copy.innerHTML = `${paragraphs || "<p></p>"}`;
      if (actions) {
        copy.appendChild(actions);
      }
    }

    const authorStrong = primaryThreadCard.querySelector(".thread-author strong");
    if (authorStrong) {
      authorStrong.textContent = username;
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
      if (strong) strong.textContent = replyUsername;

      const quote = clone.querySelector(".reply-quote");
      if (quote) quote.textContent = "";

      const bodyP = clone.querySelector(".thread-copy > p:not(.reply-quote)");
      if (bodyP) bodyP.innerHTML = escapeHtml(reply.message || "").replace(/\n/g, "<br>");

      const metaSpans = clone.querySelectorAll(".reply-meta span");
      if (metaSpans[0]) metaSpans[0].textContent = `Post #${idx + 1}`;
      if (metaSpans[1]) metaSpans[1].textContent = formatRelativeTime(reply.created_at || reply.createdAt);

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

loadPostFromApi().catch(() => {});

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

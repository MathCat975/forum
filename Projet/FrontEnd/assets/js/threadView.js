const CREATE_THREAD_STORAGE_KEY = "forum:pendingThread";

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const threadTitleHeading = document.querySelector(".thread-header h1");
const threadStats = document.querySelector(".thread-stats");
const primaryThreadCard = document.querySelector(".thread-card--primary");
const sampleReplyCards = document.querySelectorAll(".thread-card--reply");
const replyComposerTitle = document.getElementById("create-post-title");

const formatRelativeTime = (timestamp) => {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
};

const setTextContent = (root, selector, value) => {
  const node = root?.querySelector(selector);
  if (node) {
    node.textContent = value;
  }
};

const hydrateCreatedThread = (thread) => {
  if (threadTitleHeading) {
    threadTitleHeading.textContent = thread.title;
  }

  if (threadStats) {
    threadStats.innerHTML = `
      <span>${formatRelativeTime(thread.createdAt)}</span>
      <span>0 replies</span>
      <span>1 view</span>
    `;
  }

  if (primaryThreadCard) {
    primaryThreadCard.dataset.replyAuthor = thread.author;
    primaryThreadCard.dataset.replyLabel = "Original post";
    primaryThreadCard.dataset.replyMessage = thread.body;

    const copy = primaryThreadCard.querySelector(".thread-copy");
    if (copy) {
      const paragraphs = thread.body
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
        .join("");

      const actions = copy.querySelector(".thread-actions");
      copy.innerHTML = `${paragraphs || "<p></p>"}`;
      if (actions) {
        copy.appendChild(actions);
      } else {
        copy.insertAdjacentHTML(
          "beforeend",
          `<div class="thread-actions" aria-label="Post actions">
            <button type="button">Upvote (0)</button>
            <button type="button" class="thread-reply-trigger">Reply</button>
          </div>`
        );
      }
    }

    setTextContent(primaryThreadCard, ".thread-author strong", thread.author);
  }

  sampleReplyCards.forEach((card) => {
    card.hidden = true;
  });

  if (replyComposerTitle) {
    replyComposerTitle.textContent = "Reply to thread";
  }
};

const loadCreatedThread = () => {
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get("thread");

  if (!threadId) {
    return;
  }

  const raw = sessionStorage.getItem(CREATE_THREAD_STORAGE_KEY);
  if (!raw) {
    return;
  }

  let thread;
  try {
    thread = JSON.parse(raw);
  } catch {
    return;
  }

  if (!thread || thread.id !== threadId) {
    return;
  }

  hydrateCreatedThread(thread);
};

loadCreatedThread();

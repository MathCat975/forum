const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const scopeFilter = document.getElementById("scopeFilter");
const usernameFilter = document.getElementById("usernameFilter");
const categoryFilter = document.getElementById("categoryFilter");
const fromFilter = document.getElementById("fromFilter");
const toFilter = document.getElementById("toFilter");
const sizeFilter = document.getElementById("sizeFilter");
const resultsList = document.getElementById("resultsList");
const resultsCount = document.getElementById("resultsCount");
const searchMessage = document.getElementById("searchMessage");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const pageIndicator = document.getElementById("pageIndicator");

let currentPage = 1;
let lastHasMore = false;
let isLoading = false;

function formatDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

function formatRelativeTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getAuthor(item) {
  return item.username || item.author || (item.author_id ? `#${item.author_id}` : "Unknown");
}

function buildResultCard(item, query, scope) {
  const title = forumEscapeHtml(
    scope === "comments" ? item.post_title || item.title || "Comment" : item.title || "Untitled"
  );
  const body = forumEscapeHtml(item.message || item.body || item.content || "");
  const author = forumEscapeHtml(getAuthor(item));
  const when = formatRelativeTime(item.created_at || item.createdAt);
  const postId = scope === "comments" ? (item.post_id || item.id) : item.id;
  const href = postId ? `/post?id=${encodeURIComponent(postId)}` : "#";

  let highlighted = body;
  if (query) {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    highlighted = body.replace(re, "<mark>$1</mark>");
  }

  return `
    <a class="result-row" href="${href}">
      <div class="result-row__copy">
        <strong>${title}</strong>
        <p>${highlighted}</p>
      </div>
      <div class="result-row__meta">
        <span>${author}</span>
        <span>${when}</span>
      </div>
    </a>
  `;
}

function updatePagination() {
  if (pageIndicator) pageIndicator.textContent = `Page ${currentPage}`;
  if (prevPageButton) prevPageButton.disabled = currentPage <= 1 || isLoading;
  if (nextPageButton) nextPageButton.disabled = !lastHasMore || isLoading;
}

async function executeSearch(page = 1) {
  const q = searchInput.value.trim();
  const username = usernameFilter.value.trim();
  const catId = categoryFilter.value.trim();
  const from = fromFilter.value;
  const to = toFilter.value;
  const scope = scopeFilter.value;
  const size = sizeFilter.value;

  if (!q && !username && !catId && !from && !to) {
    if (searchMessage) searchMessage.textContent = "Enter at least one search filter.";
    return;
  }

  currentPage = page;
  isLoading = true;
  updatePagination();
  searchButton.disabled = true;
  if (searchMessage) searchMessage.textContent = "Searching...";

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (scope && scope !== "all") params.set("in", scope);
  if (username) params.set("username", username);
  if (catId) params.set("category_id", catId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("page", String(page));
  params.set("size", size);

  try {
    const payload = await forumFetch(`/api/search?${params}`);
    const items = scope === "comments" ? (payload.comments || []) : (payload.posts || []);
    lastHasMore = Boolean(payload.has_more);

    if (resultsCount) resultsCount.textContent = `${payload.total ?? items.length} results`;
    if (searchMessage) searchMessage.textContent = "";

    if (items.length === 0) {
      resultsList.innerHTML = `<div class="cluster-empty">No results found.</div>`;
    } else {
      resultsList.innerHTML = items.map((i) => buildResultCard(i, q, scope)).join("");
    }
  } catch (err) {
    resultsList.innerHTML = `<div class="cluster-empty">Search failed.</div>`;
    if (searchMessage) searchMessage.textContent = err.message || "Error";
  } finally {
    isLoading = false;
    searchButton.disabled = false;
    updatePagination();
  }
}

searchButton?.addEventListener("click", () => executeSearch(1));
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") executeSearch(1); });
prevPageButton?.addEventListener("click", () => { if (currentPage > 1) executeSearch(currentPage - 1); });
nextPageButton?.addEventListener("click", () => { if (lastHasMore) executeSearch(currentPage + 1); });

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

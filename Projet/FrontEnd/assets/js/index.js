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

const categoryNameById = new Map();

let currentPage = 1;
let lastHasMore = false;
let isLoading = false;
let feedLoaded = false;

function highlightMatch(text, query) {
    const safeText = String(text ?? "");

    if (!query) {
        return safeText;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return safeText.replace(regex, "<mark>$1</mark>");
}

function formatDate(value) {
    if (!value) {
        return "Unknown date";
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatRelativeTime(value) {
    if (!value) {
        return "Unknown time";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    const elapsedMs = Date.now() - parsed.getTime();
    const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60000));

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} min ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
        return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function truncateText(text, maxLength = 140) {
    const value = String(text ?? "").trim();
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
}

function setMessage(message, tone = "") {
    if (!searchMessage) {
        return;
    }

    searchMessage.textContent = message;
    searchMessage.className = "search-message";

    if (tone) {
        searchMessage.classList.add(tone);
    }
}

function getAuthorName(item) {
    return (
        item.username ||
        item.author ||
        item.user?.username ||
        item.owner?.username ||
        (item.authorId || item.author_id ? `Operator #${item.authorId || item.author_id}` : "Unknown operator")
    );
}

function getCategoryLabel(item) {
    if (item.category?.name) {
        return item.category.name;
    }

    if (item.category_name || item.categoryName) {
        return item.category_name || item.categoryName;
    }

    const categoryId = item.categoryId || item.category_id;

    if (categoryId && categoryNameById.has(categoryId)) {
        return categoryNameById.get(categoryId);
    }

    return categoryId ? `Category #${categoryId}` : "Unclassified";
}

function getPrimaryBody(item, scope) {
    if (scope === "comments") {
        return item.message || item.body || item.content || "";
    }

    return item.message || item.excerpt || item.content || "";
}

function getPostGlyph(title) {
    const trimmed = String(title ?? "").trim();
    if (!trimmed) {
        return "#";
    }

    return forumEscapeHtml(trimmed.charAt(0).toUpperCase());
}

function buildFeedCard(post, categoryName) {
    const title = forumEscapeHtml(post.title || "Sans titre");
    const excerpt = forumEscapeHtml(truncateText(post.message, 110));
    const author = forumEscapeHtml(getAuthorName(post));
    const when = forumEscapeHtml(formatRelativeTime(post.createdAt || post.created_at));
    const category = forumEscapeHtml(categoryName || "Forum");
    const postId = encodeURIComponent(post.id);
    const glyph = getPostGlyph(post.title);

    return `
        <a class="feed-card" href="/front/post?id=${postId}">
            <span class="feed-card__glyph" aria-hidden="true">${glyph}</span>
            <span class="feed-card__body">
                <span class="feed-card__tag">${category}</span>
                <strong class="feed-card__title">${title}</strong>
                <span class="feed-card__excerpt">${excerpt}</span>
                <span class="feed-card__meta">${when} · ${author}</span>
            </span>
        </a>
    `;
}

function setFeedMode(active) {
    const showFeedButton = document.getElementById("showFeedButton");

    if (showFeedButton) {
        showFeedButton.hidden = active;
    }
}

function renderForumFeed(groups, totalPosts) {
    if (!resultsList) {
        return;
    }

    if (groups.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state feed-grid__empty">
                Aucun post pour l'instant. Connecte-toi pour lancer le premier thread.
            </div>
        `;
    } else {
        const cards = [];
        for (const group of groups) {
            for (const post of group.posts) {
                cards.push(buildFeedCard(post, group.category?.name));
            }
        }
        resultsList.innerHTML = cards.join("");
        resultsList.classList.add("feed-grid");
    }

    if (resultsCount) {
        resultsCount.textContent = `${totalPosts} post${totalPosts > 1 ? "s" : ""} actif${totalPosts > 1 ? "s" : ""}`;
    }

    if (pageIndicator) {
        pageIndicator.textContent = "Forum feed";
    }

    if (prevPageButton) {
        prevPageButton.disabled = true;
    }

    if (nextPageButton) {
        nextPageButton.disabled = true;
    }

    setFeedMode(true);
}

async function loadForumFeed() {
    if (!resultsList) {
        return;
    }

    resultsList.innerHTML = `
        <div class="empty-state">Loading forum transmissions...</div>
    `;

    if (resultsCount) {
        resultsCount.textContent = "Loading forums...";
    }

    try {
        const categories = await forumFetch("/api/categories");
        categoryNameById.clear();

        for (const category of categories) {
            categoryNameById.set(category.id, category.name);
        }

        const groups = await Promise.all(
            categories.map(async (category) => {
                const payload = await forumFetch(
                    `/api/posts/list?category_id=${category.id}&size=20&page=1`
                );
                return {
                    category,
                    posts: payload.posts || [],
                };
            })
        );

        const activeGroups = groups.filter((group) => group.posts.length > 0);
        const totalPosts = activeGroups.reduce((sum, group) => sum + group.posts.length, 0);

        renderForumFeed(activeGroups, totalPosts);
        feedLoaded = true;
        setMessage("Fil du forum chargé.", "is-success");
    } catch (error) {
        resultsList.innerHTML = `
            <div class="empty-state">
                Could not load forums. ${forumEscapeHtml(error.message || "Try again later.")}
            </div>
        `;

        if (resultsCount) {
            resultsCount.textContent = "Feed unavailable";
        }

        setMessage(error.message || "Failed to load forum feed.", "is-error");
    }
}

function buildResultCard(item, query, scope) {
    const title = scope === "comments"
        ? item.post_title || item.title || "Comment Match"
        : item.title || "Untitled Post";
    const typeLabel = scope === "comments" ? "Comment" : "Post";
    const body = getPrimaryBody(item, scope);
    const replyCount = item.reply_count ?? item.replies ?? item.comment_count ?? 0;
    const viewCount = item.view_count ?? item.views ?? 0;

    return `
        <article class="result-card">
            <div class="result-meta">
                <span class="result-type">${typeLabel}</span>
                <span class="result-sector">${forumEscapeHtml(getCategoryLabel(item))}</span>
            </div>
            <h3 class="result-title">${highlightMatch(forumEscapeHtml(title), forumEscapeHtml(query))}</h3>
            <p class="result-body">${highlightMatch(forumEscapeHtml(body), forumEscapeHtml(query))}</p>
            <div class="result-footer">
                <div class="result-stats">
                    <span>By ${forumEscapeHtml(getAuthorName(item))}</span>
                    <span>${replyCount} replies</span>
                    <span>${viewCount} views</span>
                    <span>${formatDate(item.createdAt || item.created_at)}</span>
                </div>
            </div>
        </article>
    `;
}

function updatePagination(page, hasMore) {
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${page}`;
    }

    if (prevPageButton) {
        prevPageButton.disabled = page <= 1 || isLoading;
    }

    if (nextPageButton) {
        nextPageButton.disabled = !hasMore || isLoading;
    }
}

function renderResults(payload, scope, query) {
    const items = scope === "comments" ? (payload.comments || []) : (payload.posts || []);
    const label = scope === "comments" ? "comments" : "posts";

    if (resultsCount) {
        resultsCount.textContent = `${payload.total ?? items.length} ${label}`;
    }

    updatePagination(payload.page || currentPage, Boolean(payload.has_more));

    if (items.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state">
                No signal matched the current scan. Try another keyword, author, category, or date range.
            </div>
        `;
        return;
    }

    resultsList.innerHTML = items.map((item) => buildResultCard(item, query, scope)).join("");
}

function getSearchParams(pageOverride) {
    const q = searchInput.value.trim();
    const username = usernameFilter.value.trim();
    const categoryId = categoryFilter.value.trim();
    const from = fromFilter.value;
    const to = toFilter.value;
    const scope = scopeFilter.value;
    const size = sizeFilter.value;
    const page = String(pageOverride || currentPage);

    if (!q && !username && !categoryId && !from && !to) {
        return {
            error: "At least one filter is required: q, username, category_id, from, or to.",
        };
    }

    const params = new URLSearchParams();

    if (q) {
        params.set("q", q);
    }

    if (scope && scope !== "all") {
        params.set("in", scope);
    }

    if (username) {
        params.set("username", username);
    }

    if (categoryId) {
        params.set("category_id", categoryId);
    }

    if (from) {
        params.set("from", from);
    }

    if (to) {
        params.set("to", to);
    }

    params.set("page", page);
    params.set("size", size);

    return { params, scope, query: q };
}

async function executeSearch(pageOverride = 1) {
    const request = getSearchParams(pageOverride);

    if (request.error) {
        setMessage(request.error, "is-error");
        resultsList.innerHTML = `
            <div class="empty-state">
                Add at least one valid filter before executing the search.
            </div>
        `;

        if (resultsCount) {
            resultsCount.textContent = "0 results";
        }

        updatePagination(1, false);
        return;
    }

    currentPage = pageOverride;
    isLoading = true;
    setFeedMode(false);
    updatePagination(currentPage, false);
    searchButton.disabled = true;
    setMessage("Scanning the network...", "is-success");

    try {
        const payload = await forumFetch(`/api/search?${request.params.toString()}`);

        lastHasMore = Boolean(payload.has_more);
        renderResults(payload, request.scope, request.query);
        setMessage(`Search completed on page ${payload.page || currentPage}.`, "is-success");
    } catch (error) {
        lastHasMore = false;

        if (resultsCount) {
            resultsCount.textContent = "0 results";
        }

        updatePagination(currentPage, false);
        resultsList.innerHTML = `
            <div class="empty-state">
                Search request failed. Check the API route or filters and try again.
            </div>
        `;
        setMessage(error.message || "Search failed.", "is-error");
    } finally {
        isLoading = false;
        searchButton.disabled = false;
        updatePagination(currentPage, lastHasMore);
    }
}

document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
        searchInput.value = button.dataset.query;
        executeSearch(1);
    });
});

searchButton?.addEventListener("click", () => executeSearch(1));

searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        executeSearch(1);
    }
});

[scopeFilter, usernameFilter, categoryFilter, fromFilter, toFilter, sizeFilter].forEach((element) => {
    element?.addEventListener("change", () => {
        currentPage = 1;
        updatePagination(currentPage, false);
    });
});

prevPageButton?.addEventListener("click", () => {
    if (currentPage > 1 && !isLoading) {
        executeSearch(currentPage - 1);
    }
});

nextPageButton?.addEventListener("click", () => {
    if (lastHasMore && !isLoading) {
        executeSearch(currentPage + 1);
    }
});

document.getElementById("showFeedButton")?.addEventListener("click", () => {
    loadForumFeed();
});

loadForumFeed();
updatePagination(1, false);

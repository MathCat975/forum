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

function setMessage(message, tone = "") {
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
        "Unknown operator"
    );
}

function getCategoryLabel(item) {
    return (
        item.category?.name ||
        item.category_name ||
        item.categoryName ||
        (item.category_id ? `Category #${item.category_id}` : "Unclassified")
    );
}

function getPrimaryBody(item, scope) {
    if (scope === "comments") {
        return item.message || item.body || item.content || "";
    }

    return item.message || item.excerpt || item.content || "";
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
                <span class="result-sector">${getCategoryLabel(item)}</span>
            </div>
            <h3 class="result-title">${highlightMatch(title, query)}</h3>
            <p class="result-body">${highlightMatch(body, query)}</p>
            <div class="result-footer">
                <div class="result-stats">
                    <span>By ${getAuthorName(item)}</span>
                    <span>${replyCount} replies</span>
                    <span>${viewCount} views</span>
                    <span>${formatDate(item.created_at)}</span>
                </div>
                <a href="#" class="result-link">Open Transmission</a>
            </div>
        </article>
    `;
}

function updatePagination(page, hasMore) {
    pageIndicator.textContent = `Page ${page}`;
    prevPageButton.disabled = page <= 1 || isLoading;
    nextPageButton.disabled = !hasMore || isLoading;
}

function renderResults(payload, scope, query) {
    const items = scope === "comments" ? (payload.comments || []) : (payload.posts || []);
    const label = scope === "comments" ? "comments" : "posts";

    resultsCount.textContent = `${payload.total ?? items.length} ${label}`;
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
            error: "At least one filter is required: q, username, category_id, from, or to."
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
        resultsCount.textContent = "0 results";
        updatePagination(1, false);
        return;
    }

    currentPage = pageOverride;
    isLoading = true;
    updatePagination(currentPage, false);
    searchButton.disabled = true;
    setMessage("Scanning the network...", "is-success");

    try {
        const response = await fetch(`/api/search?${request.params.toString()}`);
        let payload = {};

        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }

        if (!response.ok) {
            const errorMessage = payload.error || payload.message || "Search failed.";
            throw new Error(errorMessage);
        }

        lastHasMore = Boolean(payload.has_more);
        renderResults(payload, request.scope, request.query);
        setMessage(`Search completed on page ${payload.page || currentPage}.`, "is-success");
    } catch (error) {
        lastHasMore = false;
        resultsCount.textContent = "0 results";
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

searchButton.addEventListener("click", () => executeSearch(1));

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        executeSearch(1);
    }
});

[scopeFilter, usernameFilter, categoryFilter, fromFilter, toFilter, sizeFilter].forEach((element) => {
    element.addEventListener("change", () => {
        currentPage = 1;
        updatePagination(currentPage, false);
    });
});

prevPageButton.addEventListener("click", () => {
    if (currentPage > 1 && !isLoading) {
        executeSearch(currentPage - 1);
    }
});

nextPageButton.addEventListener("click", () => {
    if (lastHasMore && !isLoading) {
        executeSearch(currentPage + 1);
    }
});

resultsList.innerHTML = `
    <div class="empty-state">
        Ready for search. Fill one or more filters, then execute the scan.
    </div>
`;
updatePagination(1, false);

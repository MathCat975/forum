const createThreadForm = document.getElementById("create-thread-form");
const threadTitleInput = document.getElementById("thread-title");
const threadBodyInput = document.getElementById("reply-box");
const threadCategorySelect = document.getElementById("thread-category");
const createThreadError = document.getElementById("create-thread-error");

const showCreateError = (message) => {
  if (!createThreadError) return;
  createThreadError.textContent = message;
  createThreadError.hidden = !message;
};

(async () => {
  try {
    const categories = await forumFetch("/api/categories");
    if (!threadCategorySelect) return;
    threadCategorySelect.innerHTML = "";
    let groups = {};
    for (const cat of categories) {
      const g = cat.group || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(cat);
    }
    for (const [group, cats] of Object.entries(groups)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group;
      for (const cat of cats) {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name;
        if (cat.locked) opt.textContent += " (locked)";
        optgroup.appendChild(opt);
      }
      threadCategorySelect.appendChild(optgroup);
    }
  } catch {
    if (threadCategorySelect) {
      threadCategorySelect.innerHTML = '<option value="2">Public Square</option>';
    }
  }
})();

if (createThreadForm) {
  createThreadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showCreateError("");

    const title = threadTitleInput?.value.trim() ?? "";
    const body = threadBodyInput?.value.trim() ?? "";
    const categoryId = Number(threadCategorySelect?.value);

    if (!title) {
      showCreateError("Add a title for your forum.");
      threadTitleInput?.focus();
      return;
    }
    if (!body) {
      showCreateError("Write an opening message.");
      threadBodyInput?.focus();
      return;
    }
    if (!categoryId) {
      showCreateError("Select a category.");
      return;
    }

    const submitBtn = createThreadForm.querySelector(".composer-button--primary");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const resp = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message: body, category_id: categoryId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `Create post failed (${resp.status})`);
      }

      const created = await resp.json().catch(() => null);
      if (created?.id) {
        window.location.href = `/post?id=${encodeURIComponent(created.id)}`;
      } else {
        window.location.href = "/index";
      }
    } catch (e) {
      showCreateError(e?.message || "Failed to create post.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

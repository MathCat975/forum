const CREATE_THREAD_STORAGE_KEY = "forum:pendingThread";

const createThreadForm = document.getElementById("create-thread-form");
const threadTitleInput = document.getElementById("thread-title");
const threadBodyInput = document.getElementById("reply-box");
const createThreadError = document.getElementById("create-thread-error");

const showCreateError = (message) => {
  if (!createThreadError) {
    return;
  }

  createThreadError.textContent = message;
  createThreadError.hidden = !message;
};

const buildThreadPayload = () => {
  const title = threadTitleInput?.value.trim() ?? "";
  const body = threadBodyInput?.value.trim() ?? "";

  if (!title) {
    showCreateError("Add a title for your forum.");
    threadTitleInput?.focus();
    return null;
  }

  if (!body) {
    showCreateError("Write an opening message so others know what to discuss.");
    threadBodyInput?.focus();
    return null;
  }

  return {
    id: crypto.randomUUID(),
    title,
    body,
    author: "operator",
    createdAt: Date.now(),
  };
};

if (createThreadForm) {
  createThreadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showCreateError("");

    const thread = buildThreadPayload();
    if (!thread) {
      return;
    }

    (async () => {
      try {
        const categoriesResp = await fetch("/api/categories", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const categories = await categoriesResp.json().catch(() => []);

        const unlocked = Array.isArray(categories) ? categories.find((c) => !c.locked) : null;
        const categoryId = unlocked?.id || categories?.[0]?.id || 2;

        const payload = {
          title: thread.title,
          message: thread.body,
          category_id: categoryId,
        };

        const createResp = await fetch("/api/posts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!createResp.ok) {
          const err = await createResp.json().catch(() => null);
          throw new Error(err?.error || err?.message || `Create post failed (${createResp.status})`);
        }

        sessionStorage.removeItem(CREATE_THREAD_STORAGE_KEY);
        const created = await createResp.json().catch(() => null);
        const createdId = created?.id;
        if (!createdId) {
          window.location.href = "/front/index";
          return;
        }
        window.location.href = `/front/post?id=${encodeURIComponent(createdId)}`;
      } catch (e) {
        showCreateError(e?.message || "Failed to create post.");
      }
    })();
  });
}

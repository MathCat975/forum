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

    sessionStorage.setItem(CREATE_THREAD_STORAGE_KEY, JSON.stringify(thread));
    window.location.href = `/front/post?thread=${encodeURIComponent(thread.id)}`;
  });
}

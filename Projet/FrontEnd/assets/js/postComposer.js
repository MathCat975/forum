const composerInput = document.getElementById("reply-box");
const composerPreview = document.getElementById("reply-preview");
const replyIndicator = document.getElementById("reply-indicator");
const replyTargetMeta = document.getElementById("reply-target-meta");
const replyTargetMessage = document.getElementById("reply-target-message");
const clearReplyTargetButton = document.getElementById("clear-reply-target");
const replyTriggers = document.querySelectorAll(".thread-reply-trigger");

if (composerInput && composerPreview) {
  const TOKEN_PATTERN = /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|`[^`\n]+?`|\*[^*\n]+?\*)/g;
  const BLOCK_PATTERNS = [
    { prefix: "#- ", className: "md-line", marker: "#-" },
    { prefix: "## ", className: "md-line md-line--h2", marker: "##" },
    { prefix: "# ", className: "md-line md-line--h1", marker: "#" },
    { prefix: "> ", className: "md-line md-line--quote", marker: ">" },
  ];

  const escapeHtml = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderToken = (token) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      const content = escapeHtml(token.slice(2, -2));
      return `<span class="md-inline md-inline--bold"><span class="md-syntax">**</span><strong>${content}</strong><span class="md-syntax">**</span></span>`;
    }

    if (token.startsWith("*") && token.endsWith("*")) {
      const content = escapeHtml(token.slice(1, -1));
      return `<span class="md-inline md-inline--italic"><span class="md-syntax">*</span><em>${content}</em><span class="md-syntax">*</span></span>`;
    }

    if (token.startsWith("~~") && token.endsWith("~~")) {
      const content = escapeHtml(token.slice(2, -2));
      return `<span class="md-inline md-inline--strike"><span class="md-syntax">~~</span><s>${content}</s><span class="md-syntax">~~</span></span>`;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      const content = escapeHtml(token.slice(1, -1));
      return `<span class="md-inline md-inline--code"><span class="md-syntax">\`</span><code>${content}</code><span class="md-syntax">\`</span></span>`;
    }

    return escapeHtml(token);
  };

  const renderInlineContent = (value) => {
    let cursor = 0;
    let html = "";

    for (const match of value.matchAll(TOKEN_PATTERN)) {
      const token = match[0];
      const index = match.index ?? 0;

      html += escapeHtml(value.slice(cursor, index));
      html += renderToken(token);
      cursor = index + token.length;
    }

    html += escapeHtml(value.slice(cursor));
    return html;
  };

  const renderLine = (line) => {
    for (const block of BLOCK_PATTERNS) {
      if (line.startsWith(block.prefix)) {
        const content = renderInlineContent(line.slice(block.prefix.length));
        return `<div class="${block.className}"><span class="md-syntax md-syntax--block">${escapeHtml(block.marker)}</span><span class="md-line__content">${content || "<br>"}</span></div>`;
      }
    }

    return `<div>${renderInlineContent(line) || "<br>"}</div>`;
  };

  const syncHeight = () => {
    composerPreview.style.minHeight = `${composerInput.offsetHeight}px`;
  };

  const syncScroll = () => {
    composerPreview.scrollTop = composerInput.scrollTop;
    composerPreview.scrollLeft = composerInput.scrollLeft;
  };

  const renderPreview = () => {
    const raw = composerInput.value.replace(/\r/g, "");
    const lines = raw.split("\n");

    composerPreview.innerHTML = lines.map(renderLine).join("");
    composerPreview.dataset.empty = raw.length === 0 ? "true" : "false";
    syncHeight();
    syncScroll();
  };

  composerInput.addEventListener("input", renderPreview);
  composerInput.addEventListener("scroll", syncScroll);
  window.addEventListener("resize", syncHeight);

  renderPreview();
}

if (replyIndicator && replyTargetMeta && replyTargetMessage && clearReplyTargetButton) {
  const truncateReplyMessage = (message) => {
    if (message.length <= 140) {
      return message;
    }

    return `${message.slice(0, 137)}...`;
  };

  const setReplyTarget = (card) => {
    const author = card.dataset.replyAuthor ?? "Unknown author";
    const label = card.dataset.replyLabel ?? "Message";
    const message = card.dataset.replyMessage ?? "";

    replyTargetMeta.textContent = `${author} - ${label}`;
    replyTargetMessage.textContent = truncateReplyMessage(message);
    replyIndicator.hidden = false;
    composerInput.focus();
  };

  const clearReplyTarget = () => {
    replyTargetMeta.textContent = "";
    replyTargetMessage.textContent = "";
    replyIndicator.hidden = true;
  };

  replyTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const card = trigger.closest(".thread-card");

      if (!card) {
        return;
      }

      setReplyTarget(card);
    });
  });

  clearReplyTargetButton.addEventListener("click", clearReplyTarget);
}

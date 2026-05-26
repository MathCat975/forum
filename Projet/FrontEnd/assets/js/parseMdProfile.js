let currentUserProfile = null;
let currentEditField = null;
let isOwnProfile = false;

function getUsernameFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("username") || null;
}

async function fetchUserProfile(username) {
  try {
    let url;
    if (username) {
      url = `/api/user/profile?username=${encodeURIComponent(username)}`;
      isOwnProfile = false;
    } else {
      url = "/api/user/me";
      isOwnProfile = true;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login";
        return null;
      }
      if (response.status === 403) {
        window.location.href = "/ban";
        return null;
      }
      return null;
    }

    const data = await response.json();
    currentUserProfile = data;

    if (!username && data.username) {
      const meResp = await fetch(
        `/api/user/profile?username=${encodeURIComponent(data.username)}`,
        { credentials: "include" }
      );
      if (meResp.ok) {
        const profileData = await meResp.json();
        Object.assign(currentUserProfile, profileData);
      }
    }

    return currentUserProfile;
  } catch {
    return null;
  }
}

function displayUserProfile(profile) {
  if (!profile) return;

  const pseudo = document.getElementById("pseudoProfil");
  if (pseudo) pseudo.textContent = profile.username || "Unknown";

  const avatar = document.getElementById("profile-avatar");
  if (avatar && profile.avatar_url) {
    avatar.src = profile.avatar_url === "default.png" ? "/assets/img/profile/profil.png" : profile.avatar_url;
  }

  const roleEl = document.getElementById("userRole");
  if (roleEl) {
    roleEl.textContent = profile.role || "user";
    roleEl.className = "profile-role profile-role--" + (profile.role || "user");
  }

  const infoRole = document.getElementById("infoRole");
  if (infoRole) infoRole.textContent = profile.role || "User";

  const creationDate = document.getElementById("creationDate");
  if (creationDate && profile.created_at) {
    creationDate.textContent = new Date(profile.created_at).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const statsThreads = document.getElementById("statsThreads");
  if (statsThreads) statsThreads.textContent = profile.post_count ?? 0;

  const statsComments = document.getElementById("statsComments");
  if (statsComments) statsComments.textContent = profile.comment_count ?? 0;

  const statsLikes = document.getElementById("statsLikes");
  if (statsLikes) statsLikes.textContent = profile.like_count ?? 0;

  const statsDislikes = document.getElementById("statsDislikes");
  if (statsDislikes) statsDislikes.textContent = profile.dislike_count ?? 0;

  if (profile.role === "admin") {
    const adminLink = document.getElementById("admin-link");
    if (adminLink) adminLink.hidden = false;
  }

  const editBtn = document.getElementById("editUserBtn");
  if (editBtn && !isOwnProfile) editBtn.hidden = true;

  const signOutSection = document.getElementById("sign-out-section");
  if (signOutSection && !isOwnProfile) signOutSection.hidden = true;

  const oauthSection = document.getElementById("oauth-section");
  if (oauthSection && isOwnProfile) {
    oauthSection.hidden = false;
    const cs = profile.connexionService;
    if (cs) {
      setupOAuthRow("github", cs.git);
      setupOAuthRow("google", cs.google);
    }
  }

  renderLastPosts(profile.lastPosts || []);
}

function renderLastPosts(posts) {
  const container = document.getElementById("postContent");
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = '<div class="empty-state">No posts yet.</div>';
    return;
  }

  container.innerHTML = posts
    .map((p) => {
      const title = forumEscapeHtml(p.title || "Sans titre");
      const date = new Date(p.created_at).toLocaleDateString("fr-FR");
      const excerpt = forumEscapeHtml(
        (p.message || "").length > 100 ? p.message.slice(0, 100) + "..." : p.message || ""
      );
      return `
        <a class="post-card" href="/post?id=${p.id}">
          <div class="post-card__head">
            <strong>${title}</strong>
            <span class="post-card__date">${date}</span>
          </div>
          <p class="post-card__excerpt">${excerpt}</p>
        </a>
      `;
    })
    .join("");
}

// OAuth connections
function setupOAuthRow(provider, email) {
  const statusEl = document.getElementById(`oauth-${provider}-status`);
  const btn = document.getElementById(`oauth-${provider}-btn`);
  if (!statusEl || !btn) return;

  if (email) {
    statusEl.textContent = email;
    statusEl.classList.add("oauth-status--connected");
    btn.textContent = "Disconnect";
    btn.classList.remove("oauth-connect");
    btn.classList.add("oauth-disconnect");
    btn.onclick = () => disconnectOAuth(provider);
  } else {
    statusEl.textContent = "Not connected";
    statusEl.classList.remove("oauth-status--connected");
    btn.textContent = "Connect";
    btn.classList.remove("oauth-disconnect");
    btn.classList.add("oauth-connect");
    btn.onclick = () => connectOAuth(provider);
  }
}

function connectOAuth(provider) {
  window.location.href = `/api/auth/${provider}`;
}

async function disconnectOAuth(provider) {
  if (!confirm(`Disconnect ${provider}?`)) return;
  try {
    const resp = await fetch("/api/user/oauth", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      alert(err?.error || "Error");
      return;
    }
    const profile = await fetchUserProfile(null);
    if (profile) displayUserProfile(profile);
  } catch {
    alert("Error");
  }
}

// Edit modal
function openEditFieldModal(fieldType) {
  currentEditField = fieldType;
  if (fieldType === "username") {
    document.getElementById("editFieldLabel").textContent = "Username";
    document.getElementById("editFieldInput").value =
      document.getElementById("pseudoProfil").textContent;
  }
  document.getElementById("editFieldModal").style.display = "flex";
  document.getElementById("editFieldModalOverlay").style.display = "block";
  document.getElementById("editFieldInput").focus();
}

function closeEditFieldModal() {
  document.getElementById("editFieldModal").style.display = "none";
  document.getElementById("editFieldModalOverlay").style.display = "none";
  currentEditField = null;
}

async function saveEditField() {
  if (!currentEditField) return;
  const value = document.getElementById("editFieldInput").value.trim();
  if (!value) return;

  try {
    const updateData = {};
    if (currentEditField === "username") updateData.username = value;

    const response = await fetch("/api/user", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || "Failed to update profile");
      return;
    }

    const result = await response.json();
    if (currentEditField === "username") {
      document.getElementById("pseudoProfil").textContent = result.username;
      if (currentUserProfile) currentUserProfile.username = result.username;
    }
    closeEditFieldModal();
  } catch {
    alert("Failed to update profile");
  }
}

// Avatar upload
document.getElementById("profile-avatar")?.addEventListener("click", () => {
  if (isOwnProfile) document.getElementById("editPhotoInput").click();
});

document.getElementById("editPhotoInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || "Upload failed");
      return;
    }

    const result = await response.json();
    const avatarUrl = result.url || `/api/cdn/${result.filename}`;

    const avatar = document.getElementById("profile-avatar");
    if (avatar) avatar.src = avatarUrl;

    await fetch("/api/user", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });

    if (currentUserProfile) currentUserProfile.avatar_url = avatarUrl;
  } catch {
    alert("Upload failed");
  }
});

// Sign out
document.getElementById("btn-sign-out")?.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch {}
  window.location.href = "/login";
});

// Event listeners
document.getElementById("editUserBtn")?.addEventListener("click", () => openEditFieldModal("username"));
document.getElementById("cancelEditField")?.addEventListener("click", closeEditFieldModal);
document.getElementById("editFieldModalOverlay")?.addEventListener("click", closeEditFieldModal);
document.getElementById("saveEditField")?.addEventListener("click", saveEditField);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("editFieldModal").style.display === "flex") {
    closeEditFieldModal();
  }
});

document.getElementById("editFieldInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveEditField();
  }
});

// Init
document.addEventListener("DOMContentLoaded", async () => {
  const username = getUsernameFromURL();
  const profile = await fetchUserProfile(username);
  if (profile) displayUserProfile(profile);
});

let currentUserProfile = null;
let currentEditField = null;
let viewingOwnProfile = false;

const devMode = false;
const profil = {
  username: localStorage.getItem("username") || "TestUser",
  avatar_url: localStorage.getItem("profilePhoto") || "/assets/img/profile/profil2.png",
  role: "User",
  created_at: "",
  online: true,
  post_count: 0,
  comment_count: 0,
  like_count: 0,
  dislike_count: 0,
  connexionService: {
    git: "",
    google: "",
    email: "",
  },
  lastPosts: [],
};

// Get data

function getUsernameFromURL() {
  let params = new URLSearchParams(window.location.search);
  return params.get('username');
}

async function getProfil() {
  try {
    // Get self info
    const result = await fetch("/api/user/me", {
      method: "GET",
      credentials: "include"
    });

    if (!result.ok) {
      if (result.status === 401) {
        window.location.href = "/front/login";
        return;
      }
      console.error("Failed to fetch self:", result.status);
      return;
    }

    const me = await result.json();

    // Get profile (with stats)
    const targetUsername = getUsernameFromURL() || me.username;
    viewingOwnProfile = targetUsername === me.username;
    updateSignOutVisibility();
    const profileRes = await fetch("/api/user/profile?username=" + encodeURIComponent(targetUsername), {
      method: "GET",
      credentials: "include"
    });

    if (!profileRes.ok) {
      console.error("Failed to fetch profile:", profileRes.status);
      return;
    }

    const data = await profileRes.json();
    const profileSource = viewingOwnProfile ? { ...data, ...me } : data;

    profil.username = profileSource.username;
    profil.avatar_url = profileSource.avatar_url || "/assets/img/profile/profil2.png";
    profil.role = profileSource.role || "User";
    profil.id = profileSource.id;
    profil.created_at = profileSource.created_at;
    profil.online = true;
    profil.lastConnexion = "Online";
    profil.post_count = profileSource.post_count || 0;
    profil.comment_count = profileSource.comment_count || 0;
    profil.like_count = profileSource.like_count || 0;
    profil.dislike_count = profileSource.dislike_count || 0;

    const connexion = profileSource.connexionService || {};
    profil.connexionService = {
      git: connexion.git || "",
      google: connexion.google || "",
      email: connexion.email || "",
    };
    profil.connexionType.git = Boolean(profil.connexionService.git);
    profil.connexionType.google = Boolean(profil.connexionService.google);
    profil.connexionType.email = Boolean(profil.connexionService.email);
    profil.connexionType.none =
      !profil.connexionType.git &&
      !profil.connexionType.google &&
      !profil.connexionType.email;

    profil.lastPosts = Array.isArray(profileSource.lastPosts) ? profileSource.lastPosts : [];

    printInfos(profil);
    printLastPosts();

  } catch (error) {
    console.error("Error get profil data:", error);
  }
}

function updateSignOutVisibility() {
  const signOutBtn = document.getElementById("signOutBtn");
  if (!signOutBtn) {
    return;
  }

  signOutBtn.hidden = !viewingOwnProfile;
}

async function isSessionActive() {
  try {
    const response = await fetch("/api/user/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return true;
  }
}

function clearLocalSession() {
  localStorage.removeItem("username");
  localStorage.removeItem("profilePhoto");
}

function finishSignOut() {
  clearLocalSession();
  window.location.replace("/front/login");
}

function postLogoutViaForm() {
  return new Promise((resolve) => {
    const logoutForm = document.getElementById("logout-form");
    if (!logoutForm) {
      resolve(false);
      return;
    }

    logoutForm.action = `${window.location.origin}/api/logout`;

    const iframe = document.createElement("iframe");
    iframe.name = "logout-frame";
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const previousTarget = logoutForm.target;
    logoutForm.target = "logout-frame";

    const cleanup = () => {
      logoutForm.target = previousTarget;
      iframe.remove();
      resolve(true);
    };

    iframe.addEventListener("load", () => setTimeout(cleanup, 150), { once: true });
    logoutForm.requestSubmit();
    setTimeout(cleanup, 1500);
  });
}

async function requestLogout() {
  try {
    const payload = await forumFetch("/api/logout", {
      method: "POST",
      body: "{}",
    });

    if (payload?.status === "ok") {
      return true;
    }
  } catch (error) {
    console.warn("Logout API request failed:", error);
  }

  await postLogoutViaForm();
  return true;
}

async function signOutAccount() {
  const signOutBtn = document.getElementById("signOutBtn");
  if (!signOutBtn || signOutBtn.disabled) {
    return;
  }

  signOutBtn.disabled = true;

  try {
    await requestLogout();

    if (!(await isSessionActive())) {
      finishSignOut();
      return;
    }

    signOutBtn.disabled = false;
    await displayAlertMessage(
      "Could not end your session. Use the same address as the forum (for example http://localhost:8080) and restart the server if needed."
    );
  } catch (error) {
    signOutBtn.disabled = false;
    await displayAlertMessage(error.message || "Sign out failed. Try again.");
  }
}

// Disconnect OAuth provider

const disconnect = async (type) => {
  const provider = type === "Git" ? "github" : "google";

  try {
    await forumFetch("/api/user/oauth", {
      method: "DELETE",
      body: JSON.stringify({ provider }),
    });
    await displayAlertMessage("Connection removed.", true);
    await getProfil();

    if (currentEditField === "connexionService") {
      closeEditFieldModal();
      setTimeout(() => {
        openEditFieldModal("connexionService");
      }, 10);
    }
  } catch (error) {
    await displayAlertMessage(error.message || "Failed to remove connection.");
  }
};

// Posts

const postContentDom = document.getElementById("postContent");

function printLastPosts() {
  postContentDom.innerHTML = "";

  if (!Array.isArray(profil.lastPosts) || profil.lastPosts.length === 0) {
    postContentDom.innerHTML = "<p>No recent posts.</p>";
    return;
  }

  for (const post of profil.lastPosts) {
    const div = document.createElement("div");
    div.className = "cardPost";
    div.id = `post-${post.id}`;

    let contentText = post.message || post.content || "";
    if (contentText.length > 100) {
      contentText = `${contentText.substring(0, 100)}...`;
    }

    const createdAt = post.createdAt || post.created_at;
    const postDate = createdAt ? new Date(createdAt).toLocaleDateString() : "";

    div.innerHTML = `
      <h4>${post.title || "Untitled post"}</h4>
      <p>${contentText}</p>
      <span class="postDate">${postDate}</span>
      <button class="viewPostButton" type="button">See post</button>
    `;
    postContentDom.appendChild(div);
  }
}

// Display info

function printInfos(profile) {
  if (!profile) {
    return;
  }

  // Username
  const pseudoDom = document.getElementById("pseudoProfil");
  pseudoDom.textContent = profile.username;

  // Avatar
  const photoDom = document.getElementById("profilPhoto");
  photoDom.src = profile.avatar_url;
  if (profile.avatar_url && !profile.avatar_url.startsWith('blob:')) {
    localStorage.setItem("profilePhoto", profile.avatar_url);
  }

  // Online Offline
  const onlineBall = document.getElementById("isOnlineBall");
  const onlineText = document.getElementById("isOnline");
  if (profile.online === 1 || profile.online === true) {
    onlineBall.className = "Online";
    onlineText.textContent = "Online";
    onlineText.style.color = "green";
  } else {
    onlineBall.className = "Offline";
    onlineText.textContent = "Offline";
    onlineText.style.color = "red";
  }

  // Last visit
  const lastVisitDom = document.getElementById("lastVisit");
  lastVisitDom.textContent = profile.lastConnexion;

  // Role
  const roleDom = document.getElementById("userRole");
  roleDom.textContent = profile.role || "User";

  // Create date
  const creationDateDom = document.getElementById("creationDate");
  if (profile.created_at) {
    creationDateDom.textContent = new Date(profile.created_at).toLocaleDateString();
  }

  // Connect service
  const serviceDom = document.getElementById("connexionService");
  const infosNameDom = document.getElementById("infosNameEmail");
  if (profile.connexionType.git) {
    serviceDom.textContent = profile.connexionService.git || "Connected via GitHub";
    infosNameDom.textContent = "GitHub";
  } else if (profile.connexionType.google) {
    serviceDom.textContent = profile.connexionService.google || "Connected via Google";
    infosNameDom.textContent = "Google";
  } else if (profile.connexionType.email) {
    serviceDom.textContent = profile.connexionService.email;
    infosNameDom.textContent = "Email";
  } else {
    serviceDom.textContent = "No service linked";
    infosNameDom.textContent = "Status";
  }

  // Stats
  const stats = {
    statsPosts: profile.post_count,
    statsComments: profile.comment_count,
    statsLikesGiven: profile.like_count,
    statsDislikesGiver: profile.dislike_count
  };
  for (let [id, val] of Object.entries(stats)) {
    const statDom = document.getElementById(id);
    statDom.textContent = val || 0;
  }
}

// Modal

function openEditFieldModal(fieldType) {
  currentEditField = fieldType;
  const container = document.getElementById("btnConnexion");
  const input = document.getElementById("editFieldInput");
  const label = document.getElementById("editFieldLabel");
  const saveBtn = document.getElementById("saveEditField");

  container.innerHTML = "";

  if (fieldType === 'username') {
    saveBtn.style.display = "block";
    input.style.display = "block";
    input.value = document.getElementById("pseudoProfil").textContent || "";
    label.textContent = "Username";
  }

  if (fieldType === 'connexionService') {
    saveBtn.style.display = "none";
    input.style.display = "none";
    label.textContent = "Connect your account";

    let divBtnConnexion = document.createElement("div");
    divBtnConnexion.id = "divBtnConnexion";

    // Git
    let btnGitDiv = document.createElement("div");
    btnGitDiv.id = "btnGitDiv";

    let btnGit = document.createElement("a");
    btnGit.href = "/api/auth/github";
    btnGit.className = "oauthBtn";
    btnGit.id = "btnGit";
    btnGit.innerHTML = '<img src="/assets/img/profile/gitLogo.webp" alt="GitHub"> <p id="textGit">Connect with GitHub</p>';
    btnGitDiv.appendChild(btnGit);

    let btnDisconnectGit = document.createElement("button");
    btnDisconnectGit.id = "btnRemoveGit";
    btnDisconnectGit.type = "button";
    btnDisconnectGit.className = "btnRemove";
    btnDisconnectGit.textContent = "Remove connection";
    btnDisconnectGit.addEventListener("click", () => {
      disconnect("Git");
    });
    btnGitDiv.appendChild(btnDisconnectGit);

    // Google
    let btnEmailDiv = document.createElement("div");
    btnEmailDiv.id = "btnEmailDiv";

    let btnEmail = document.createElement("a");
    btnEmail.href = "/api/auth/google";
    btnEmail.id = "btnEmail";
    btnEmail.className = "oauthBtn";
    btnEmail.innerHTML = '<img src="/assets/img/profile/googleLogo.webp" alt="Google"> <p id="textGoogle">Connect with Google</p>';
    btnEmailDiv.appendChild(btnEmail);

    let btnDisconnectGoogle = document.createElement("button");
    btnDisconnectGoogle.id = "btnRemoveGoogle";
    btnDisconnectGoogle.type = "button";
    btnDisconnectGoogle.className = "btnRemove";
    btnDisconnectGoogle.textContent = "Remove connection";
    btnDisconnectGoogle.addEventListener("click", () => {
      disconnect("Google");
    });
    btnEmailDiv.appendChild(btnDisconnectGoogle);

    divBtnConnexion.appendChild(btnGitDiv);
    divBtnConnexion.appendChild(btnEmailDiv);
    container.appendChild(divBtnConnexion);

    // Git
    if (!profil.connexionType.git) {
      btnDisconnectGit.style.display = "none";
    } else {
      btnGit.style.borderColor = "var(--primary)";
      btnGit.style.pointerEvents = "none";
      btnGit.querySelector("#textGit").textContent = "Already connected with GitHub";
      btnDisconnectGit.style.display = "block";
    }

    // Google
    if (!profil.connexionType.google) {
      btnDisconnectGoogle.style.display = "none";
    } else {
      btnEmail.style.borderColor = "var(--primary)";
      btnEmail.style.pointerEvents = "none";
      btnEmail.querySelector("#textGoogle").textContent = "Already connected with Google";
      btnDisconnectGoogle.style.display = "block";
    }

    const modal = document.getElementById("editFieldModal");
    modal.classList.add("modal-resize");
  }

  const modal = document.getElementById("editFieldModal");
  const overlay = document.getElementById("editFieldModalOverlay");
  modal.style.display = "flex";
  overlay.style.display = "block";
  if (fieldType === 'username') {
    input.focus();
  }
}

function closeEditFieldModal() {
  const modal = document.getElementById("editFieldModal");
  const overlay = document.getElementById("editFieldModalOverlay");
  modal.style.display = "none";
  modal.classList.remove("modal-resize");
  overlay.style.display = "none";
  currentEditField = null;
}

// Save

async function displayAlertMessage(text, isSuccess = false) {
  const messageDom = document.getElementById("message");
  if (!messageDom) {
    alert(text);
    return;
  }
  messageDom.textContent = text;
  messageDom.style.display = "block";
  if (isSuccess) {
    messageDom.style.backgroundColor = "rgb(122, 216, 122)";
  } else {
    messageDom.style.backgroundColor = "transparent";
  }

  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });
  messageDom.style.display = "none";
}

async function saveEditField() {
  if (!currentEditField) {
    return;
  }

  let value = document.getElementById("editFieldInput").value.trim();

  if (!value && currentEditField === 'username') {
    await displayAlertMessage("Please enter a value!");
    return;
  }

  if (currentEditField === "username") {
    if (value === profil.username) {
      closeEditFieldModal();
      return;
    }

    try {
      const response = await fetch("/api/user", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value })
      });

      const data = await response.json();

      if (response.ok) {
        profil.username = value;
        localStorage.setItem("username", value);
        await displayAlertMessage(data.message || "Profile updated!", true);
        printInfos(profil);
        closeEditFieldModal();
      } else {
        await displayAlertMessage(data.error || "Error during update. Please try again.");
      }
    } catch (error) {
      console.error(error);
      await displayAlertMessage("Error during update. Please try again.");
    }
  }
}

// Edit banner

document.getElementById("editPhotoInput")?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }

  let urlImage = URL.createObjectURL(file);
  const photoEl = document.getElementById('profilPhoto');
  photoEl.src = urlImage;

  let formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    const result = await response.json();
    if (result.url) {
      localStorage.setItem("profilePhoto", result.url);
      profil.avatar_url = result.url;
      printInfos(profil);
    }
  } catch (error) {
    console.error("Upload error:", error);
    await displayAlertMessage("Error during upload");
  }
});

document.querySelector('#profilPhoto')?.addEventListener('click', () => {
  document.getElementById("editPhotoInput").click();
});

document.getElementById("editUserBtn")?.addEventListener("click", () => {
  openEditFieldModal('username');
});
document.getElementById("editConnexionServiceBtn")?.addEventListener("click", () => {
  openEditFieldModal('connexionService');
});

// Event listener

document.getElementById("cancelEditField")?.addEventListener("click", closeEditFieldModal);
document.getElementById("editFieldModalOverlay")?.addEventListener("click", closeEditFieldModal);
document.getElementById("saveEditField")?.addEventListener("click", (e) => {
  e.preventDefault();
  saveEditField();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("editFieldModal").style.display === "flex") {
    closeEditFieldModal();
  }
});

document.getElementById("editFieldInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveEditField();
  }
});

// Random banner

const banners = [
  "/assets/img/profile/banner2.png",
  "/assets/img/profile/banner3.png",
  "/assets/img/profile/banner4.png",
  "/assets/img/profile/banner5.png",
];

function getRandomBanner() {
  const randomIndex = Math.floor(Math.random() * banners.length);
  return banners[randomIndex];
}

function applySavedData() {
  let savedUsername = localStorage.getItem("username");
  let savedProfilePhoto = localStorage.getItem("profilePhoto");

  if (savedUsername) {
    profil.username = savedUsername;
  }
  if (savedProfilePhoto && !savedProfilePhoto.startsWith('blob:')) {
    profil.avatar_url = savedProfilePhoto;
  }
  printInfos(profil);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("signOutBtn")?.addEventListener("click", signOutAccount);

  applySavedData();

  const bannerImg = document.getElementById("banner");
  if (bannerImg) {
    bannerImg.src = getRandomBanner();
  }

  getProfil();
});
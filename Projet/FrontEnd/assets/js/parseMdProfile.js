let currentUserProfile = null;
let currentEditField = null;

const devMode = true;
const profil = {
  username: localStorage.getItem("username") || "TestUser",
  avatar_url: localStorage.getItem("profilePhoto") || "/assets/img/profile/profil2.png",
  role: "Admin",
  id: "12345",
  created_at: "2026-01-15T10:00:00Z",
  online: true,
  post_count: 5,
  comment_count: 12,
  like_count: 8,
  dislike_count: 2,
  connexionService: JSON.parse(localStorage.getItem("connexionService")) || {
    git: "",
    email: "test@exemple.com",
    none: ""
  },
  connexionType: JSON.parse(localStorage.getItem("connexionType")) || {
    git: false,
    email: true,
    none: false
  },
  lastPosts: {
    post1: {
      title: "First post",
      content: "This is the first post content. This is the first post content. This is the first post content. This is the first post content. This is the first post content.",
      date: "2023-07-25"
    },
    post2: {
      title: "Second post",
      content: "This is the second post content.",
      date: "2023-07-26"
    },
    post3: {
      title: "Third post",
      content: "This is the third post content.",
      date: "2023-07-27"
    },
    post4: {
      title: "Fourth post",
      content: "This is the fourth post content.",
      date: "2023-07-28"
    },
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (devMode) {
    printInfos(profil);
  }
});

function getUsernameFromURL() {
  let params = new URLSearchParams(window.location.search);
  return params.get('username');
}

// Disconnect
const disconnect = (type) => {
  if (devMode) {
    profil.connexionService = "None";
    profil.connexionType = "none";
    localStorage.setItem("connexionService", "None");
    localStorage.setItem("connexionType", "none");
    printInfos(profil);
    closeEditFieldModal();
    setTimeout(() => openEditFieldModal("connexionService"), 10);
    return;
  }

  if (type === "Git") {
    profil.connexionType.git = false;
    profil.connexionService.git = "";
    localStorage.setItem("connexionType", stringify(profil.connexionType));
    localStorage.setItem("connexionService", stringify(profil.connexionService));
    printInfos(profil);
    return;
  }

  if (type === "Google") {
    profil.connexionType.email = false;
    profil.connexionService.email = "";
    localStorage.setItem("connexionType", stringify(profil.connexionType));
    localStorage.setItem("connexionService", stringify(profil.connexionService));
    printInfos(profil)
    return;
  }
}

// Print lastPosts
const postContentDom = document.getElementById("postContent");

function printLastPosts() {
  postContentDom.innerHTML = "";

  for (let [key, value] of Object.entries(profil.lastPosts)) {
    let div = document.createElement("div");
    div.className = "cardPost";
    div.id = key;

    let contentText = value.content;
    
    // Content max length 100 characters
    if (value.content.length > 100) {
      contentText = value.content.substring(0, 100) + "...";
    }

    div.innerHTML = '<h4> ' + value.title + ' </h4> <p> ' + contentText + ' </p> <span class="postDate"> ' + new Date(value.date).toLocaleDateString() + ' </span> <button class="viewPostButton">See post</button>';
    postContentDom.appendChild(div);
  }
}

printLastPosts();


// Call server to ask data
async function fetchUserProfile(username) {
  try {
    let url = '/api/user/profile?username=' + encodeURIComponent(username);

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/front/login';
        return null;
      }
      console.error('Failed to fetch profile:', response.status);
      return null;
    }

    const data = await response.json();
    currentUserProfile = data;
    return data;
  } catch (error) {
    return null;
  }
}

// Display data
function printInfos(profile) {
  if (!profile) {
    return
  };

  // name
  document.getElementById("pseudoProfil").textContent = profile.username;

  // Update avatar
  document.getElementById("profilPhoto").src = profile.avatar_url;
  localStorage.setItem("profilePhoto", profile.avatar_url);

  if (profile.avatar_url && !profile.avatar_url.startsWith('blob:')) {
    localStorage.setItem("profilePhoto", profile.avatar_url);
  }

  // Online
  const onlineBall = document.getElementById("isOnlineBall");
  const onlineText = document.getElementById("isOnline");
  if (profile.online) {
    onlineBall.classList.add("Online");
    onlineBall.classList.remove("Offline");
    onlineText.textContent = "Online";
    onlineText.style.color = "green";
  } else {
    onlineBall.classList.add("Offline");
    onlineBall.classList.remove("Online");
    onlineText.textContent = "Offline";
    onlineText.style.color = "red";
  }


  // Role
  document.getElementById("userRole").textContent = profile.role || "User";

  // Date
  const creationDateDom = document.getElementById("creationDate");
  let createdDate = new Date(profile.created_at).toLocaleDateString();
  creationDateDom.textContent = createdDate;

  // Connexion Service
  const serviceDom = document.getElementById("connexionService");
  const infosNameDom = document.getElementById("infosNameEmail");

  // On détermine quel service est actif
  if (profile.connexionType.git) {
    serviceDom.textContent = profile.connexionService.git;
    infosNameDom.textContent = "Git Account";
  } else if (profile.connexionType.email) {
    serviceDom.textContent = profile.connexionService.email;
    infosNameDom.textContent = "Email";
  } else {
    serviceDom.textContent = "No service linked";
    infosNameDom.textContent = "Status";
  }

  // Stats
  document.getElementById("statsPosts").textContent = profile.post_count || 0;
  document.getElementById("statsComments").textContent = profile.comment_count || 0;
  document.getElementById("statsLikesGiven").textContent = profile.like_count || 0;
  document.getElementById("statsDislikesGiver").textContent = profile.dislike_count || 0;
}

// Edit modale
function openEditFieldModal(fieldType) {
  currentEditField = fieldType;

  if (fieldType === 'username') {
    document.getElementById("btnConnexion").innerHTML = "";
    document.getElementById("editFieldInput").style.display = "block";
    document.getElementById("editFieldLabel").textContent = "Username";
    document.getElementById("editFieldInput").value = document.getElementById("pseudoProfil").textContent;
  }

  if (fieldType === 'connexionService') {
    const input = document.getElementById("editFieldInput");
    const container = document.getElementById("btnConnexion");
    container.innerHTML = "";
    document.getElementById("saveEditField").style.display = "none";

    document.getElementById("editFieldLabel").textContent = "Connect your account";

    let divBtnConnexion = document.createElement("div");
    divBtnConnexion.id = "divBtnConnexion";

    let btnGitDiv = document.createElement("div");
    btnGitDiv.id = "btnGitDiv";
    let btnGit = document.createElement("a");
    btnGit.href = "#";
    btnGit.addEventListener("click", () => {
      profil.connexionType.git = true;
      profil.connexionService.git = "test git";
      localStorage.setItem("connexionType", stringify(profil.connexionType));
      printInfos(profil);
      closeEditFieldModal();
    });
    btnGit.className = "oauthBtn";
    btnGit.id = "btnGit";
    btnGit.innerHTML = '<img src="/assets/img/profile/gitLogo.webp" alt="GitHub"> <p id="textGit">Connect with GitHub</p>';
    btnGitDiv.appendChild(btnGit);
    let btnDisconnectGit = document.createElement("button");
    btnDisconnectGit.id = "btnRemoveGit";
    btnDisconnectGit.type = "button";
    btnDisconnectGit.addEventListener("click", () => disconnect("Git"));
    btnDisconnectGit.className = "btnRemove";
    btnDisconnectGit.textContent = "Remove connection";
    btnGitDiv.appendChild(btnDisconnectGit);

    let btnEmailDiv = document.createElement("div");
    btnEmailDiv.id = "btnEmailDiv";
    let btnEmail = document.createElement("a");
    btnEmail.href = "#";
    btnEmail.addEventListener("click", () => {
      profil.connexionType.email = true;
      profil.connexionService.email = "test@exemple.com";
      localStorage.setItem("connexionType", stringify(profil.connexionType));
      printInfos(profil);
      closeEditFieldModal();
    });
    btnEmail.id = "btnEmail";
    btnEmail.className = "oauthBtn";
    btnEmail.innerHTML = '<img src="/assets/img/profile/googleLogo.webp" alt="Google"> <p id="textGoogle">Connect with Google</p>';
    btnEmailDiv.appendChild(btnEmail);
    let btnDisconnectGoogle = document.createElement("button");
    btnDisconnectGoogle.id = "btnRemoveGoogle";
    btnDisconnectGoogle.type = "button";
    btnDisconnectGoogle.addEventListener("click", () => disconnect("Google"));
    btnDisconnectGoogle.className = "btnRemove";
    btnDisconnectGoogle.textContent = "Remove connection";
    btnEmailDiv.appendChild(btnDisconnectGoogle);

    divBtnConnexion.appendChild(btnGitDiv);
    divBtnConnexion.appendChild(btnEmailDiv);
    container.appendChild(divBtnConnexion);

    if (profil.connexionType.git === false) {
      document.getElementById("btnRemoveGit").style.display = "none";
    } else if (profil.connexionType.git === true) {
      btnGit.style.borderColor = "var(--primary)";
      btnGit.style.pointerEvents = "none";
      btnGit.querySelector("#textGit").textContent = "Already connected with GitHub";
      document.getElementById("btnRemoveGit").style.display = "block";
      document.getElementById("btnRemoveGit").disabled = false;
    }

    if (profil.connexionType.email === false) {
      document.getElementById("btnRemoveGoogle").style.display = "none";
    } else if (profil.connexionType.email === true) {
      btnEmail.style.borderColor = "var(--primary)";
      btnEmail.style.pointerEvents = "none";
      btnEmail.querySelector("#textGoogle").textContent = "Already connected with Google";
      document.getElementById("btnRemoveGoogle").style.display = "block";
      document.getElementById("btnRemoveGoogle").disabled = false;
    }

    if (profil.connexionType.none === true) {
      document.getElementById("btnRemoveGit").style.display = "none";
      document.getElementById("btnRemoveGoogle").style.display = "none";
    }

    input.style.display = "none";

    // Resize
    const modal = document.getElementById("editFieldModal");
    modal.classList.add("modal-resize");
  }

  document.getElementById("editFieldModal").style.display = "flex";
  document.getElementById("editFieldModalOverlay").style.display = "block";
  document.getElementById("editFieldInput").focus();
}

function closeEditFieldModal() {
  document.getElementById("editFieldModal").style.display = "none";
  document.getElementById("editFieldModalOverlay").style.display = "none";
  currentEditField = null;

  // Remove class
  const modal = document.getElementById("editFieldModal");
  modal.classList.remove("modal-resize");
}

// Check if git username exists

async function checkGitHubUser(username) {
  try {
    const response = await fetch('https://api.github.com/users/' + encodeURIComponent(username));
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function saveEditField() {
  if (!currentEditField) {
    return
  };

  let value = document.getElementById("editFieldInput").value.trim();

  if (!value) {
    alert("You didn't enter a value. Please retry !");
    return;
  }

  // Check mail

  if (currentEditField === 'connexionService') {
    let isEmail = value.endsWith('@gmail.com') && value.includes('.');
    let isGit = value.length >= 3;

    if (isGit) {
      if (!await checkGitHubUser(value)) {
        alert("Git username doesn't exist. Please try again.");
        return;
      }
    } else if (isEmail) {
      if (value.toLowerCase().endsWith("@gmail.com")) {
        alert("Please enter a valid Gmail address.");
        return;
      }
    } else {
      alert("Please enter a valid email or Git username.");
      return;
    }

    if (devMode) {
      profil.connexionService = value;
      localStorage.setItem("connexionService", value);
      printInfos(profil);
      closeEditFieldModal();
      return;
    }
  }

  // Username

  if (currentEditField === 'username') {
    if (devMode) {
      profil.username = value;
      localStorage.setItem("username", value);
      printInfos(profil);
      closeEditFieldModal();
      return;
    }

    try {
      const updateData = {};

      if (currentEditField === 'username') {
        updateData.username = value;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        alert("Error during update of informations ! Please try again soon.")
        return;
      }

      const result = await response.json();

      // Keep modal open with update data

      if (currentEditField === 'username') {
        document.getElementById("pseudoProfil").textContent = result.username;
        if (currentUserProfile) {
          currentUserProfile.username = result.username;
        }
      }
    } catch (error) {
      alert('Error during update of informations ! Please try again soon.');
    }
  } else if (currentEditField === 'connexionService') {
    if (devMode) {
      profil.connexionService = value;
      printInfos(profil);
      closeEditFieldModal();
      return;
    }

  }

  closeEditFieldModal();
}

// Update profile image

document.getElementById("editPhotoInput")?.addEventListener('change', async (e) => {
  const file = e.target.files[0];

  if (!file) {
    return
  };

  // Create URL for image
  let urlImage = URL.createObjectURL(file);

  if (devMode) {
    profil.avatar_url = urlImage;
    printInfos(profil);
    return;
  }

  let formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.url) {
      localStorage.setItem("profilePhoto", result.url);
      document.getElementById('profilPhoto').src = result.url;
    }
  } catch (error) {
    alert("Error during upload");
    document.getElementById('profilPhoto').src = urlImage;
  }

  // Update avatar DOM
  document.getElementById('profilPhoto').src = URL.createObjectURL(file);
});

// Click on photo to change
document.querySelector('#profilPhoto')?.addEventListener('click', () => {
  document.getElementById("editPhotoInput").click();
});

// Change username

document.getElementById("editUserBtn")?.addEventListener("click", () =>
  openEditFieldModal('username')
);

// Change address service
document.getElementById("editConnexionServiceBtn")?.addEventListener("click", () =>
  openEditFieldModal('connexionService')
);


// Modal
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

document.getElementById("editFieldInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveEditField();
  }
});

// Load
function applySavedData() {
  let savedUsername = localStorage.getItem("username");
  let savedProfilePhoto = localStorage.getItem("profilePhoto");

  if (savedUsername) {
    document.getElementById("pseudoProfil").textContent = savedUsername;
  }

  if (savedProfilePhoto) {
    // If it's a temp link, we load default image
    if (savedProfilePhoto.startsWith('blob:')) {
      localStorage.removeItem("profilePhoto");
    } else {
      let profileImg = document.getElementById("profilPhoto");
      if (profileImg) {
        profileImg.src = savedProfilePhoto;
      }
    }
  }
}

applySavedData();

// Photo
const profileImg = document.getElementById("profilPhoto");
const editPhotoInput = document.getElementById("editPhotoInput");

if (profileImg) {
  profileImg.addEventListener("click", () => {
    //editPhotoInput.click();
  });
}


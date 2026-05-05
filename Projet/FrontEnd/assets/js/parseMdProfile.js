let currentUserProfile = null;
let currentEditField = null;

function getUsernameFromURL() {
  let params = new URLSearchParams(window.location.search);
  return params.get('username');
}

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

  // Role
  document.getElementById("userRole").textContent = profile.role;

  // UID
  document.getElementById("userUID").textContent = profile.id || profile.uid;

  // Date
  const creationDateDom = document.getElementById("creationDate");
  let createdDate = new Date(profile.created_at).toLocaleDateString();
  creationDateDom.textContent = createdDate;

  // Connexion Service
  document.getElementById("connexionService").textContent = profile.connexionService;

  if (profile.connexionService.includes("@")) {
    document.getElementById("infosNameEmail").textContent = "Email";
  } else {
    document.getElementById("infosNameEmail").textContent = "Git Account";
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

    let btnGit = document.createElement("a");
    btnGit.href = "https://www.google.fr";
    btnGit.className = "oauthBtn";
    btnGit.id = "btnGit";
    btnGit.innerHTML = '<img src="/assets/img/profile/gitLogo.webp" alt="GitHub"> <p id="textGit">Connect with GitHub</p>';


    let btnEmail = document.createElement("a");
    btnEmail.href = "https://www.google.fr"; 
    btnEmail.id = "btnEmail";
    btnEmail.className = "oauthBtn";
    btnEmail.innerHTML = '<img src="/assets/img/profile/googleLogo.webp" alt="Google"> <p id="textGoogle">Connect with Google</p>';

    divBtnConnexion.appendChild(btnGit);
    divBtnConnexion.appendChild(btnEmail);
    container.appendChild(divBtnConnexion);

    if (profil.connexionType === "git") {
      btnGit.style.borderColor = "var(--primary)";
      btnGit.style.pointerEvents = "none";
      btnGit.querySelector("#textGit").textContent = "Already connected with GitHub";
    } else if (profil.connexionType === "email") {
      btnEmail.style.borderColor = "var(--primary)";
      btnEmail.style.pointerEvents = "none";
      btnEmail.querySelector("#textGoogle").textContent = "Already connected with Google";
    }

    input.style.display = "none";
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
      if (await checkGitHubUser(value)) {
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
document.querySelector('profilPhoto')?.addEventListener('click', () => {
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
    editPhotoInput.click();
  });
}

const devMode = true;
const profil = {
  username: localStorage.getItem("username") || "TestUser",
  avatar_url: localStorage.getItem("profilePhoto") || "/assets/img/profile/profil.png",
  role: "Admin",
  id: "12345",
  created_at: "2026-01-15T10:00:00Z",
  post_count: 5,
  comment_count: 12,
  like_count: 8,
  dislike_count: 2,
  connexionService: "test@exemple.com",
  connexionType: "email",
};

document.addEventListener("DOMContentLoaded", () => {
  if (devMode) {
    printInfos(profil);
  }
});


// ============================
// PROFILE DATA MANAGEMENT
// ============================

let currentUserProfile = null;
let currentEditField = null;

// Get username from URL query param or use current user
function getUsernameFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('username') || null;
}

// Fetch user profile from API
async function fetchUserProfile(username) {
  try {
    const url = username 
      ? `/api/user/profile?username=${encodeURIComponent(username)}`
      : '/api/user/profile';
    
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
    console.error('Error fetching profile:', error);
    return null;
  }
}

// Display user profile on page
function displayUserProfile(profile) {
  if (!profile) return;

  // Update username
  document.getElementById("pseudoProfil").textContent = profile.username;
  
  // Update avatar
  const avatarImg = document.querySelector('#profilePhotoName img[alt="Profile Photo"]');
  if (avatarImg && profile.avatar_url) {
    avatarImg.src = profile.avatar_url;
  }

  // Update informations section
  const userRoleEl = document.getElementById("userRole");
  if (userRoleEl) userRoleEl.textContent = profile.role || 'User';

  const userUIDEl = document.getElementById("userUID");
  if (userUIDEl) userUIDEl.textContent = profile.id || profile.uid || 'N/A';
  
  const creationDateEl = document.getElementById("creationDate");
  if (creationDateEl && profile.created_at) {
    const createdDate = new Date(profile.created_at).toLocaleDateString();
    creationDateEl.textContent = createdDate;
  }

  // Update statistics
  const statsThreads = document.getElementById("statsThreads");
  if (statsThreads) statsThreads.textContent = profile.post_count || 0;

  const statsPosts = document.getElementById("statsPosts");
  if (statsPosts) statsPosts.textContent = profile.comment_count || 0;

  const statsLikesGiven = document.getElementById("statsLikesGiven");
  if (statsLikesGiven) statsLikesGiven.textContent = profile.like_count || 0;

  const statsComments = document.getElementById("statsComments");
  if (statsComments) statsComments.textContent = profile.dislike_count || 0;
}

// ============================
// EDIT MODAL FUNCTIONALITY
// ============================

function openEditFieldModal(fieldType) {
  currentEditField = fieldType;
  
  if (fieldType === 'username') {
    document.getElementById("editFieldLabel").textContent = "Username";
    document.getElementById("editFieldInput").value = document.getElementById("pseudoProfil").textContent;
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
  
  let value = document.getElementById("editFieldInput").value.trim();
  
  if (!value) {
    alert("Please enter a value");
    return;
  }
  
  try {
    const updateData = {};
    
    if (currentEditField === 'username') {
      updateData.username = value;
    }
    
    const response = await fetch('/api/user', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || 'Failed to update profile'}`);
      return;
    }

    const result = await response.json();
    
    if (currentEditField === 'username') {
      document.getElementById("pseudoProfil").textContent = result.username;
      if (currentUserProfile) {
        currentUserProfile.username = result.username;
      }
    }
    
    closeEditFieldModal();
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('Error updating profile');
  }
}

// ============================
// AVATAR UPLOAD
// ============================

document.getElementById("editPhotoInput")?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || 'Upload failed'}`);
      return;
    }

    const result = await response.json();
    const avatarUrl = result.url || `/api/cdn/${result.filename}`;

    // Update avatar on page
    const avatarImg = document.querySelector('#profilePhotoName img[alt="Profile Photo"]');
    if (avatarImg) {
      avatarImg.src = avatarUrl;
    }

    // Update avatar in API
    const updateResponse = await fetch('/api/user', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ avatar_url: avatarUrl })
    });

    if (!updateResponse.ok) {
      console.error('Failed to update avatar in profile');
    } else {
      if (currentUserProfile) {
        currentUserProfile.avatar_url = avatarUrl;
      }
    }
  } catch (error) {
    console.error('Error uploading avatar:', error);
    alert('Error uploading avatar');
  }
});

// Allow clicking profile photo to change it
document.querySelector('#profilePhotoName img[alt="Profile Photo"]')?.addEventListener('click', () => {
  document.getElementById("editPhotoInput").click();
});

// ============================
// EVENT LISTENERS
// ============================

document.getElementById("editUserBtn")?.addEventListener("click", () => 
  openEditFieldModal('username')
);

document.getElementById("cancelEditField")?.addEventListener("click", closeEditFieldModal);
document.getElementById("editFieldModalOverlay")?.addEventListener("click", closeEditFieldModal);
document.getElementById("saveEditField")?.addEventListener("click", saveEditField);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("editFieldModal").style.display === "flex") {
    closeEditFieldModal();
  }
});

// ============================
// INITIALIZATION
// ============================

document.addEventListener('DOMContentLoaded', async () => {
  const username = getUsernameFromURL();
  const profile = await fetchUserProfile(username);
  
  if (profile) {
    displayUserProfile(profile);
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
    let profileImg = document.querySelector("#profilePhotoName > img");
    if (profileImg) {
      profileImg.src = savedProfilePhoto;
    }
  }
}

applySavedData();

// Photo
const profileImg = document.querySelector("#profilePhotoName > img");
const editPhotoInput = document.getElementById("editPhotoInput");

if (profileImg) {
  profileImg.addEventListener("click", () => {
    editPhotoInput.click();
  });
}

editPhotoInput.addEventListener("change", (e) => {
  let file = e.target.files[0];
  if (file) {
    // Create FormData to send the file
    let formData = new FormData();
    formData.append("image", file);
    
    // Send to server
    fetch("http://localhost:8080/api/upload", {
      method: "POST",
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.url) {
        // Update the image with the server URL
        profileImg.src = data.url;
        
        // Save the URL to localStorage
        localStorage.setItem("profilePhoto", data.url);
      } else {
        alert("Error uploading image");
      }
    })
    .catch(error => {
      console.error("Upload error:", error);
      alert("Failed to upload image");
    });
  }
});
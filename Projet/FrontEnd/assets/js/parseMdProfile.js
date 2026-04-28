function simpleMarkdown(text) {
  return text
    .replace(/# (.*)/g, '<h1>$1</h1>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/#### (.*)/g, '<h4>$1</h4>')
    .replace(/##### (.*)/g, '<h5>$1</h5>')
    .replace(/###### (.*)/g, '<h6>$1</h6>')
}

const md = "# Hello World\nThis is a **bold** text and this is an *italic* text.\n[Google](https://www.google.com)";

let ligns = md.split('\n').map(line => simpleMarkdown(line.trim())).join('<br>');


///////////////////////////////////////////////////////////////////////////////////////////////////////

// Lasts Posts

let date = new Date().toLocaleDateString();

for (let i = 0; i < 5; i++) {
  let post = document.createElement('div');
  post.classList.add('cardPost');
  post.id = 'post' + (i + 1);
  post.innerHTML = '<h3>Post Title ' + (i + 1) + '</h3>';
  post.innerHTML += '<p class="postDate">Posted on ' + date + '</p>';
  let viewBtn = document.createElement("button");
  viewBtn.innerText = "View";
  viewBtn.classList.add('viewPostButton');
  post.appendChild(viewBtn);
  document.getElementById('postContent').appendChild(post);
}


///////////////////////////////////////////////////////////////////////////////////////////////////////

// Edit Modal

let currentEditField = null;

function openEditFieldModal(fieldType) {
  currentEditField = fieldType;
  
  if (fieldType === 'username') {
    document.getElementById("editFieldLabel").textContent = "Username";
    document.getElementById("editFieldInput").value = document.getElementById("pseudoProfil").textContent;
  } else if (fieldType === 'description') {
    document.getElementById("editFieldLabel").textContent = "Description";
    document.getElementById("editFieldInput").value = document.getElementById("descriptionProfil").textContent;
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

function saveEditField() {
  if (!currentEditField) {
    return
  };
  
  let value = document.getElementById("editFieldInput").value.trim();
  
  if (!value) {
    alert("Please enter a value");
    return;
  }
  
  if (currentEditField === 'username') {
    document.getElementById("pseudoProfil").textContent = value;
    localStorage.setItem("username", value);
  } else if (currentEditField === 'description') {
    document.getElementById("descriptionProfil").textContent = value;
    localStorage.setItem("description", value);
  }
  
  closeEditFieldModal();
}

document.getElementById("editUserBtn").addEventListener("click", () => 
  openEditFieldModal('username')
);

document.getElementById("editDescBtn").addEventListener("click", () => 
  openEditFieldModal('description')
);

// Listeners

document.getElementById("cancelEditField").addEventListener("click", closeEditFieldModal);

document.getElementById("editFieldModalOverlay").addEventListener("click", closeEditFieldModal);

document.getElementById("saveEditField").addEventListener("click", saveEditField);

// Keys actions

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
  let savedDescription = localStorage.getItem("description");
  let savedProfilePhoto = localStorage.getItem("profilePhoto");

  if (savedUsername) {
    document.getElementById("pseudoProfil").textContent = savedUsername;
  }

  if (savedDescription) {
    document.getElementById("descriptionProfil").textContent = savedDescription;
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
    let reader = new FileReader();
    reader.onload = (event) => {
      let imageData = event.target.result;
      
      profileImg.src = imageData;
      
      localStorage.setItem("profilePhoto", imageData);
    };
    reader.readAsDataURL(file);
  }
});
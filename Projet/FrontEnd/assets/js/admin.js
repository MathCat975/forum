const usersTbody = document.getElementById("users-tbody");
const adminPanel = document.getElementById("admin-panel");
const adminError = document.getElementById("admin-error");
const adminLoading = document.getElementById("admin-loading");
const adminStats = document.getElementById("admin-stats");

let allUsers = [];

function showError(msg) {
  adminLoading.hidden = true;
  adminPanel.hidden = true;
  adminError.hidden = false;
  adminError.textContent = msg;
}

function roleBadgeClass(role) {
  if (role === "admin") return "role-badge role-badge--admin";
  if (role === "banned") return "role-badge role-badge--banned";
  return "role-badge role-badge--user";
}

function renderStats(users) {
  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const banned = users.filter((u) => u.role === "banned").length;
  const active = total - banned;

  adminStats.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat-card stat-card--green">
      <span class="stat-value">${active}</span>
      <span class="stat-label">Active</span>
    </div>
    <div class="stat-card stat-card--blue">
      <span class="stat-value">${admins}</span>
      <span class="stat-label">Admins</span>
    </div>
    <div class="stat-card stat-card--red">
      <span class="stat-value">${banned}</span>
      <span class="stat-label">Banned</span>
    </div>
  `;
}

function renderUsers(users) {
  usersTbody.innerHTML = users
    .map(
      (u) => `
    <tr data-uid="${u.id}">
      <td class="cell-id">${u.id}</td>
      <td class="cell-user">
        <strong>${forumEscapeHtml(u.username)}</strong>
      </td>
      <td class="cell-email">${forumEscapeHtml(u.email)}</td>
      <td>
        <span class="${roleBadgeClass(u.role)}">${forumEscapeHtml(u.role)}</span>
      </td>
      <td class="cell-date">${forumEscapeHtml(u.created_at)}</td>
      <td class="cell-actions">
        <select class="role-select" data-uid="${u.id}">
          <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
          <option value="banned" ${u.role === "banned" ? "selected" : ""}>Banned</option>
        </select>
        <button class="btn-delete-user" data-uid="${u.id}">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

async function changeRole(userId, newRole) {
  try {
    const resp = await fetch("/api/admin/users/role", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      alert(err?.error || "Failed to change role");
      return false;
    }
    return true;
  } catch {
    alert("Network error");
    return false;
  }
}

async function deleteUser(userId) {
  if (!confirm("Delete this user and all their content? This cannot be undone."))
    return;
  try {
    const resp = await fetch(`/api/admin/users/delete?id=${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      alert(err?.error || "Failed to delete user");
      return;
    }
    await loadUsers();
  } catch {
    alert("Network error");
  }
}

async function loadUsers() {
  adminLoading.hidden = false;
  adminPanel.hidden = true;
  adminError.hidden = true;

  try {
    const resp = await fetch("/api/admin/users", {
      credentials: "include",
      cache: "no-store",
    });

    if (resp.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (resp.status === 403) {
      showError("Access denied. Admins only.");
      return;
    }

    if (!resp.ok) {
      showError("Failed to load.");
      return;
    }

    allUsers = await resp.json();
    renderStats(allUsers);
    renderUsers(allUsers);
    adminLoading.hidden = true;
    adminPanel.hidden = false;
  } catch (err) {
    showError("Could not load users.");
  }
}

document.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".btn-delete-user");
  if (deleteBtn) {
    await deleteUser(Number(deleteBtn.dataset.uid));
    return;
  }
});

document.addEventListener("change", async (e) => {
  const select = e.target.closest(".role-select");
  if (!select) return;
  const uid = Number(select.dataset.uid);
  const newRole = select.value;
  const ok = await changeRole(uid, newRole);
  if (ok) {
    await loadUsers();
  } else {
    await loadUsers();
  }
});

loadUsers();

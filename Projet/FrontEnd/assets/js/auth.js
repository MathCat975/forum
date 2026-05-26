const authMessage = document.getElementById("authMessage");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const setAuthMessage = (message, tone = "") => {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.hidden = !message;
  authMessage.className = "auth-message";

  if (tone) {
    authMessage.classList.add(`auth-message--${tone}`);
  }
};

const setFormBusy = (form, busy) => {
  if (!form) {
    return;
  }

  form.querySelectorAll("button, input").forEach((element) => {
    element.disabled = busy;
  });
};

const redirectAfterAuth = () => {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (next && next.startsWith("/")) {
    window.location.href = next;
    return;
  }

  window.location.href = "/front/index";
};

const shouldShowAuthPage = async () => {
  try {
    const resp = await fetch("/api/user/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    return !resp.ok;
  } catch {
    return true;
  }
};

const persistSessionUsername = async () => {
  try {
    const profile = await forumFetch("/api/user/me");
    if (profile?.username) {
      localStorage.setItem("username", profile.username);
    }
  } catch {
    // Session cookie is enough; profile sync can happen later.
  }
};

if (loginForm || registerForm) {
  (async () => {
    if (!(await shouldShowAuthPage())) {
      redirectAfterAuth();
    }
  })();
}

if (loginForm) {
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");

  if (oauthError) {
    setAuthMessage("Sign-in was cancelled or failed. Try again.", "error");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthMessage("");

    const email = document.getElementById("email")?.value.trim() ?? "";
    const password = document.getElementById("password")?.value ?? "";

    if (!email || !password) {
      setAuthMessage("Email and password are required.", "error");
      return;
    }

    setFormBusy(loginForm, true);

    try {
      await forumFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await persistSessionUsername();
      redirectAfterAuth();
    } catch (error) {
      setAuthMessage(error.message || "Invalid email or password.", "error");
    } finally {
      setFormBusy(loginForm, false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthMessage("");

    const username = document.getElementById("username")?.value.trim() ?? "";
    const email = document.getElementById("email")?.value.trim() ?? "";
    const password = document.getElementById("password")?.value ?? "";

    if (!username || !email || !password) {
      setAuthMessage("Username, email, and password are required.", "error");
      return;
    }

    setFormBusy(registerForm, true);

    try {
      await forumFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      await persistSessionUsername();
      redirectAfterAuth();
    } catch (error) {
      setAuthMessage(error.message || "Registration failed.", "error");
    } finally {
      setFormBusy(registerForm, false);
    }
  });
}

document.querySelectorAll(".btn--google").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "/api/auth/google";
  });
});

document.querySelectorAll(".btn--github").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "/api/auth/github";
  });
});

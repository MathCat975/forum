document.addEventListener("DOMContentLoaded", () => {
  const shouldShowAuthPage = async () => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) {
      return false;
    }

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

  const loginForm = document.getElementById("login-form");

  (async () => {
    if (!(await shouldShowAuthPage())) {
      window.location.replace("/front/index");
      return;
    }
  })();

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("authMessage");

    if (!emailInput || !passwordInput) {
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      if (errorMessage) {
        errorMessage.textContent = "Please fill in all fields.";
        errorMessage.style.display = "block";
      }
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = "/front/index";
      } else {
        if (errorMessage) {
          errorMessage.textContent = data.error || "Invalid email or password.";
          errorMessage.hidden = false;
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (errorMessage) {
        errorMessage.textContent = "An error occurred. Please try again later.";
        errorMessage.hidden = false;
      }
    }
  });

  // Boutons de connexion Social OAuth
  const btnGoogle = document.querySelector(".btn--google");
  const btnGithub = document.querySelector(".btn--github");

  btnGoogle?.addEventListener("click", () => {
    window.location.href = "/api/auth/google";
  });

  btnGithub?.addEventListener("click", () => {
    window.location.href = "/api/auth/github";
  });
});
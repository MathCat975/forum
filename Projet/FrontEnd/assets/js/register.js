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

  const registerForm = document.getElementById("register-form");

  (async () => {
    if (!(await shouldShowAuthPage())) {
      window.location.replace("/front/index");
      return;
    }
  })();

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("authMessage");

    if (!usernameInput || !emailInput || !passwordInput) {
      return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (errorMessage) {
      errorMessage.textContent = "";
      errorMessage.hidden = true;
    }

    if (!username || !email || !password) {
      if (errorMessage) {
        errorMessage.textContent = "All fields are required.";
        errorMessage.hidden = false;
      }
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          username: username,
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = "/front/index";
      } else {
        if (errorMessage) {
          errorMessage.textContent = data.error || "Registration failed. Please try again.";
          errorMessage.hidden = false;
        }
      }
    } catch (error) {
      console.error("Register error:", error);
      if (errorMessage) {
        errorMessage.textContent = "An error occurred. Please try again later.";
        errorMessage.hidden = false;
      }
    }
  });

  // Boutons d'inscription Social OAuth (Même logique que le Login)
  const btnGoogle = document.querySelector(".btn--google");
  const btnGithub = document.querySelector(".btn--github");

  btnGoogle?.addEventListener("click", () => {
    window.location.href = "/api/auth/google";
  });

  btnGithub?.addEventListener("click", () => {
    window.location.href = "/api/auth/github";
  });
});
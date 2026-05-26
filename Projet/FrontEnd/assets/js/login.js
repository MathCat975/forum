document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("errorMessage");

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
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Optionnel : Stocker le username dans le localStorage si renvoyé par l'API
        if (data.username) {
          localStorage.setItem("username", data.username);
        }
        window.location.href = "/front/index";
      } else {
        if (errorMessage) {
          errorMessage.textContent = data.error || "Invalid email or password.";
          errorMessage.style.display = "block";
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (errorMessage) {
        errorMessage.textContent = "An error occurred. Please try again later.";
        errorMessage.style.display = "block";
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
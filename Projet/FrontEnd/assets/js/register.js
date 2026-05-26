document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");

    if (!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
      return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Réinitialisation des messages
    if (errorMessage) {
      errorMessage.style.display = "none";
    }
    if (successMessage) {
      successMessage.style.display = "none";
    }

    if (!username || !email || !password || !confirmPassword) {
      if (errorMessage) {
        errorMessage.textContent = "All fields are required.";
        errorMessage.style.display = "block";
      }
      return;
    }

    if (password !== confirmPassword) {
      if (errorMessage) {
        errorMessage.textContent = "Passwords do not match.";
        errorMessage.style.display = "block";
      }
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (successMessage) {
          successMessage.textContent = data.message || "Registration successful! Redirecting...";
          successMessage.style.display = "block";
        }
        // Redirection automatique vers la page de login après 2 secondes
        setTimeout(() => {
          window.location.href = "/front/login";
        }, 2000);
      } else {
        if (errorMessage) {
          errorMessage.textContent = data.error || "Registration failed. Please try again.";
          errorMessage.style.display = "block";
        }
      }
    } catch (error) {
      console.error("Register error:", error);
      if (errorMessage) {
        errorMessage.textContent = "An error occurred. Please try again later.";
        errorMessage.style.display = "block";
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
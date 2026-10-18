/**
 * Food Freshness Monitoring Platform - Authentication Logic
 * Handles registration, login, role restrictions, and session redirection.
 */

document.addEventListener("DOMContentLoaded", () => {
  // If user is already authenticated and visits login/register, redirect to dashboard
  // If user is already authenticated and visits login/register, redirect to dashboard
  if (api.isAuthenticated()) {
    const path = window.location.pathname;
    if (path.includes("login.html") || path.includes("register.html")) {
      const user = api.getUser();
      window.location.href = getDashboardUrlForRole(user ? user.role : null);
      return;
    }
  }

  // Login Form Handling
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const alertBox = document.getElementById("auth-alert");
      const submitBtn = document.getElementById("login-submit-btn");

      if (alertBox) alertBox.style.display = "none";

      // Basic client-side validation
      if (!email || !password) {
        showAuthError("Please provide both email and password.");
        return;
      }

      setButtonLoading(submitBtn, true, "Sign In");

      try {
        await api.login({ email, password });
        showToast("Login successful! Redirecting...", "success");
        const user = api.getUser();
        const targetUrl = getDashboardUrlForRole(user ? user.role : null);
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 600);
      } catch (err) {
        setButtonLoading(submitBtn, false, "Sign In");
        showAuthError(err.message || "Invalid credentials. Please verify and try again.");
      }
    });

    // Quick demo autofill buttons
    setupDemoAutofill();
  }

  // Registration Form Handling
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const role = document.getElementById("role").value;
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirm_password").value;
      const alertBox = document.getElementById("auth-alert");
      const submitBtn = document.getElementById("register-submit-btn");

      if (alertBox) alertBox.style.display = "none";

      // Client-side validations
      if (!name || name.length < 2) {
        showAuthError("Full Name must be at least 2 characters.");
        return;
      }

      if (!validateEmail(email)) {
        showAuthError("Please enter a valid email address.");
        return;
      }

      if (!password || password.length < 6) {
        showAuthError("Password must be at least 6 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        showAuthError("Passwords do not match. Please re-enter.");
        return;
      }

      setButtonLoading(submitBtn, true, "Create Account");

      try {
        await api.register({
          name,
          email,
          role,
          password,
          confirm_password: confirmPassword,
        });

        showToast("Account created successfully! Please sign in.", "success");
        setTimeout(() => {
          window.location.href = "login.html?registered=true";
        }, 1000);
      } catch (err) {
        setButtonLoading(submitBtn, false, "Create Account");
        showAuthError(err.message || "Registration failed. Please check your details.");
      }
    });
  }
});

function showAuthError(msg) {
  const alertBox = document.getElementById("auth-alert");
  if (alertBox) {
    alertBox.className = "auth-alert error";
    alertBox.textContent = msg;
    alertBox.style.display = "block";
  }
  showToast(msg, "error");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setupDemoAutofill() {
  const buttons = document.querySelectorAll(".demo-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      const password = btn.dataset.password;
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");

      if (emailInput && passwordInput) {
        emailInput.value = email;
        passwordInput.value = password;
        showToast(`Filled credentials for ${btn.dataset.role || 'Demo'} account`, "info");
      }
    });
  });
}

function getDashboardUrlForRole(role) {
  if (!role) return "dashboard.html";
  const r = role.trim();
  if (r === "Retailer") return "retailer-dashboard.html";
  if (r === "Food Quality Inspector" || r === "Quality Inspector") return "dashboard-inspector.html";
  if (r === "Admin") return "admin-dashboard.html";
  if (r === "Warehouse Operator" || r === "Warehouse Manager" || r === "Supply Chain Operator") return "warehouse-dashboard.html";
  return "dashboard.html"; // Consumer default
}


/**
 * Food Freshness Monitoring Platform - Authentication Logic
 * Handles registration, login, role restrictions, and post-login redirection.
 *
 * NOTE: Preserves requested destinations (returnUrl/redirect) across
 * authentication flows and routes to the requested page or role dashboard.
 */

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. Capture and preserve requested redirect destination (query param or sessionStorage)
  const incomingRedirect =
    urlParams.get("redirect") ||
    urlParams.get("returnUrl") ||
    urlParams.get("return_url");

  if (incomingRedirect) {
    const sanitized = api.sanitizeReturnUrl(incomingRedirect);
    if (sanitized) {
      try {
        sessionStorage.setItem("food_freshness_return_url", sanitized);
      } catch (e) {
        console.warn("Could not save return_url:", e);
      }
    }
  }

  // Preserve redirect parameter on links to register.html or login.html
  const currentReturn = api.getSavedReturnUrl();
  if (currentReturn) {
    document.querySelectorAll('a[href="register.html"], a[href^="register.html?"]').forEach((link) => {
      link.href = `register.html?redirect=${encodeURIComponent(currentReturn)}`;
    });
    document.querySelectorAll('a[href="login.html"], a[href^="login.html?"]').forEach((link) => {
      link.href = `login.html?redirect=${encodeURIComponent(currentReturn)}`;
    });
  }

  // 2. Handle Logout, Registered, and Session Expiry Notices
  if (urlParams.get("logged_out") === "true") {
    api.clearSession();
    api.clearReturnUrl();
    showAuthSuccess("You have been successfully signed out.");
  } else if (urlParams.get("registered") === "true") {
    showAuthSuccess("Account created successfully! Please sign in with your credentials.");
  } else if (urlParams.get("session_expired") === "true" || urlParams.get("expired") === "true") {
    api.clearSession();
    showAuthError("Your session has expired. Please sign in again.");
  }

  // 3. If user already has an active session, display non-intrusive banner on login.html (no auto-redirect!)
  if (api.isAuthenticated()) {
    const activeUser = api.getUser();
    const banner = document.getElementById("active-session-banner");
    if (banner && activeUser) {
      banner.style.display = "block";
      const nameSpan = document.getElementById("active-user-name");
      const roleSpan = document.getElementById("active-user-role");
      const linkBtn = document.getElementById("link-active-dashboard");
      if (nameSpan) nameSpan.textContent = activeUser.name || activeUser.email || "User";
      if (roleSpan) roleSpan.textContent = activeUser.role || "Active Role";
      if (linkBtn) {
        const dest = resolvePostLoginTarget(activeUser, currentReturn);
        linkBtn.href = dest;
        if (currentReturn) {
          linkBtn.innerHTML = `continue to your requested page (${currentReturn}) &rarr;`;
        }
      }
    }
  }

  // 4. Login Form Handling
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const alertBox = document.getElementById("auth-alert");
      const submitBtn = document.getElementById("login-submit-btn");

      if (alertBox) alertBox.style.display = "none";

      if (!email || !password) {
        showAuthError("Please provide both email and password.");
        return;
      }

      setButtonLoading(submitBtn, true, "Signing In...");

      try {
        await api.login({ email, password });

        const user = api.getUser();
        const savedRedirect = api.getSavedReturnUrl();
        const targetUrl = resolvePostLoginTarget(user, savedRedirect);

        // Clear stored return URL after successful resolution
        api.clearReturnUrl();

        showToast(`Login successful! Redirecting to ${targetUrl}...`, "success");

        setTimeout(() => {
          window.location.href = targetUrl;
        }, 400);
      } catch (err) {
        setButtonLoading(submitBtn, false, "Sign In to Platform");
        showAuthError(err.message || "Invalid credentials. Please verify and try again.");
      }
    });

    // Quick demo autofill buttons
    setupDemoAutofill();
  }

  // 5. Registration Form Handling
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

      setButtonLoading(submitBtn, true, "Creating Account...");

      try {
        await api.register({
          name,
          email,
          role,
          password,
          confirm_password: confirmPassword,
        });

        // Attempt automatic seamless authentication
        try {
          await api.login({ email, password });
          const user = api.getUser();
          const savedRedirect = api.getSavedReturnUrl();
          const targetUrl = resolvePostLoginTarget(user, savedRedirect);
          api.clearReturnUrl();

          showToast(`Account created! Welcoming ${user?.name || name} to ${targetUrl}...`, "success");
          setTimeout(() => {
            window.location.href = targetUrl;
          }, 450);
          return;
        } catch (autoLoginErr) {
          // If auto-login fails, redirect to login page with preserved destination
          showToast("Account created successfully! Please sign in with your credentials.", "success");
          const targetReturn = api.getSavedReturnUrl();
          const redirectParam = targetReturn
            ? `&redirect=${encodeURIComponent(targetReturn)}`
            : "";

          setTimeout(() => {
            window.location.href = `login.html?registered=true${redirectParam}`;
          }, 700);
        }
      } catch (err) {
        setButtonLoading(submitBtn, false, "Create Free Account");
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

function showAuthSuccess(msg) {
  const alertBox = document.getElementById("auth-alert");
  if (alertBox) {
    alertBox.className = "auth-alert success";
    alertBox.textContent = msg;
    alertBox.style.display = "block";
  }
  showToast(msg, "success");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setButtonLoading(btn, isLoading, originalText = "Submit") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid white; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:8px;"></span> Loading...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || originalText;
  }
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
  if (r === "Admin" || r === "Administrator" || r.toLowerCase().includes("admin")) return "admin-dashboard.html";
  if (
    r === "Warehouse Operator" ||
    r === "Warehouse Manager" ||
    r === "Supply Chain Operator" ||
    r === "Food Manufacturer"
  ) {
    return "warehouse-dashboard.html";
  }
  return "dashboard.html"; // Consumer default
}

/**
 * Resolves target destination after login, respecting role boundaries and open-redirect protections.
 */
function resolvePostLoginTarget(user, requestedRedirect) {
  const userRole = user ? user.role : null;
  const defaultDashboard = getDashboardUrlForRole(userRole);

  if (!requestedRedirect) {
    return defaultDashboard;
  }

  const clean = api.sanitizeReturnUrl(requestedRedirect);
  if (!clean) {
    return defaultDashboard;
  }

  // Cross-role verification: verify that the user's role permits access to this page
  if (!api.isPageAuthorizedForRole(clean, userRole)) {
    const pageName = clean.split("?")[0].split("#")[0].split("/").pop();
    sessionStorage.setItem(
      "access_restricted_alert",
      `Access Restricted: Your account role (${userRole || "User"}) is not authorized to access '${pageName}'. Redirected to your authorized dashboard.`
    );
    return defaultDashboard;
  }

  return clean;
}

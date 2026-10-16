
import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./Dashboard";

import {
  getAuthToken,
  setStoredAuth,
  clearStoredAuth,
  loginUser,
  registerUser,
  fetchCurrentUser,
} from "./api";

function App() {
  // ============================================================
  // SESSION & AUTH STATE
  // ============================================================

  const [isInitializing, setIsInitializing] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // ============================================================
  // LOGIN FORM STATE
  // ============================================================

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ============================================================
  // REGISTER FORM STATE
  // ============================================================

  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState("Consumer");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  // ============================================================
  // RESTORE SESSION ON INITIAL LOAD
  // ============================================================

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = getAuthToken();

      if (!token) {
        if (active) {
          clearStoredAuth();
          setLoggedInUser(null);
          setIsInitializing(false);
        }
        return;
      }

      try {
        const userData = await fetchCurrentUser(token);

        if (!active) return;

        setStoredAuth(token, userData);
        setLoggedInUser(userData);
      } catch (error) {
        console.warn(
          "Session restore failed or expired:",
          error?.message || error
        );

        clearStoredAuth();

        if (active) {
          setLoggedInUser(null);
        }
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const data = await loginUser(email, password);
      const token = data.access_token;

      const userData = await fetchCurrentUser(token);

      setStoredAuth(token, userData);
      setLoggedInUser(userData);
      setShowLogin(false);

      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Login error:", error);

      setMessage(
        error?.message ||
          "Unable to connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // REGISTER
  // ============================================================

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterMessage("");
    setRegisterLoading(true);

    try {
      await registerUser({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        role: registerRole,
      });

      setRegisterMessage(
        "Account created successfully! You can now log in."
      );

      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterRole("Consumer");

      setTimeout(() => {
        setShowRegister(false);
        setShowLogin(true);
        setRegisterMessage("");
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);

      setRegisterMessage(
        error?.message ||
          "Unable to connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    clearStoredAuth();
    setLoggedInUser(null);
    setEmail("");
    setPassword("");
    setMessage("");
  };

  // ============================================================
  // OPEN LOGIN / REGISTER
  // ============================================================

  const openLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
    setMessage("");
    setRegisterMessage("");
  };

  const openRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
    setMessage("");
    setRegisterMessage("");
  };

  // ============================================================
  // INITIAL LOADING SCREEN
  // ============================================================

  if (isInitializing) {
    return (
      <div className="app-loading">
        <div className="loading-icon">🍎</div>
        <h2>FoodFresh</h2>
        <p>Loading your session...</p>
        <div className="loading-line" />
      </div>
    );
  }

  // ============================================================
  // ROLE-BASED DASHBOARD
  // ============================================================

  if (loggedInUser) {
    return (
      <Dashboard
        user={loggedInUser}
        onLogout={handleLogout}
      />
    );
  }

  // ============================================================
  // LANDING PAGE
  // ============================================================

  return (
    <div className="app">
      {/* NAVIGATION */}

      <nav className="navbar">
        <a href="#home" className="logo">
          <span className="logo-icon">🍎</span>
          <span>
            Food<span className="logo-highlight">Fresh</span>
          </span>
        </a>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>

          <button
            type="button"
            className="login-btn"
            onClick={openLogin}
          >
            Log In
          </button>

          <button
            type="button"
            className="nav-signup-btn"
            onClick={openRegister}
          >
            Get Started <span>→</span>
          </button>
        </div>
      </nav>

      <main>
        {/* HERO SECTION */}

        <section id="home" className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot" />
              SMART FOOD FRESHNESS MONITORING
            </div>

            <h1>
              Keep Food Fresh.
              <br />
              <span>Reduce Food Waste.</span>
            </h1>

            <p className="hero-text">
              Monitor food freshness, manage inventory, track storage
              conditions, and make smarter decisions with one intelligent
              food monitoring platform.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="get-started-btn"
                onClick={openRegister}
              >
                Get Started <span>→</span>
              </button>

              <a href="#features" className="secondary-btn">
                Explore Features <span>↓</span>
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-icon">✓</div>
              <p>Smarter monitoring. Safer food. Less waste.</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-image-wrap">
              <div className="hero-image">
                <div className="image-overlay">
                  <span className="image-label">
                    <span className="status-dot" />
                    Freshness Monitoring
                  </span>
                </div>
              </div>
            </div>

            <div className="floating-card freshness-card">
              <div className="floating-icon green-icon">🌿</div>
              <div>
                <strong>Freshness Tracking</strong>
                <p>Monitor food condition</p>
              </div>
              <span className="card-check">✓</span>
            </div>

            <div className="floating-card storage-card">
              <div className="floating-icon orange-icon">🌡️</div>
              <div>
                <strong>Storage Conditions</strong>
                <p>Track temperature</p>
              </div>
            </div>

            <div className="hero-decoration decoration-one" />
            <div className="hero-decoration decoration-two" />
          </div>
        </section>

        {/* INTRODUCTION STRIP */}

        <section className="intro-strip">
          <div className="intro-item">
            <span className="intro-icon">📦</span>
            <div>
              <strong>Smart Inventory</strong>
              <p>Organized food records</p>
            </div>
          </div>

          <div className="intro-divider" />

          <div className="intro-item">
            <span className="intro-icon">🤖</span>
            <div>
              <strong>AI-Powered Analysis</strong>
              <p>Intelligent freshness insights</p>
            </div>
          </div>

          <div className="intro-divider" />

          <div className="intro-item">
            <span className="intro-icon">🔔</span>
            <div>
              <strong>Timely Alerts</strong>
              <p>Stay informed about food conditions</p>
            </div>
          </div>
        </section>

        {/* FEATURES */}

        <section id="features" className="features-section">
          <div className="section-heading">
            <span className="section-eyebrow">WHAT WE OFFER</span>

            <h2>
              Everything You Need to
              <br />
              <span>Manage Food Smarter</span>
            </h2>

            <p>
              One platform to monitor freshness, manage food stock,
              improve storage, and support better decisions.
            </p>
          </div>

          <div className="features">
            <article className="feature-card">
              <div className="feature-icon feature-green">📦</div>
              <span className="feature-number">01</span>
              <h3>Inventory Management</h3>
              <p>
                Organize food items, maintain inventory records, and
                manage batches in one convenient place.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>

            <article className="feature-card">
              <div className="feature-icon feature-orange">🌡️</div>
              <span className="feature-number">02</span>
              <h3>Storage Monitoring</h3>
              <p>
                Monitor storage conditions and help keep food in
                suitable temperature environments.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>

            <article className="feature-card">
              <div className="feature-icon feature-purple">🤖</div>
              <span className="feature-number">03</span>
              <h3>AI Freshness Analysis</h3>
              <p>
                Analyze food images to support freshness assessment
                and identify food that may need attention.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>

            <article className="feature-card">
              <div className="feature-icon feature-red">⚠️</div>
              <span className="feature-number">04</span>
              <h3>Alerts & Notifications</h3>
              <p>
                Stay informed about important food conditions,
                approaching expiry dates, and items requiring attention.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>

            <article className="feature-card">
              <div className="feature-icon feature-blue">📊</div>
              <span className="feature-number">05</span>
              <h3>Analytics & Reports</h3>
              <p>
                Review freshness information and reports to better
                understand inventory and food conditions.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>

            <article className="feature-card">
              <div className="feature-icon feature-yellow">💡</div>
              <span className="feature-number">06</span>
              <h3>Smart Recommendations</h3>
              <p>
                Identify items that may need to be sold, used,
                inspected, or prioritized based on available records.
              </p>
              <a href="#how-it-works" className="feature-link">
                Learn more <span>→</span>
              </a>
            </article>
          </div>
        </section>

        {/* HOW IT WORKS */}

        <section id="how-it-works" className="workflow-section">
          <div className="workflow-content">
            <span className="section-eyebrow">SIMPLE & INTELLIGENT</span>

            <h2>
              A Smarter Way to
              <br />
              <span>Monitor Food Freshness</span>
            </h2>

            <p className="workflow-description">
              FoodFresh brings important food information together
              so users can monitor items, understand their condition,
              and take action when needed.
            </p>

            <div className="workflow-steps">
              <div className="workflow-step">
                <div className="step-number">01</div>
                <div>
                  <h3>Add Food Information</h3>
                  <p>
                    Maintain food item, batch, and inventory details.
                  </p>
                </div>
              </div>

              <div className="workflow-step">
                <div className="step-number">02</div>
                <div>
                  <h3>Monitor and Analyze</h3>
                  <p>
                    Review freshness analysis, expiry information,
                    and storage conditions.
                  </p>
                </div>
              </div>

              <div className="workflow-step">
                <div className="step-number">03</div>
                <div>
                  <h3>Take Timely Action</h3>
                  <p>
                    Use available insights to prioritize food items
                    and help reduce avoidable waste.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="get-started-btn workflow-btn"
              onClick={openRegister}
            >
              Get Started Today <span>→</span>
            </button>
          </div>

          <div className="workflow-visual">
            <div className="workflow-main-card">
              <div className="workflow-card-top">
                <div>
                  <span className="mini-label">FOOD MONITORING</span>
                  <h3>Freshness Overview</h3>
                </div>
                <span className="workflow-leaf">🌱</span>
              </div>

              <div className="workflow-illustration">
                <span>🥑</span>
                <span>🥦</span>
                <span>🍅</span>
                <span>🍋</span>
                <span>🥕</span>
              </div>

              <div className="workflow-info">
                <div className="workflow-info-icon">✓</div>
                <div>
                  <strong>Monitor food condition</strong>
                  <p>Keep your food records organized</p>
                </div>
              </div>

              <div className="workflow-info">
                <div className="workflow-info-icon">↗</div>
                <div>
                  <strong>Make informed decisions</strong>
                  <p>Review insights and recommendations</p>
                </div>
              </div>
            </div>

            <div className="workflow-decoration" />
          </div>
        </section>

        {/* ABOUT */}

        <section id="about" className="about-section">
          <div className="about-visual">
            <div className="about-image">
              <div className="about-image-caption">
                <span>🌍</span>
                <div>
                  <strong>A Better Way Forward</strong>
                  <p>Helping make food management smarter</p>
                </div>
              </div>
            </div>
          </div>

          <div className="about-content">
            <span className="section-eyebrow">ABOUT FOODFRESH</span>

            <h2>
              Better Food Management.
              <br />
              <span>Less Waste.</span>
            </h2>

            <p>
              FoodFresh is an AI-powered food freshness monitoring
              platform designed to support smarter food inventory
              management and improved food safety.
            </p>

            <p>
              By bringing food records, freshness analysis, storage
              monitoring, and actionable insights together, the platform
              helps users make more informed decisions about their food.
            </p>

            <div className="about-points">
              <div>
                <span>✓</span> Organized food inventory
              </div>
              <div>
                <span>✓</span> Freshness and expiry awareness
              </div>
              <div>
                <span>✓</span> Better storage monitoring
              </div>
              <div>
                <span>✓</span> Waste reduction support
              </div>
            </div>

            <button
              type="button"
              className="get-started-btn"
              onClick={openRegister}
            >
              Explore FoodFresh <span>→</span>
            </button>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}

        <section className="cta-section">
          <div className="cta-decoration cta-decoration-one" />
          <div className="cta-decoration cta-decoration-two" />

          <div className="cta-content">
            <span className="cta-eyebrow">START MONITORING SMARTER</span>

            <h2>
              Let's Make Every
              <br />
              <span>Food Item Count.</span>
            </h2>

            <p>
              Take a smarter approach to food freshness, inventory,
              and waste reduction with FoodFresh.
            </p>

            <button
              type="button"
              className="cta-button"
              onClick={openRegister}
            >
              Create Your Account <span>→</span>
            </button>
          </div>

          <div className="cta-emoji" aria-hidden="true">
            🥬
          </div>
        </section>
      </main>

      {/* FOOTER */}

      <footer className="footer">
        <a href="#home" className="logo footer-logo">
          <span className="logo-icon">🍎</span>
          <span>
            Food<span className="logo-highlight">Fresh</span>
          </span>
        </a>

        <p>
          Smarter food monitoring for a fresher future.
        </p>

        <div className="footer-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <button type="button" onClick={openLogin}>
            Login
          </button>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} FoodFresh. Food freshness
          monitoring platform.
        </div>
      </footer>

      {/* ============================================================
          LOGIN MODAL
      ============================================================ */}

      {showLogin && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogin(false);
              setMessage("");
            }
          }}
        >
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <button
              type="button"
              className="close-btn"
              aria-label="Close login"
              onClick={() => {
                setShowLogin(false);
                setMessage("");
              }}
            >
              ×
            </button>

            <div className="modal-brand-icon">🍎</div>

            <h2 id="login-title">Welcome Back</h2>
            <p>Log in to your FoodFresh account</p>

            <form onSubmit={handleLogin}>
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {message && (
                <p className="message" role="alert">
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Log In to FoodFresh"}
              </button>
            </form>

            <p className="register-text">
              Don't have an account?{" "}
              <button
                type="button"
                className="text-link"
                onClick={openRegister}
              >
                Create Account
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ============================================================
          REGISTRATION MODAL
      ============================================================ */}

      {showRegister && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRegister(false);
              setRegisterMessage("");
            }
          }}
        >
          <div
            className="login-modal register-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-title"
          >
            <button
              type="button"
              className="close-btn"
              aria-label="Close registration"
              onClick={() => {
                setShowRegister(false);
                setRegisterMessage("");
              }}
            >
              ×
            </button>

            <div className="modal-brand-icon">🌱</div>

            <h2 id="register-title">Create Account</h2>
            <p>Join the FoodFresh platform</p>

            <form onSubmit={handleRegister}>
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                placeholder="Enter your full name"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                autoComplete="name"
                required
              />

              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                type="email"
                placeholder="Enter your email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                placeholder="Create a password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />

              <label htmlFor="register-role">Select your role</label>
              <select
                id="register-role"
                value={registerRole}
                onChange={(e) => setRegisterRole(e.target.value)}
                required
              >
                <option value="Consumer">Consumer</option>
                <option value="Retail Manager">Retail Manager</option>
                <option value="Warehouse Operator">
                  Warehouse Operator
                </option>
                <option value="Food Quality Inspector">
                  Food Quality Inspector
                </option>
                <option value="Administrator">Administrator</option>
              </select>

              {registerMessage && (
                <p className="message" role="status">
                  {registerMessage}
                </p>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={registerLoading}
              >
                {registerLoading
                  ? "Creating Account..."
                  : "Create My Account"}
              </button>
            </form>

            <p className="register-text">
              Already have an account?{" "}
              <button
                type="button"
                className="text-link"
                onClick={openLogin}
              >
                Log In
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

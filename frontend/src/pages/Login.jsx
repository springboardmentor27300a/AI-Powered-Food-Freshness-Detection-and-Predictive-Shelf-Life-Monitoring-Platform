import { useState } from "react";
import { loginUser } from "../api";

function Login({ onLoginSuccess, onRegisterPage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await loginUser(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="floating-food food-one">🍎</div>
      <div className="floating-food food-two">🥕</div>
      <div className="floating-food food-three">🥦</div>
      <div className="floating-food food-four">🍋</div>
      <div className="floating-food food-five">🍅</div>

      <div className="auth-container">
        <div className="auth-logo">🍏</div>

        <div className="auth-heading">
          <span className="mini-label">FOOD INTELLIGENCE</span>

          <h1>Welcome Back</h1>

          <p>
            Monitor your food freshness and
            keep your inventory smarter.
          </p>
        </div>

        {error && (
          <div className="error-box">
            ⚠️ {error}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label>Email Address</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="primary-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account?

          <button onClick={onRegisterPage}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
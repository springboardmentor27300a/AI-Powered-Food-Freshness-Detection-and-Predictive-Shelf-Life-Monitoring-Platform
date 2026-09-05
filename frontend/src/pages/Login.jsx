import { useState } from "react";
import { loginUser } from "../api";

function Login({
  onLoginSuccess,
  onRegisterPage,
}) {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ==========================================================
  // LOGIN
  // ==========================================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setLoading(true);


    try {

      const data =
        await loginUser(
          email,
          password
        );


      // ======================================================
      // ROLE
      // ======================================================

      const role =
        data?.role ||
        localStorage.getItem(
          "user_role"
        );


      console.log(
        "Logged in user role:",
        role
      );


      // ======================================================
      // LOGIN SUCCESS
      // ======================================================

      onLoginSuccess(
        role
      );

    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setLoading(false);

    }

  };


  return (

    <div className="auth-page">

      <div className="floating-food food-one">
        🍎
      </div>

      <div className="floating-food food-two">
        🥕
      </div>

      <div className="floating-food food-three">
        🥦
      </div>

      <div className="floating-food food-four">
        🍋
      </div>

      <div className="floating-food food-five">
        🍅
      </div>


      <div className="auth-container">

        <div className="auth-logo">
          🍏
        </div>


        <div className="auth-heading">

          <span className="mini-label">
            FOOD INTELLIGENCE
          </span>

          <h1>
            Welcome Back
          </h1>

          <p>
            Monitor your food freshness and
            keep your inventory smarter.
          </p>

        </div>


        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (

          <div className="error-box">
            ⚠️ {error}
          </div>

        )}


        {/* ==================================================
            LOGIN FORM
        ================================================== */}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {/* EMAIL */}

          <div className="form-group">

            <label>
              Email Address
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
              disabled={loading}
            />

          </div>


          {/* PASSWORD */}

          <div className="form-group">

            <label>
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
              disabled={loading}
            />

          </div>


          {/* LOGIN BUTTON */}

          <button
            className="primary-button"
            disabled={loading}
            type="submit"
          >

            {loading
              ? "Signing in..."
              : "Sign In →"}

          </button>

        </form>


        {/* ==================================================
            REGISTER LINK
        ================================================== */}

        <div className="auth-link">

          Don't have an account?

          <button
            onClick={onRegisterPage}
            disabled={loading}
          >
            Create Account
          </button>

        </div>

      </div>

    </div>

  );
}

export default Login;
import { useState } from "react";

import {
  registerUser,
} from "../api";


function Register({
  onLoginPage,
}) {

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [role, setRole] =
    useState("consumer");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  // ==========================================================
  // REGISTER
  // ==========================================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);


    try {

      await registerUser({
        name,
        email,
        password,
        role
      });


      setSuccess(
        "Account created successfully! You can login now."
      );


      setName("");
      setEmail("");
      setPassword("");
      setRole("consumer");

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
        🍓
      </div>

      <div className="floating-food food-two">
        🥬
      </div>

      <div className="floating-food food-three">
        🍊
      </div>

      <div className="floating-food food-four">
        🥑
      </div>

      <div className="floating-food food-five">
        🍅
      </div>


      <div className="auth-container register-container">

        <div className="auth-logo">
          🥬
        </div>


        <div className="auth-heading">

          <span className="mini-label">
            GET STARTED
          </span>

          <h1>
            Create Account
          </h1>

          <p>
            Start monitoring your food inventory
            with freshness intelligence.
          </p>

        </div>


        {error && (

          <div className="error-box">
            ⚠️ {error}
          </div>

        )}


        {success && (

          <div className="success-box">
            ✓ {success}
          </div>

        )}


        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {/* ==================================================
              NAME
          ================================================== */}

          <div className="form-group">

            <label>
              Full Name
            </label>

            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
              disabled={loading}
            />

          </div>


          {/* ==================================================
              EMAIL
          ================================================== */}

          <div className="form-group">

            <label>
              Email Address
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              disabled={loading}
            />

          </div>


          {/* ==================================================
              PASSWORD
          ================================================== */}

          <div className="form-group">

            <label>
              Password
            </label>

            <input
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              minLength={6}
              required
              disabled={loading}
            />

          </div>


          {/* ==================================================
              ROLE
          ================================================== */}

          <div className="form-group">

            <label>
              Account Role
            </label>

            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value)
              }
              disabled={loading}
              required
            >

              <option value="consumer">
                Consumer
              </option>

              <option value="retail_manager">
                Retail Manager
              </option>

              <option value="warehouse_operator">
                Warehouse Operator
              </option>

              <option value="food_quality_inspector">
                Food Quality Inspector
              </option>

            </select>

          </div>


          {/* ==================================================
              CREATE ACCOUNT
          ================================================== */}

          <button
            className="primary-button"
            disabled={loading}
            type="submit"
          >

            {loading
              ? "Creating Account..."
              : "Create Account →"}

          </button>

        </form>


        <div className="auth-link">

          Already have an account?

          <button
            onClick={onLoginPage}
            disabled={loading}
          >
            Sign In
          </button>

        </div>

      </div>

    </div>
  );
}


export default Register;
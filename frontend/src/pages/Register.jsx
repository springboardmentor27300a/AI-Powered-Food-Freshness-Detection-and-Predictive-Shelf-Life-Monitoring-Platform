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
        role,
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
        err?.message ||
          "Registration failed. Please try again."
      );

    } finally {

      setLoading(false);
    }
  };


  return (

    <div
      className="auth-page register-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >

      {/* ======================================================
          RESPONSIVE REGISTER STYLES
      ====================================================== */}

      <style>
        {`

          .register-page {
            position: relative;
            width: 100%;
            min-height: 100vh;
            box-sizing: border-box;
          }


          .register-page .register-container {
            box-sizing: border-box;
            width: min(100% - 32px, 520px);
            max-width: 520px;
          }


          .register-page .auth-heading {
            min-width: 0;
          }


          .register-page .auth-heading h1 {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .register-page .auth-heading p {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .register-page .error-box,
          .register-page .success-box {
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .register-page .auth-form {
            width: 100%;
            min-width: 0;
          }


          .register-page .form-group {
            width: 100%;
            min-width: 0;
          }


          .register-page .form-group input,
          .register-page .form-group select {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }


          .register-page .primary-button {
            width: 100%;
            min-height: 52px;
            box-sizing: border-box;
            touch-action: manipulation;
          }


          .register-page .auth-link {
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: anywhere;
          }


          .register-page .auth-link button {
            touch-action: manipulation;
          }


          @media (max-width: 700px) {

            .register-page {
              padding:
                24px 16px !important;
            }


            .register-page .register-container {
              width: 100%;
              max-width: 500px;
            }

          }


          @media (max-width: 520px) {

            .register-page {
              padding:
                20px 13px !important;
            }


            .register-page .register-container {
              width: 100%;
              max-width: none;
            }


            .register-page .auth-logo {
              width: 66px !important;
              height: 66px !important;
              min-width: 66px !important;
              font-size: 31px !important;
              margin-bottom: 17px !important;
            }


            .register-page .auth-heading {
              margin-bottom: 21px !important;
            }


            .register-page .auth-heading h1 {
              font-size: 29px !important;
              line-height: 1.15 !important;
            }


            .register-page .auth-heading p {
              font-size: 12px !important;
              line-height: 1.55 !important;
            }


            .register-page .mini-label {
              font-size: 9px !important;
              letter-spacing: 1.1px !important;
            }


            .register-page .form-group {
              margin-bottom: 14px !important;
            }


            .register-page .form-group label {
              font-size: 12px !important;
            }


            .register-page .form-group input,
            .register-page .form-group select {
              min-height: 48px !important;
              height: 48px !important;
              padding:
                0 13px !important;
              border-radius:
                12px !important;
              font-size: 13px !important;
            }


            .register-page .primary-button {
              min-height: 51px !important;
              height: 51px !important;
              border-radius:
                13px !important;
              font-size: 13px !important;
            }


            .register-page .auth-link {
              font-size: 12px !important;
              line-height: 1.6 !important;
            }


            .register-page .auth-link button {
              font-size: 12px !important;
            }

          }


          @media (max-width: 390px) {

            .register-page {
              padding:
                15px 10px !important;
            }


            .register-page .register-container {
              width: 100%;
              border-radius:
                18px !important;
            }


            .register-page .auth-logo {
              width: 58px !important;
              height: 58px !important;
              min-width: 58px !important;
              font-size: 27px !important;
              margin-bottom: 14px !important;
            }


            .register-page .auth-heading {
              margin-bottom: 18px !important;
            }


            .register-page .auth-heading h1 {
              font-size: 25px !important;
            }


            .register-page .auth-heading p {
              font-size: 11px !important;
            }


            .register-page .form-group {
              margin-bottom: 12px !important;
            }


            .register-page .form-group label {
              font-size: 11px !important;
            }


            .register-page .form-group input,
            .register-page .form-group select {
              height: 46px !important;
              min-height: 46px !important;
              padding:
                0 11px !important;
              border-radius:
                11px !important;
              font-size: 12px !important;
            }


            .register-page .primary-button {
              height: 49px !important;
              min-height: 49px !important;
              font-size: 12px !important;
            }


            .register-page .auth-link {
              font-size: 11px !important;
            }


            .register-page .auth-link button {
              font-size: 11px !important;
            }

          }


          @media (max-width: 340px) {

            .register-page {
              padding:
                10px 7px !important;
            }


            .register-page .auth-heading h1 {
              font-size: 23px !important;
            }


            .register-page .form-group input,
            .register-page .form-group select {
              font-size: 11px !important;
            }

          }


          @media (max-height: 700px) and (min-width: 391px) {

            .register-page {
              padding-top: 15px !important;
              padding-bottom: 15px !important;
            }


            .register-page .auth-logo {
              margin-bottom: 10px !important;
            }


            .register-page .auth-heading {
              margin-bottom: 13px !important;
            }


            .register-page .form-group {
              margin-bottom: 10px !important;
            }

          }


          @media (orientation: landscape)
            and (max-height: 600px) {

            .register-page {
              align-items: flex-start !important;
              padding-top: 15px !important;
              padding-bottom: 15px !important;
            }


            .register-page .register-container {
              margin-top: 5px !important;
              margin-bottom: 5px !important;
            }


            .register-page .auth-logo {
              width: 50px !important;
              height: 50px !important;
              min-width: 50px !important;
              font-size: 24px !important;
              margin-bottom: 8px !important;
            }


            .register-page .auth-heading {
              margin-bottom: 10px !important;
            }


            .register-page .auth-heading h1 {
              font-size: 22px !important;
            }


            .register-page .auth-heading p {
              display: none !important;
            }


            .register-page .form-group {
              margin-bottom: 8px !important;
            }


            .register-page .form-group input,
            .register-page .form-group select {
              height: 42px !important;
              min-height: 42px !important;
            }


            .register-page .primary-button {
              height: 45px !important;
              min-height: 45px !important;
            }

          }


          @media (prefers-reduced-motion: reduce) {

            .register-page *,
            .register-page *::before,
            .register-page *::after {
              animation-duration:
                0.01ms !important;

              animation-iteration-count:
                1 !important;

              transition-duration:
                0.01ms !important;

              scroll-behavior:
                auto !important;
            }

          }

        `}
      </style>


      {/* ======================================================
          FLOATING FOOD
      ====================================================== */}

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


      {/* ======================================================
          REGISTER CONTAINER
      ====================================================== */}

      <div className="auth-container register-container">

        {/* ====================================================
            LOGO
        ==================================================== */}

        <div className="auth-logo">
          🥬
        </div>


        {/* ====================================================
            HEADING
        ==================================================== */}

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


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (

          <div className="error-box">
            ⚠️ {error}
          </div>

        )}


        {/* ====================================================
            SUCCESS
        ==================================================== */}

        {success && (

          <div className="success-box">
            ✓ {success}
          </div>

        )}


        {/* ====================================================
            REGISTER FORM
        ==================================================== */}

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
              autoComplete="name"
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
              autoComplete="email"
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
              autoComplete="new-password"
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


        {/* ====================================================
            LOGIN LINK
        ==================================================== */}

        <div className="auth-link">

          Already have an account?


          <button
            onClick={onLoginPage}
            disabled={loading}
            type="button"
          >
            Sign In
          </button>

        </div>

      </div>

    </div>
  );
}


export default Register;
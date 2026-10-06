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
        err?.message ||
          "Login failed. Please check your credentials."
      );

    } finally {

      setLoading(false);

    }

  };


  return (

    <div
      className="auth-page login-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >

      {/* ======================================================
          RESPONSIVE LOGIN STYLES
      ====================================================== */}

      <style>
        {`

          .login-page {
            position: relative;
            width: 100%;
            min-height: 100vh;
            box-sizing: border-box;
          }


          .login-page .auth-container {
            box-sizing: border-box;
            width: min(100% - 32px, 500px);
            max-width: 500px;
          }


          .login-page .auth-heading {
            min-width: 0;
          }


          .login-page .auth-heading h1 {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .login-page .auth-heading p {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .login-page .error-box {
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .login-page .auth-form {
            width: 100%;
            min-width: 0;
          }


          .login-page .form-group {
            width: 100%;
            min-width: 0;
          }


          .login-page .form-group input {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }


          .login-page .primary-button {
            width: 100%;
            min-height: 52px;
            box-sizing: border-box;
            touch-action: manipulation;
          }


          .login-page .auth-link {
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: anywhere;
          }


          .login-page .auth-link button {
            touch-action: manipulation;
          }


          /* ==================================================
             TABLET
          ================================================== */

          @media (max-width: 700px) {

            .login-page {
              padding:
                24px 16px !important;
            }


            .login-page .auth-container {
              width: 100%;
              max-width: 490px;
            }

          }


          /* ==================================================
             MOBILE
          ================================================== */

          @media (max-width: 520px) {

            .login-page {
              padding:
                20px 13px !important;
            }


            .login-page .auth-container {
              width: 100%;
              max-width: none;
            }


            .login-page .auth-logo {
              width: 66px !important;
              height: 66px !important;
              min-width: 66px !important;
              font-size: 31px !important;
              margin-bottom: 17px !important;
            }


            .login-page .auth-heading {
              margin-bottom: 21px !important;
            }


            .login-page .auth-heading h1 {
              font-size: 29px !important;
              line-height: 1.15 !important;
            }


            .login-page .auth-heading p {
              font-size: 12px !important;
              line-height: 1.55 !important;
            }


            .login-page .mini-label {
              font-size: 9px !important;
              letter-spacing: 1.1px !important;
            }


            .login-page .form-group {
              margin-bottom: 14px !important;
            }


            .login-page .form-group label {
              font-size: 12px !important;
            }


            .login-page .form-group input {
              min-height: 48px !important;
              height: 48px !important;
              padding:
                0 13px !important;
              border-radius:
                12px !important;
              font-size: 13px !important;
            }


            .login-page .primary-button {
              min-height: 51px !important;
              height: 51px !important;
              border-radius:
                13px !important;
              font-size: 13px !important;
            }


            .login-page .auth-link {
              font-size: 12px !important;
              line-height: 1.6 !important;
            }


            .login-page .auth-link button {
              font-size: 12px !important;
            }

          }


          /* ==================================================
             SMALL MOBILE
          ================================================== */

          @media (max-width: 390px) {

            .login-page {
              padding:
                15px 10px !important;
            }


            .login-page .auth-container {
              width: 100%;
              border-radius:
                18px !important;
            }


            .login-page .auth-logo {
              width: 58px !important;
              height: 58px !important;
              min-width: 58px !important;
              font-size: 27px !important;
              margin-bottom: 14px !important;
            }


            .login-page .auth-heading {
              margin-bottom: 18px !important;
            }


            .login-page .auth-heading h1 {
              font-size: 25px !important;
            }


            .login-page .auth-heading p {
              font-size: 11px !important;
            }


            .login-page .form-group {
              margin-bottom: 12px !important;
            }


            .login-page .form-group label {
              font-size: 11px !important;
            }


            .login-page .form-group input {
              height: 46px !important;
              min-height: 46px !important;
              padding:
                0 11px !important;
              border-radius:
                11px !important;
              font-size: 12px !important;
            }


            .login-page .primary-button {
              height: 49px !important;
              min-height: 49px !important;
              font-size: 12px !important;
            }


            .login-page .auth-link {
              font-size: 11px !important;
            }


            .login-page .auth-link button {
              font-size: 11px !important;
            }

          }


          /* ==================================================
             VERY SMALL DEVICES
          ================================================== */

          @media (max-width: 340px) {

            .login-page {
              padding:
                10px 7px !important;
            }


            .login-page .auth-heading h1 {
              font-size: 23px !important;
            }


            .login-page .form-group input {
              font-size: 11px !important;
            }

          }


          /* ==================================================
             SHORT SCREENS
          ================================================== */

          @media (max-height: 650px)
            and (min-width: 391px) {

            .login-page {
              padding-top: 15px !important;
              padding-bottom: 15px !important;
            }


            .login-page .auth-logo {
              margin-bottom: 10px !important;
            }


            .login-page .auth-heading {
              margin-bottom: 13px !important;
            }


            .login-page .form-group {
              margin-bottom: 10px !important;
            }

          }


          /* ==================================================
             LANDSCAPE MOBILE
          ================================================== */

          @media (orientation: landscape)
            and (max-height: 600px) {

            .login-page {
              align-items: flex-start !important;
              padding-top: 15px !important;
              padding-bottom: 15px !important;
            }


            .login-page .auth-container {
              margin-top: 5px !important;
              margin-bottom: 5px !important;
            }


            .login-page .auth-logo {
              width: 50px !important;
              height: 50px !important;
              min-width: 50px !important;
              font-size: 24px !important;
              margin-bottom: 8px !important;
            }


            .login-page .auth-heading {
              margin-bottom: 10px !important;
            }


            .login-page .auth-heading h1 {
              font-size: 22px !important;
            }


            .login-page .auth-heading p {
              display: none !important;
            }


            .login-page .form-group {
              margin-bottom: 8px !important;
            }


            .login-page .form-group input {
              height: 42px !important;
              min-height: 42px !important;
            }


            .login-page .primary-button {
              height: 45px !important;
              min-height: 45px !important;
            }

          }


          /* ==================================================
             ACCESSIBILITY
          ================================================== */

          @media (prefers-reduced-motion: reduce) {

            .login-page *,
            .login-page *::before,
            .login-page *::after {
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


      {/* ======================================================
          LOGIN CONTAINER
      ====================================================== */}

      <div className="auth-container">

        {/* ====================================================
            LOGO
        ==================================================== */}

        <div className="auth-logo">
          🍏
        </div>


        {/* ====================================================
            HEADING
        ==================================================== */}

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


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (

          <div className="error-box">
            ⚠️ {error}
          </div>

        )}


        {/* ====================================================
            LOGIN FORM
        ==================================================== */}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

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
                setEmail(
                  e.target.value
                )
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
              disabled={loading}
              autoComplete="current-password"
            />

          </div>


          {/* ==================================================
              LOGIN BUTTON
          ================================================== */}

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


        {/* ====================================================
            REGISTER LINK
        ==================================================== */}

        <div className="auth-link">

          Don't have an account?


          <button
            onClick={onRegisterPage}
            disabled={loading}
            type="button"
          >
            Create Account
          </button>

        </div>

      </div>

    </div>

  );
}


export default Login;
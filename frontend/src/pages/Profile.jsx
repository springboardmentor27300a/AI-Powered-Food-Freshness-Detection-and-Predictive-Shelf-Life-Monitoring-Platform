import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentUser,
} from "../api";


// ============================================================
// ROLE CONFIGURATION
// ============================================================

const ROLE_CONFIG = {
  consumer: {
    label: "Consumer",
    icon: "👤",
    description:
      "Manage and monitor your personal food inventory, freshness and shelf-life information.",
    responsibilities: [
      "Manage personal food inventory",
      "Monitor food freshness",
      "Review shelf-life information",
      "Monitor storage conditions",
      "Review food quality reports",
    ],
  },

  retail_manager: {
    label: "Retail Manager",
    icon: "🏪",
    description:
      "Monitor retail food inventory, freshness, shelf-life and waste-reduction information.",
    responsibilities: [
      "Monitor retail inventory",
      "Review freshness and quality",
      "Monitor shelf-life and expiry risk",
      "Track waste-reduction opportunities",
      "Review storage information",
    ],
  },

  warehouse_operator: {
    label: "Warehouse Operator",
    icon: "🏭",
    description:
      "Monitor warehouse inventory, storage conditions, freshness and shelf-life risk.",
    responsibilities: [
      "Monitor warehouse inventory",
      "Review storage conditions",
      "Monitor freshness status",
      "Track shelf-life and expiry risk",
      "Support inventory rotation",
    ],
  },

  food_quality_inspector: {
    label: "Food Quality Inspector",
    icon: "🔬",
    description:
      "Review food quality, freshness classification, spoilage indicators and expiry risk.",
    responsibilities: [
      "Inspect food freshness",
      "Review quality classifications",
      "Monitor spoilage indicators",
      "Review expiry risk",
      "Analyse food quality information",
    ],
  },

  administrator: {
    label: "Administrator",
    icon: "🛡️",
    description:
      "Monitor platform-level inventory, freshness, shelf-life, storage and reporting information.",
    responsibilities: [
      "Monitor platform information",
      "Review inventory quality",
      "Review freshness and shelf-life reports",
      "Monitor storage information",
      "Review platform reporting",
    ],
  },
};


// ============================================================
// ROLE HELPERS
// ============================================================

function normaliseRole(role) {
  return String(role || "consumer")
    .trim()
    .toLowerCase();
}


function getRoleConfig(role) {
  const normalisedRole =
    normaliseRole(role);

  return (
    ROLE_CONFIG[normalisedRole] ||
    ROLE_CONFIG.consumer
  );
}


// ============================================================
// PROFILE PAGE
// ============================================================

function Profile({
  onBack,
  onLogout,
}) {

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // ==========================================================
  // LOAD CURRENT USER
  // ==========================================================

  useEffect(() => {

    let mounted = true;


    const loadProfile =
      async () => {

        try {

          setLoading(true);
          setError("");


          const userData =
            await getCurrentUser();


          if (!mounted) {
            return;
          }


          setUser(userData);

        } catch (err) {

          if (!mounted) {
            return;
          }


          console.error(
            "Profile loading error:",
            err
          );


          setError(
            err?.message ||
              "Failed to load profile."
          );

        } finally {

          if (mounted) {
            setLoading(false);
          }

        }

      };


    loadProfile();


    return () => {
      mounted = false;
    };

  }, []);


  // ==========================================================
  // DERIVED USER INFORMATION
  // ==========================================================

  const roleValue =
    normaliseRole(
      user?.role
    );


  const roleConfig =
    useMemo(
      () =>
        getRoleConfig(
          roleValue
        ),
      [roleValue]
    );


  const displayRole =
    roleConfig.label;


  const displayStatus =
    user?.is_active
      ? "Active"
      : "Inactive";


  const formattedDate =
    user?.created_at
      ? new Date(
          user.created_at
        ).toLocaleString(
          "en-GB",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }
        )
      : "Not available";


  const userInitial =
    user?.name
      ?.charAt(0)
      ?.toUpperCase() ||
    "U";


  return (

    <div
      className="dashboard-page profile-page"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >

      {/* ======================================================
          RESPONSIVE PROFILE STYLES
      ====================================================== */}

      <style>
        {`

          .profile-page {
            width: 100%;
            min-width: 0;
          }


          .profile-header {
            min-width: 0;
          }


          .profile-main-card {
            width: 100%;
            box-sizing: border-box;
          }


          .profile-summary {
            min-width: 0;
          }


          .profile-summary-info {
            min-width: 0;
          }


          .profile-summary-name {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .profile-summary-email {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .profile-role-information {
            min-width: 0;
          }


          .profile-role-content {
            min-width: 0;
          }


          .profile-role-description {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .profile-responsibilities {
            width: 100%;
          }


          .profile-responsibility-item {
            min-width: 0;
          }


          .profile-responsibility-text {
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .profile-information-header {
            min-width: 0;
          }


          .profile-information-title {
            min-width: 0;
          }


          .profile-information-grid {
            width: 100%;
          }


          .profile-access-note {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .profile-back-button {
            min-height: 46px;
            touch-action: manipulation;
          }


          @media (max-width: 900px) {

            .profile-main-card {
              border-radius: 24px !important;
              padding: 30px !important;
            }


            .profile-summary {
              gap: 22px !important;
              padding: 23px !important;
            }


            .profile-summary-name {
              font-size: 26px !important;
            }


            .profile-responsibilities {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
            }

          }


          @media (max-width: 700px) {

            .profile-main-card {
              border-radius: 22px !important;
              padding: 22px !important;
            }


            .profile-summary {
              align-items: flex-start !important;
              flex-direction: column !important;
              gap: 18px !important;
              padding: 21px !important;
            }


            .profile-avatar {
              width: 88px !important;
              height: 88px !important;
            }


            .profile-avatar-inner {
              font-size: 33px !important;
            }


            .profile-active-dot {
              width: 20px !important;
              height: 20px !important;
              bottom: 4px !important;
              right: 0 !important;
            }


            .profile-summary-name {
              font-size: 24px !important;
            }


            .profile-summary-email {
              font-size: 14px !important;
              margin-bottom: 14px !important;
            }


            .profile-role-information {
              padding: 20px !important;
            }


            .profile-role-heading {
              font-size: 19px !important;
            }


            .profile-responsibilities {
              grid-template-columns:
                1fr !important;
            }


            .profile-information-grid {
              grid-template-columns:
                1fr !important;
            }

          }


          @media (max-width: 560px) {

            .profile-header {
              min-height: 70px !important;
            }


            .profile-header .brand {
              min-width: 0 !important;
              max-width: calc(100% - 85px);
            }


            .profile-header .brand-icon {
              width: 42px !important;
              height: 42px !important;
              min-width: 42px !important;
              border-radius: 13px !important;
              font-size: 23px !important;
            }


            .profile-header .brand strong {
              font-size: 16px !important;
            }


            .profile-header .brand span {
              font-size: 9px !important;
            }


            .profile-header .topbar-right {
              flex-shrink: 0 !important;
            }


            .profile-header .logout-button {
              padding:
                9px 12px !important;
              border-radius:
                11px !important;
              font-size:
                11px !important;
            }


            .profile-main-content {
              padding-top: 18px !important;
            }


            .profile-main-card {
              border-radius: 19px !important;
              padding: 16px !important;
            }


            .profile-back-button {
              width: 100%;
              justify-content: center;
              margin-bottom: 15px !important;
            }


            .profile-section-title {
              margin-bottom: 22px !important;
            }


            .profile-section-title h1 {
              font-size: 27px !important;
              line-height: 1.12 !important;
            }


            .profile-section-title p {
              font-size: 12px !important;
              line-height: 1.55 !important;
            }


            .profile-summary {
              border-radius: 19px !important;
              padding: 18px !important;
              margin-bottom: 20px !important;
            }


            .profile-summary-name {
              font-size: 22px !important;
              line-height: 1.2 !important;
            }


            .profile-summary-email {
              font-size: 13px !important;
              line-height: 1.5 !important;
            }


            .profile-badge-row {
              gap: 8px !important;
            }


            .profile-role-badge,
            .profile-status-badge {
              max-width: 100%;
              padding:
                8px 11px !important;
              font-size: 11px !important;
            }


            .profile-role-information {
              margin-bottom: 22px !important;
              padding: 17px !important;
              border-radius: 18px !important;
            }


            .profile-role-header {
              align-items: flex-start !important;
              gap: 11px !important;
            }


            .profile-role-icon {
              width: 43px !important;
              height: 43px !important;
              min-width: 43px !important;
              border-radius: 13px !important;
              font-size: 20px !important;
            }


            .profile-role-label {
              font-size: 9px !important;
            }


            .profile-role-heading {
              font-size: 17px !important;
              line-height: 1.25 !important;
            }


            .profile-role-description {
              font-size: 11px !important;
              line-height: 1.55 !important;
            }


            .profile-responsibilities {
              margin-top: 17px !important;
              gap: 8px !important;
            }


            .profile-responsibility-item {
              padding: 10px 11px !important;
              border-radius: 11px !important;
              font-size: 10.5px !important;
            }


            .profile-information-header {
              gap: 9px !important;
              margin-bottom: 12px !important;
            }


            .profile-information-header-icon {
              width: 38px !important;
              height: 38px !important;
              min-width: 38px !important;
              border-radius: 11px !important;
              font-size: 18px !important;
            }


            .profile-information-title h3 {
              font-size: 16px !important;
            }


            .profile-information-title p {
              font-size: 10px !important;
            }


            .profile-access-note {
              margin-top: 16px !important;
              padding: 13px 14px !important;
              border-radius: 13px !important;
              font-size: 10.5px !important;
              line-height: 1.55 !important;
            }


            .profile-final-back {
              height: 52px !important;
              margin-top: 22px !important;
              border-radius: 14px !important;
              font-size: 13px !important;
            }

          }


          @media (max-width: 390px) {

            .profile-header {
              padding-left: 12px !important;
              padding-right: 12px !important;
            }


            .profile-header .brand {
              gap: 8px !important;
              max-width: calc(100% - 78px);
            }


            .profile-header .brand-icon {
              width: 38px !important;
              height: 38px !important;
              min-width: 38px !important;
              font-size: 21px !important;
              border-radius: 11px !important;
            }


            .profile-header .brand strong {
              font-size: 14px !important;
            }


            .profile-header .brand span {
              font-size: 8px !important;
            }


            .profile-header .logout-button {
              padding:
                8px 10px !important;
              font-size:
                10px !important;
            }


            .profile-main-card {
              padding: 12px !important;
              border-radius: 17px !important;
            }


            .profile-section-title h1 {
              font-size: 24px !important;
            }


            .profile-section-title p {
              font-size: 11px !important;
            }


            .profile-summary {
              padding: 15px !important;
              border-radius: 16px !important;
            }


            .profile-avatar {
              width: 78px !important;
              height: 78px !important;
            }


            .profile-avatar-inner {
              font-size: 29px !important;
            }


            .profile-summary-name {
              font-size: 20px !important;
            }


            .profile-summary-email {
              font-size: 12px !important;
            }


            .profile-role-badge,
            .profile-status-badge {
              padding:
                7px 9px !important;
              font-size:
                10px !important;
            }


            .profile-role-information {
              padding: 14px !important;
              border-radius: 16px !important;
            }


            .profile-responsibility-item {
              font-size: 10px !important;
            }

          }


          @media (prefers-reduced-motion: reduce) {

            .profile-page *,
            .profile-page *::before,
            .profile-page *::after {
              scroll-behavior: auto !important;
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }

          }

        `}
      </style>


      {/* ======================================================
          AMBIENT BACKGROUND
      ====================================================== */}

      <div
        className="ambient ambient-one"
      />

      <div
        className="ambient ambient-two"
      />


      <div
        className="floating-food dashboard-food-one"
      >
        🍎
      </div>


      <div
        className="floating-food dashboard-food-two"
      >
        🥕
      </div>


      <div
        className="floating-food dashboard-food-three"
      >
        🥦
      </div>


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header
        className="topbar profile-header"
        style={{
          position: "relative",
          zIndex: 10,
        }}
      >

        <div className="brand">

          <div
            className="brand-icon"
            style={{
              boxShadow:
                "0 8px 25px rgba(20, 180, 90, 0.20)",
            }}
          >
            🍏
          </div>


          <div
            style={{
              minWidth: 0,
            }}
          >

            <strong>
              FreshGuard
            </strong>

            <span>
              My Profile
            </span>

          </div>

        </div>


        <div className="topbar-right">

          <button
            className="logout-button"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>

        </div>

      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main
        className="dashboard-content profile-main-content"
      >

        {/* ====================================================
            BACK BUTTON
        ==================================================== */}

        <button
          className="back-button profile-back-button"
          onClick={onBack}
          type="button"
          style={{
            marginBottom: "22px",
            position: "relative",
            zIndex: 2,
          }}
        >
          ← Back to Dashboard
        </button>


        {/* ====================================================
            PREMIUM PROFILE CARD
        ==================================================== */}

        <section
          className="content-card profile-main-card"
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "30px",
            padding: "42px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(244,255,248,0.94))",
            border:
              "1px solid rgba(30, 160, 90, 0.15)",
            boxShadow:
              "0 25px 70px rgba(20, 100, 60, 0.12)",
            backdropFilter:
              "blur(20px)",
            WebkitBackdropFilter:
              "blur(20px)",
          }}
        >

          {/* ==================================================
              DECORATIVE GLOW
          ================================================== */}

          <div
            style={{
              position: "absolute",
              width: "300px",
              height: "300px",
              right: "-130px",
              top: "-130px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(70,210,120,0.18), transparent 70%)",
              pointerEvents: "none",
            }}
          />


          <div
            style={{
              position: "absolute",
              width: "260px",
              height: "260px",
              left: "-150px",
              bottom: "-150px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(120,230,180,0.16), transparent 70%)",
              pointerEvents: "none",
            }}
          />


          {/* ==================================================
              TOP TITLE
          ================================================== */}

          <div
            className="section-title profile-section-title"
            style={{
              position: "relative",
              zIndex: 2,
              marginBottom: "32px",
            }}
          >

            <span
              className="mini-label"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 15px",
                borderRadius: "999px",
                background:
                  "rgba(30, 180, 90, 0.08)",
                border:
                  "1px solid rgba(30, 180, 90, 0.14)",
              }}
            >
              ACCOUNT
            </span>


            <h1>
              My Profile
            </h1>


            <p>
              View your FreshGuard account
              information, role and access
              responsibilities.
            </p>

          </div>


          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (

            <div
              className="error-box"
              style={{
                position: "relative",
                zIndex: 3,
                marginBottom: "25px",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              ⚠️ {error}
            </div>

          )}


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading && (

            <div
              style={{
                position: "relative",
                zIndex: 2,
                padding: "45px 25px",
                textAlign: "center",
                borderRadius: "22px",
                background:
                  "rgba(255,255,255,0.72)",
                border:
                  "1px solid rgba(30,160,90,0.10)",
              }}
            >

              <div
                style={{
                  fontSize: "42px",
                  marginBottom: "12px",
                }}
              >
                🍏
              </div>


              <strong
                style={{
                  fontSize: "20px",
                  color: "#063b25",
                }}
              >
                Loading Profile...
              </strong>


              <p
                style={{
                  marginTop: "8px",
                  color: "#70857b",
                }}
              >
                Please wait while we load
                your account information.
              </p>

            </div>

          )}


          {/* ==================================================
              PROFILE DATA
          ================================================== */}

          {!loading && user && (

            <div
              style={{
                position: "relative",
                zIndex: 2,
              }}
            >

              {/* =================================================
                  PROFILE SUMMARY
              ================================================= */}

              <div
                className="profile-summary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "28px",
                  padding: "28px",
                  marginBottom: "28px",
                  borderRadius: "25px",
                  background:
                    "linear-gradient(135deg, rgba(235,255,243,0.95), rgba(250,255,252,0.90))",
                  border:
                    "1px solid rgba(40,180,100,0.16)",
                  boxShadow:
                    "0 15px 40px rgba(30,130,75,0.08)",
                }}
              >

                {/* AVATAR */}

                <div
                  className="profile-avatar"
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    width: "105px",
                    height: "105px",
                    borderRadius: "50%",
                    padding: "5px",
                    background:
                      "linear-gradient(135deg, #28c76f, #0b8f4d)",
                    boxShadow:
                      "0 12px 30px rgba(20,170,85,0.25)",
                  }}
                >

                  <div
                    className="profile-avatar-inner"
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "linear-gradient(145deg, #f1fff6, #dff8e9)",
                      color: "#087b43",
                      fontSize: "40px",
                      fontWeight: "800",
                    }}
                  >
                    {userInitial}
                  </div>


                  {/* ACTIVE DOT */}

                  <span
                    className="profile-active-dot"
                    style={{
                      position: "absolute",
                      right: "2px",
                      bottom: "7px",
                      width: "23px",
                      height: "23px",
                      borderRadius: "50%",
                      background:
                        user.is_active
                          ? "#19b75b"
                          : "#999",
                      border:
                        "4px solid white",
                      boxShadow:
                        "0 4px 10px rgba(0,0,0,0.12)",
                    }}
                  />

                </div>


                {/* USER BASIC INFO */}

                <div
                  className="profile-summary-info"
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >

                  <h2
                    className="profile-summary-name"
                    style={{
                      margin: "0 0 6px",
                      fontSize: "30px",
                      color: "#063b25",
                      fontWeight: "800",
                    }}
                  >
                    {user.name ||
                      "FreshGuard User"}
                  </h2>


                  <p
                    className="profile-summary-email"
                    style={{
                      margin: "0 0 18px",
                      fontSize: "16px",
                      color: "#6c8077",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {user.email ||
                      "Email not available"}
                  </p>


                  {/* ROLE + STATUS */}

                  <div
                    className="profile-badge-row"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >

                    {/* ROLE BADGE */}

                    <div
                      className="profile-role-badge"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding:
                          "9px 15px",
                        borderRadius: "12px",
                        background:
                          "rgba(255,255,255,0.85)",
                        border:
                          "1px solid rgba(30,160,90,0.15)",
                        color: "#12623d",
                        fontWeight: "700",
                        maxWidth: "100%",
                        overflowWrap: "anywhere",
                      }}
                    >

                      <span>
                        {roleConfig.icon}
                      </span>

                      <span>
                        {displayRole}
                      </span>

                    </div>


                    {/* STATUS BADGE */}

                    <div
                      className="profile-status-badge"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding:
                          "9px 15px",
                        borderRadius: "12px",
                        background:
                          user.is_active
                            ? "rgba(25,183,91,0.10)"
                            : "rgba(150,150,150,0.10)",
                        border:
                          user.is_active
                            ? "1px solid rgba(25,183,91,0.20)"
                            : "1px solid rgba(150,150,150,0.20)",
                        color:
                          user.is_active
                            ? "#099447"
                            : "#777",
                        fontWeight: "700",
                      }}
                    >

                      <span>
                        ●
                      </span>

                      <span>
                        {displayStatus}
                      </span>

                    </div>

                  </div>

                </div>

              </div>


              {/* =================================================
                  ROLE INFORMATION
              ================================================= */}

              <div
                className="profile-role-information"
                style={{
                  marginBottom: "30px",
                  padding: "24px",
                  borderRadius: "22px",
                  background:
                    "linear-gradient(135deg, #f1fff6, #fbfffc)",
                  border:
                    "1px solid rgba(30,160,90,0.13)",
                  boxShadow:
                    "0 10px 28px rgba(20,100,60,0.05)",
                }}
              >

                <div
                  className="profile-role-header"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "15px",
                  }}
                >

                  <div
                    className="profile-role-icon"
                    style={{
                      width: "50px",
                      height: "50px",
                      flexShrink: 0,
                      borderRadius: "15px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "rgba(30,180,90,0.10)",
                      fontSize: "23px",
                    }}
                  >
                    {roleConfig.icon}
                  </div>


                  <div
                    className="profile-role-content"
                    style={{
                      flex: 1,
                    }}
                  >

                    <div
                      className="profile-role-label"
                      style={{
                        color: "#08a94f",
                        fontSize: "11px",
                        fontWeight: "900",
                        letterSpacing: "1.3px",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      Your FreshGuard Role
                    </div>


                    <h3
                      className="profile-role-heading"
                      style={{
                        margin:
                          "6px 0 5px",
                        color: "#073d27",
                        fontSize: "21px",
                        fontWeight: "850",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {displayRole}
                    </h3>


                    <p
                      className="profile-role-description"
                      style={{
                        margin: 0,
                        color: "#71827b",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      {roleConfig.description}
                    </p>

                  </div>

                </div>


                {/* ROLE RESPONSIBILITIES */}

                <div
                  className="profile-responsibilities"
                  style={{
                    marginTop: "22px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(210px,1fr))",
                    gap: "10px",
                  }}
                >

                  {roleConfig.responsibilities.map(
                    (item) => (

                      <div
                        key={item}
                        className="profile-responsibility-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "9px",
                          padding:
                            "11px 13px",
                          borderRadius: "12px",
                          background:
                            "rgba(255,255,255,0.80)",
                          border:
                            "1px solid rgba(30,160,90,0.10)",
                          color: "#45665a",
                          fontSize: "12px",
                          fontWeight: "650",
                        }}
                      >

                        <span
                          style={{
                            color: "#08a94f",
                            fontWeight: "900",
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>


                        <span
                          className="profile-responsibility-text"
                        >
                          {item}
                        </span>

                      </div>

                    )
                  )}

                </div>

              </div>


              {/* =================================================
                  INFORMATION HEADER
              ================================================= */}

              <div
                className="profile-information-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >

                <div
                  className="profile-information-header-icon"
                  style={{
                    width: "42px",
                    height: "42px",
                    flexShrink: 0,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      "rgba(25,183,91,0.10)",
                    fontSize: "20px",
                  }}
                >
                  📋
                </div>


                <div
                  className="profile-information-title"
                >

                  <h3
                    style={{
                      margin: 0,
                      color: "#073d27",
                      fontSize: "19px",
                    }}
                  >
                    Account Information
                  </h3>


                  <p
                    style={{
                      margin:
                        "3px 0 0",
                      color: "#82928b",
                      fontSize: "13px",
                    }}
                  >
                    Your registered account details
                  </p>

                </div>

              </div>


              {/* =================================================
                  INFORMATION GRID
              ================================================= */}

              <div
                className="profile-information-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                }}
              >

                {/* FULL NAME */}

                <ProfileInfoCard
                  icon="👤"
                  label="Full Name"
                  value={
                    user.name
                  }
                />


                {/* EMAIL */}

                <ProfileInfoCard
                  icon="✉️"
                  label="Email Address"
                  value={
                    user.email
                  }
                />


                {/* ROLE */}

                <ProfileInfoCard
                  icon={
                    roleConfig.icon
                  }
                  label="Role"
                  value={
                    displayRole
                  }
                  badge
                />


                {/* STATUS */}

                <ProfileInfoCard
                  icon="✓"
                  label="Account Status"
                  value={
                    displayStatus
                  }
                  status={
                    user.is_active
                  }
                />


                {/* USER ID */}

                <ProfileInfoCard
                  icon="🆔"
                  label="User ID"
                  value={
                    user.id
                  }
                />


                {/* CREATED */}

                <ProfileInfoCard
                  icon="📅"
                  label="Account Created"
                  value={
                    formattedDate
                  }
                />

              </div>


              {/* =================================================
                  ACCOUNT ACCESS NOTE
              ================================================= */}

              <div
                className="profile-access-note"
                style={{
                  marginTop: "22px",
                  padding: "16px 18px",
                  borderRadius: "16px",
                  background:
                    "#fffdf1",
                  border:
                    "1px solid #f1e6bd",
                  color: "#75622c",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >

                🔐{" "}

                <strong>
                  Role-based access:
                </strong>{" "}

                Your FreshGuard dashboard
                and available features are
                determined by the role assigned
                to this account.

              </div>


              {/* =================================================
                  BACK BUTTON
              ================================================= */}

              <button
                className="primary-button profile-final-back"
                onClick={onBack}
                type="button"
                style={{
                  width: "100%",
                  marginTop: "30px",
                  height: "58px",
                  borderRadius: "16px",
                  fontSize: "16px",
                  fontWeight: "800",
                  boxShadow:
                    "0 12px 30px rgba(20,170,80,0.22)",
                }}
              >
                ← Back to Dashboard
              </button>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}


// ============================================================
// PROFILE INFORMATION CARD
// ============================================================

function ProfileInfoCard({
  icon,
  label,
  value,
  badge = false,
  status = null,
}) {

  return (

    <div
      className="profile-info-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "15px",
        minHeight: "82px",
        padding: "14px 17px",
        borderRadius: "17px",
        background:
          "rgba(255,255,255,0.78)",
        border:
          "1px solid rgba(30,160,90,0.11)",
        boxShadow:
          "0 7px 22px rgba(20,100,60,0.05)",
        transition:
          "transform 0.2s ease, box-shadow 0.2s ease",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >

      {/* ICON */}

      <div
        className="profile-info-icon"
        style={{
          flexShrink: 0,
          width: "48px",
          height: "48px",
          borderRadius: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #effcf4, #dcf6e7)",
          border:
            "1px solid rgba(30,170,90,0.10)",
          color: "#078546",
          fontSize: "21px",
          fontWeight: "800",
        }}
      >
        {icon}
      </div>


      {/* TEXT */}

      <div
        className="profile-info-text"
        style={{
          minWidth: 0,
          flex: 1,
        }}
      >

        <div
          style={{
            color: "#7b8c84",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "5px",
          }}
        >
          {label}
        </div>


        {/* VALUE */}

        {badge ? (

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              maxWidth: "100%",
              boxSizing: "border-box",
              padding:
                "6px 12px",
              borderRadius: "9px",
              background:
                "rgba(30,180,90,0.09)",
              color: "#087a43",
              border:
                "1px solid rgba(30,180,90,0.15)",
              fontSize: "14px",
              fontWeight: "800",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {value}
          </span>

        ) : status !== null ? (

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              maxWidth: "100%",
              boxSizing: "border-box",
              padding:
                "6px 12px",
              borderRadius: "9px",
              background:
                status
                  ? "rgba(25,183,91,0.10)"
                  : "rgba(150,150,150,0.10)",
              color:
                status
                  ? "#099447"
                  : "#777",
              border:
                status
                  ? "1px solid rgba(25,183,91,0.16)"
                  : "1px solid rgba(150,150,150,0.15)",
              fontSize: "14px",
              fontWeight: "800",
            }}
          >

            <span>
              ●
            </span>

            {value}

          </span>

        ) : (

          <div
            style={{
              color: "#163d2d",
              fontSize: "15px",
              fontWeight: "700",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {value || "—"}
          </div>

        )}

      </div>

    </div>
  );
}


export default Profile;
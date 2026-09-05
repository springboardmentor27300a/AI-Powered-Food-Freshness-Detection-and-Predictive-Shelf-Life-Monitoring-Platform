import { useEffect, useState } from "react";

import {
  getCurrentUser,
  getFoods,
} from "../api";


function Dashboard({
  onLogout,
  onAddFood,
  onInventory,
  onProfile,
}) {

  const [user, setUser] =
    useState(null);

  const [foods, setFoods] =
    useState([]);


  // ==========================================================
  // LOAD USER + FOOD DATA
  // ==========================================================

  useEffect(() => {

    const loadData = async () => {

      try {

        const [
          userData,
          foodData,
        ] = await Promise.all([

          getCurrentUser(),

          getFoods(),

        ]);


        setUser(userData);

        setFoods(foodData);

      } catch (error) {

        console.error(error);

      }

    };


    loadData();

  }, []);


  // ==========================================================
  // FOOD COUNTS
  // ==========================================================

  const freshCount =
    foods.filter(
      (food) =>
        food.freshness_status
          ?.toLowerCase() === "fresh"
    ).length;


  const pendingCount =
    foods.filter(
      (food) =>
        food.freshness_status
          ?.toLowerCase() === "pending"
    ).length;


  // ==========================================================
  // USER INITIAL
  // ==========================================================

  const userInitial =
    user?.name
      ?.charAt(0)
      ?.toUpperCase() || "U";


  // ==========================================================
  // ROLE DISPLAY
  // ==========================================================

  const userRole =
    user?.role || "consumer";


  return (

    <div className="dashboard-page">

      <div className="ambient ambient-one" />

      <div className="ambient ambient-two" />


      <div className="floating-food dashboard-food-one">
        🍎
      </div>


      <div className="floating-food dashboard-food-two">
        🥕
      </div>


      <div className="floating-food dashboard-food-three">
        🥦
      </div>


      {/* ====================================================
          PREMIUM TOPBAR
      ===================================================== */}

      <header
        className="topbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,

          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          minHeight: "82px",

          padding:
            "14px clamp(20px, 5vw, 72px)",

          background:
            "rgba(255, 255, 255, 0.88)",

          backdropFilter:
            "blur(18px)",

          WebkitBackdropFilter:
            "blur(18px)",

          borderBottom:
            "1px solid rgba(16, 185, 129, 0.12)",

          boxShadow:
            "0 8px 30px rgba(16, 72, 45, 0.06)",

          transition:
            "all 0.3s ease",
        }}
      >

        {/* ==================================================
            BRAND
        ================================================== */}

        <div
          className="brand"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",

            cursor: "default",
          }}
        >

          {/* LOGO */}

          <div
            className="brand-icon"
            style={{
              width: "50px",
              height: "50px",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              borderRadius: "16px",

              background:
                "linear-gradient(145deg, #dcfce7, #bbf7d0)",

              boxShadow:
                "0 8px 22px rgba(22, 163, 74, 0.16)",

              fontSize: "27px",

              border:
                "1px solid rgba(34, 197, 94, 0.14)",
            }}
          >
            🍏
          </div>


          {/* BRAND TEXT */}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >

            <strong
              style={{
                fontSize: "19px",
                fontWeight: 800,

                color: "#063b25",

                letterSpacing: "-0.3px",

                lineHeight: 1.1,
              }}
            >
              FreshGuard
            </strong>


            <span
              style={{
                fontSize: "11px",

                color: "#71857b",

                fontWeight: 500,

                letterSpacing: "0.2px",
              }}
            >
              Food Freshness Platform
            </span>

          </div>

        </div>


        {/* ==================================================
            RIGHT SIDE
        ================================================== */}

        <div
          className="topbar-right"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >

          {/* =================================================
              USER PROFILE PILL
          ================================================= */}

          {user && (

            <div
              className="user-pill"
              style={{
                display: "flex",
                alignItems: "center",

                gap: "10px",

                padding:
                  "7px 13px 7px 7px",

                borderRadius: "15px",

                background:
                  "rgba(240, 253, 244, 0.85)",

                border:
                  "1px solid rgba(34, 197, 94, 0.13)",

                boxShadow:
                  "0 5px 18px rgba(22, 101, 52, 0.06)",

                minWidth: "145px",
              }}
            >

              {/* AVATAR */}

              <div
                className="user-avatar"
                style={{
                  width: "38px",
                  height: "38px",

                  flexShrink: 0,

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  borderRadius: "12px",

                  background:
                    "linear-gradient(145deg, #dcfce7, #bbf7d0)",

                  color: "#087443",

                  fontSize: "16px",

                  fontWeight: 800,

                  border:
                    "1px solid rgba(34, 197, 94, 0.14)",
                }}
              >
                {userInitial}
              </div>


              {/* USER INFO */}

              <div
                className="user-info"
                style={{
                  display: "flex",
                  flexDirection: "column",

                  minWidth: 0,

                  lineHeight: 1.15,
                }}
              >

                <strong
                  style={{
                    color: "#073b27",

                    fontSize: "13px",

                    fontWeight: 750,

                    whiteSpace: "nowrap",

                    overflow: "hidden",

                    textOverflow: "ellipsis",

                    maxWidth: "105px",
                  }}
                >
                  {user.name}
                </strong>


                <span
                  style={{
                    marginTop: "4px",

                    color: "#779087",

                    fontSize: "10px",

                    fontWeight: 600,

                    textTransform: "capitalize",
                  }}
                >
                  {userRole}
                </span>

              </div>

            </div>

          )}


          {/* =================================================
              PROFILE BUTTON
          ================================================= */}

          <button
            onClick={onProfile}
            type="button"

            style={{
              border: "1px solid #d8eadf",

              background:
                "rgba(255, 255, 255, 0.95)",

              color: "#086337",

              padding:
                "11px 19px",

              borderRadius: "13px",

              fontSize: "13px",

              fontWeight: 750,

              cursor: "pointer",

              boxShadow:
                "0 5px 15px rgba(22, 101, 52, 0.04)",

              transition:
                "all 0.25s ease",
            }}

            onMouseEnter={(e) => {

              e.currentTarget.style.background =
                "#f0fdf4";

              e.currentTarget.style.borderColor =
                "#a7d9ba";

              e.currentTarget.style.transform =
                "translateY(-1px)";

              e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(22, 101, 52, 0.09)";
            }}

            onMouseLeave={(e) => {

              e.currentTarget.style.background =
                "rgba(255, 255, 255, 0.95)";

              e.currentTarget.style.borderColor =
                "#d8eadf";

              e.currentTarget.style.transform =
                "translateY(0)";

              e.currentTarget.style.boxShadow =
                "0 5px 15px rgba(22, 101, 52, 0.04)";
            }}
          >
            Profile
          </button>


          {/* =================================================
              LOGOUT
          ================================================= */}

          <button
            onClick={onLogout}
            type="button"

            style={{
              border:
                "1px solid rgba(239, 68, 68, 0.12)",

              background:
                "#fff7f7",

              color:
                "#d43d3d",

              padding:
                "11px 17px",

              borderRadius:
                "13px",

              fontSize:
                "13px",

              fontWeight:
                750,

              cursor:
                "pointer",

              transition:
                "all 0.25s ease",
            }}

            onMouseEnter={(e) => {

              e.currentTarget.style.background =
                "#feecec";

              e.currentTarget.style.borderColor =
                "rgba(239, 68, 68, 0.22)";

              e.currentTarget.style.transform =
                "translateY(-1px)";
            }}

            onMouseLeave={(e) => {

              e.currentTarget.style.background =
                "#fff7f7";

              e.currentTarget.style.borderColor =
                "rgba(239, 68, 68, 0.12)";

              e.currentTarget.style.transform =
                "translateY(0)";
            }}
          >
            Logout
          </button>

        </div>

      </header>


      {/* ====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="dashboard-content">


        {/* ==================================================
            HERO
        ================================================== */}

        <section className="dashboard-hero">

          <div className="hero-copy">

            <span className="mini-label">
              SMART FOOD MONITORING
            </span>


            <h1>

              Keep your

              <br />

              <span>
                fresh & healthy.
              </span>

            </h1>


            <p className="dashboard-subtitle">

              Track your food inventory,
              monitor freshness status,
              and make smarter
              decisions before food goes
              to waste.

            </p>


            <div className="hero-actions">

              <button
                className="primary-button hero-button"
                onClick={onAddFood}
                type="button"
              >
                + Add Food
              </button>


              <button
                className="secondary-button"
                onClick={onInventory}
                type="button"
              >
                View Inventory →
              </button>

            </div>

          </div>


          {/* ==================================================
              HERO VISUAL
          ================================================== */}

          <div className="hero-visual">

            <div className="fruit-orbit orbit-one">
              🍎
            </div>


            <div className="fruit-orbit orbit-two">
              🥕
            </div>


            <div className="fruit-orbit orbit-three">
              🥦
            </div>


            <div className="hero-fruit">
              🥑
            </div>


            <div className="fresh-ring">

              <span>
                FRESH
              </span>

            </div>

          </div>

        </section>


        {/* ==================================================
            STATISTICS
        ================================================== */}

        <section className="stats-grid">


          {/* TOTAL FOOD */}

          <div className="stat-card">

            <div className="stat-icon green">
              🧺
            </div>


            <div>

              <p>
                Total Food Items
              </p>

              <strong>
                {foods.length}
              </strong>

            </div>


            <span className="stat-decoration">
              🍎
            </span>

          </div>


          {/* FRESH */}

          <div className="stat-card">

            <div className="stat-icon mint">
              🌱
            </div>


            <div>

              <p>
                Fresh Items
              </p>

              <strong>
                {freshCount}
              </strong>

            </div>


            <span className="stat-decoration">
              🥬
            </span>

          </div>


          {/* PENDING */}

          <div className="stat-card">

            <div className="stat-icon yellow">
              ⏳
            </div>


            <div>

              <p>
                Pending Analysis
              </p>

              <strong>
                {pendingCount}
              </strong>

            </div>


            <span className="stat-decoration">
              🍋
            </span>

          </div>

        </section>


        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="action-section">


          <div className="section-heading">

            <div>

              <span className="mini-label">
                QUICK ACTIONS
              </span>


              <h2>
                Manage your food
              </h2>

            </div>


            <span className="section-emoji">
              🥗
            </span>

          </div>


          <div className="action-grid">


            {/* ADD FOOD */}

            <button
              className="action-card add-card"
              onClick={onAddFood}
              type="button"
            >

              <div className="action-illustration">
                🍎🥕
              </div>


              <div>

                <span className="action-label">
                  INVENTORY
                </span>


                <h3>
                  Add Food Item
                </h3>


                <p>
                  Register fruits,
                  vegetables, dairy and
                  other food products.
                </p>

              </div>


              <span className="action-arrow">
                →
              </span>

            </button>


            {/* INVENTORY */}

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                🥦🍅
              </div>


              <div>

                <span className="action-label">
                  MONITOR
                </span>


                <h3>
                  Food Inventory
                </h3>


                <p>
                  View your saved food
                  items and freshness
                  information.
                </p>

              </div>


              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>


        {/* ==================================================
            FRESHNESS BANNER
        ================================================== */}

        <section className="fresh-banner">


          <div className="banner-food">
            🍓 🥑 🍊
          </div>


          <div>

            <span className="mini-label">
              FRESHNESS MATTERS
            </span>


            <h2>
              Less waste. Better food.
            </h2>


            <p>
              Smart monitoring helps you
              understand what is fresh
              and what needs attention.
            </p>

          </div>


          <div className="banner-badge">

            <span>
              🌿
            </span>

            Smart

            <br />

            Monitoring

          </div>

        </section>

      </main>

    </div>

  );
}


export default Dashboard;
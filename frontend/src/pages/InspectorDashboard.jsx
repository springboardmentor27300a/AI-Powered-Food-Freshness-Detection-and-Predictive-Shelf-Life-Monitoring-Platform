import { useEffect, useState } from "react";
import { getFoods } from "../api";


function InspectorDashboard({
  onLogout,
  onProfile,
  onInventory,
  onReports,
}) {

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);


  /* ==========================================================
      LOAD INVENTORY DATA
  ========================================================== */

  useEffect(() => {

    async function loadFoods() {

      try {

        setLoading(true);

        const data = await getFoods();

        setFoods(Array.isArray(data) ? data : []);

      } catch (error) {

        console.error("Failed to load inspector inventory:", error);

        setFoods([]);

      } finally {

        setLoading(false);

      }

    }

    loadFoods();

  }, []);


  /* ==========================================================
      INSPECTION STATISTICS
  ========================================================== */

  const totalFoods = foods.length;


  const spoilageCount = foods.filter((food) => {

    const status =
      String(food.freshness_status || "")
        .trim()
        .toLowerCase();

    const expiryDate = food.expiry_date
      ? new Date(`${food.expiry_date}T00:00:00`)
      : null;

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const isExpired =
      expiryDate &&
      !Number.isNaN(expiryDate.getTime()) &&
      expiryDate < today;

    return (
      status === "spoiled" ||
      status === "rotten" ||
      isExpired
    );

  }).length;


  const qualityReportsCount = foods.length;


  return (

    <div className="dashboard-page">

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />


      {/* ==========================================================
          TOPBAR
      ========================================================== */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🔬
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Food Quality Inspector
            </span>

          </div>

        </div>


        <div className="topbar-right">

          {/* REPORTS */}

          <button
            className="secondary-button"
            onClick={onReports}
            type="button"
          >
            📊 Reports
          </button>


          {/* PROFILE */}

          <button
            className="secondary-button"
            onClick={onProfile}
            type="button"
          >
            Profile
          </button>


          {/* LOGOUT */}

          <button
            className="logout-button"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>

        </div>

      </header>


      {/* ==========================================================
          MAIN CONTENT
      ========================================================== */}

      <main className="dashboard-content">


        {/* ========================================================
            HERO
        ======================================================== */}

        <section className="dashboard-hero">

          <div className="hero-copy">

            <span className="mini-label">
              QUALITY INSPECTION
            </span>

            <h1>
              Inspect food
              <br />
              <span>
                freshness intelligently.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Review freshness assessments,
              quality scores, spoilage indicators,
              and food freshness reports.
            </p>


            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={onInventory}
                type="button"
              >
                Inspect Inventory →
              </button>


              <button
                className="secondary-button"
                onClick={onReports}
                type="button"
              >
                View Reports
              </button>

            </div>

          </div>


          {/* HERO VISUAL */}

          <div className="hero-visual">

            <div className="hero-fruit">
              🔬
            </div>

            <div className="fresh-ring">

              <span>
                QUALITY
              </span>

            </div>

          </div>

        </section>



        {/* ========================================================
            INSPECTION STATS
        ======================================================== */}

        <section className="stats-grid">


          {/* FRESHNESS ANALYSIS */}

          <div
            className="stat-card"
            onClick={onInventory}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                onInventory();
              }

            }}
          >

            <div className="stat-icon green">
              🔍
            </div>

            <div>

              <p>
                Freshness Analysis
              </p>

              <strong>
                {loading ? "..." : totalFoods}
              </strong>

            </div>

          </div>


          {/* SPOILAGE */}

          <div
            className="stat-card"
            onClick={onInventory}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                onInventory();
              }

            }}
          >

            <div className="stat-icon yellow">
              ⚠️
            </div>

            <div>

              <p>
                Spoilage Indicators
              </p>

              <strong>
                {loading ? "..." : spoilageCount}
              </strong>

            </div>

          </div>


          {/* QUALITY REPORTS */}

          <div
            className="stat-card"
            onClick={onReports}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                onReports();
              }

            }}
          >

            <div className="stat-icon mint">
              📊
            </div>

            <div>

              <p>
                Quality Reports
              </p>

              <strong>
                {loading ? "..." : qualityReportsCount}
              </strong>

            </div>

          </div>

        </section>



        {/* ========================================================
            INSPECTION TOOLS
        ======================================================== */}

        <section className="action-section">

          <div className="section-heading">

            <div>

              <span className="mini-label">
                INSPECTION TOOLS
              </span>

              <h2>
                Food quality
              </h2>

            </div>

            <span className="section-emoji">
              🔬
            </span>

          </div>


          <div className="action-grid">


            {/* ====================================================
                FRESHNESS REPORTS
            ==================================================== */}

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                🍎🔬
              </div>

              <div>

                <span className="action-label">
                  INSPECTION
                </span>

                <h3>
                  Freshness Reports
                </h3>

                <p>
                  Review food freshness and
                  quality information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                SPOILAGE DETECTION
            ==================================================== */}

            <button
              className="action-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                🦠⚠️
              </div>

              <div>

                <span className="action-label">
                  QUALITY
                </span>

                <h3>
                  Spoilage Detection
                </h3>

                <p>
                  Review potential spoilage
                  indicators from analysis.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                QUALITY ASSESSMENT
            ==================================================== */}

            <button
              className="action-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                🧪📋
              </div>

              <div>

                <span className="action-label">
                  ASSESSMENT
                </span>

                <h3>
                  Quality Assessment
                </h3>

                <p>
                  Review freshness scores,
                  food condition, and quality information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                INSPECTION REPORTS
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                📊🔬
              </div>

              <div>

                <span className="action-label">
                  REPORTING
                </span>

                <h3>
                  Inspection Reports
                </h3>

                <p>
                  Review food quality,
                  freshness, and inspection reports.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>



        {/* ========================================================
            INSPECTOR INSIGHTS
        ======================================================== */}

        <section
          className="dashboard-hero"
          style={{
            marginTop: "28px",
            minHeight: "auto",
          }}
        >

          <div className="hero-copy">

            <span className="mini-label">
              INSPECTOR INSIGHTS
            </span>

            <h2
              style={{
                marginBottom: "10px",
              }}
            >
              Inspect with
              <br />
              <span>
                confidence.
              </span>
            </h2>

            <p className="dashboard-subtitle">
              Review freshness assessments,
              quality scores, spoilage indicators,
              and inspection reports to support
              food quality monitoring.
            </p>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🔬
            </div>

            <div className="fresh-ring">

              <span>
                INSPECT
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


export default InspectorDashboard;
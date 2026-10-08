import { useEffect, useState } from "react";
import { getFoods } from "../api";


function RetailDashboard({
  onLogout,
  onProfile,
  onInventory,
  onReports,
}) {

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================
  // LOAD INVENTORY
  // ==========================================================

  useEffect(() => {

    const loadInventory = async () => {

      try {

        setLoading(true);

        const data = await getFoods();

        setFoods(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (error) {

        console.error(
          "Retail dashboard inventory loading error:",
          error
        );

        setFoods([]);

      } finally {

        setLoading(false);

      }

    };

    loadInventory();

  }, []);


  // ==========================================================
  // RETAIL ANALYTICS
  // ==========================================================

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );


  const sevenDaysFromNow = new Date(
    today
  );

  sevenDaysFromNow.setDate(
    sevenDaysFromNow.getDate() + 7
  );


  const inventoryCount =
    foods.length;


  const shelfLifeAlerts =
    foods.filter((food) => {

      if (!food?.expiry_date) {
        return false;
      }

      const expiryDate =
        new Date(
          `${food.expiry_date}T00:00:00`
        );

      return (
        expiryDate >= today &&
        expiryDate <= sevenDaysFromNow
      );

    }).length;


  const wasteCount =
    foods.filter((food) => {

      const freshness =
        (
          food?.freshness_status || ""
        )
          .trim()
          .toLowerCase();


      const isSpoiled =
        freshness === "spoiled" ||
        freshness === "rotten";


      const isExpired =
        food?.expiry_date &&
        new Date(
          `${food.expiry_date}T00:00:00`
        ) < today;


      return (
        isSpoiled ||
        isExpired
      );

    }).length;


  const inventoryValue =
    loading
      ? "..."
      : inventoryCount;


  const shelfLifeValue =
    loading
      ? "..."
      : shelfLifeAlerts;


  const wasteValue =
    loading
      ? "..."
      : wasteCount;


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
            🏪
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Retail Manager Dashboard
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
              RETAIL MONITORING
            </span>

            <h1>
              Monitor your
              <br />
              <span>
                product freshness.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Monitor product freshness,
              inventory quality, shelf-life alerts,
              and waste reduction insights.
            </p>


            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={onInventory}
                type="button"
              >
                View Inventory →
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
              🏪
            </div>

            <div className="fresh-ring">

              <span>
                RETAIL
              </span>

            </div>

          </div>

        </section>



        {/* ========================================================
            ROLE STATS
        ======================================================== */}

        <section className="stats-grid">


          {/* INVENTORY */}

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
              📦
            </div>

            <div>

              <p>
                Inventory Monitoring
              </p>

              <strong>
                {inventoryValue}
              </strong>

            </div>

          </div>


          {/* SHELF LIFE */}

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

            <div className="stat-icon yellow">
              ⏳
            </div>

            <div>

              <p>
                Shelf-Life Alerts
              </p>

              <strong>
                {shelfLifeValue}
              </strong>

            </div>

          </div>


          {/* WASTE */}

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
              ♻️
            </div>

            <div>

              <p>
                Waste Insights
              </p>

              <strong>
                {wasteValue}
              </strong>

            </div>

          </div>

        </section>



        {/* ========================================================
            RETAIL OPERATIONS
        ======================================================== */}

        <section className="action-section">


          <div className="section-heading">

            <div>

              <span className="mini-label">
                RETAIL OPERATIONS
              </span>

              <h2>
                Product monitoring
              </h2>

            </div>

            <span className="section-emoji">
              📊
            </span>

          </div>



          <div className="action-grid">


            {/* ====================================================
                INVENTORY QUALITY
            ==================================================== */}

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                📦🥬
              </div>

              <div>

                <span className="action-label">
                  INVENTORY
                </span>

                <h3>
                  Product Freshness
                </h3>

                <p>
                  Monitor inventory quality
                  and freshness information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                SHELF LIFE ALERTS
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                ⚠️📅
              </div>

              <div>

                <span className="action-label">
                  ALERTS
                </span>

                <h3>
                  Shelf-Life Alerts
                </h3>

                <p>
                  Track products approaching
                  their shelf-life limits.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                WASTE REDUCTION
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                ♻️📈
              </div>

              <div>

                <span className="action-label">
                  INSIGHTS
                </span>

                <h3>
                  Waste Reduction
                </h3>

                <p>
                  Review waste reduction
                  insights and food quality trends.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                QUALITY REPORTING
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                📊🥦
              </div>

              <div>

                <span className="action-label">
                  REPORTING
                </span>

                <h3>
                  Inventory Quality
                </h3>

                <p>
                  Review freshness,
                  shelf-life, and inventory quality reports.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>



        {/* ========================================================
            RETAIL ROLE INFORMATION
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
              RETAIL MANAGER INSIGHTS
            </span>

            <h2
              style={{
                marginBottom: "10px",
              }}
            >
              Make smarter
              <br />
              <span>
                inventory decisions.
              </span>
            </h2>

            <p className="dashboard-subtitle">
              Use freshness information, shelf-life
              monitoring, inventory quality data, and
              waste reduction insights to support
              retail operations.
            </p>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              📊
            </div>

            <div className="fresh-ring">

              <span>
                INSIGHTS
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


export default RetailDashboard;
import { useEffect, useState } from "react";
import { getFoods } from "../api";


function WarehouseDashboard({
  onLogout,
  onProfile,
  onInventory,
  onReports,
}) {

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);


  // ==========================================================
  // LOAD WAREHOUSE INVENTORY
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
          "Warehouse dashboard inventory loading error:",
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
  // WAREHOUSE ANALYTICS
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


  // ----------------------------------------------------------
  // TOTAL INVENTORY
  // ----------------------------------------------------------

  const inventoryCount =
    foods.length;


  // ----------------------------------------------------------
  // STORAGE CONDITION CONFIGURED
  // ----------------------------------------------------------

  const storageConfiguredCount =
    foods.filter((food) => {

      return Boolean(
        food?.storage_condition &&
        String(
          food.storage_condition
        ).trim()
      );

    }).length;


  // ----------------------------------------------------------
  // STORAGE CONDITION MISSING
  // ----------------------------------------------------------

  const storageMissingCount =
    Math.max(
      inventoryCount -
      storageConfiguredCount,
      0
    );


  // ----------------------------------------------------------
  // STORAGE COMPLIANCE
  // ----------------------------------------------------------

  const complianceCount =
    inventoryCount === 0
      ? 0
      : Math.round(
          (
            storageConfiguredCount /
            inventoryCount
          ) * 100
        );


  // ----------------------------------------------------------
  // BATCH FRESHNESS / NEAR EXPIRY
  // ----------------------------------------------------------

  const batchAlertCount =
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


  // ----------------------------------------------------------
  // SPOILED / EXPIRED
  // ----------------------------------------------------------

  const unhealthyCount =
    foods.filter((food) => {

      const freshness =
        (
          food?.freshness_status || ""
        )
          .trim()
          .toLowerCase();


      const spoiled =
        freshness === "spoiled" ||
        freshness === "rotten";


      const expired =
        food?.expiry_date &&
        new Date(
          `${food.expiry_date}T00:00:00`
        ) < today;


      return (
        spoiled ||
        expired
      );

    }).length;


  // ----------------------------------------------------------
  // DISPLAY VALUES
  // ----------------------------------------------------------

  const inventoryValue =
    loading
      ? "..."
      : inventoryCount;


  const storageValue =
    loading
      ? "..."
      : storageConfiguredCount;


  const complianceValue =
    loading
      ? "..."
      : `${complianceCount}%`;


  const batchValue =
    loading
      ? "..."
      : batchAlertCount;


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
            🏭
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Warehouse Operator Dashboard
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
              WAREHOUSE MONITORING
            </span>

            <h1>
              Protect your
              <br />
              <span>
                stored food.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Monitor storage compliance,
              inventory health, batch freshness,
              and environmental conditions.
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
              🏭
            </div>

            <div className="fresh-ring">

              <span>
                STORAGE
              </span>

            </div>

          </div>

        </section>



        {/* ========================================================
            WAREHOUSE STATS
        ======================================================== */}

        <section className="stats-grid">


          {/* STORAGE CONDITION */}

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

            <div className="stat-icon green">
              🌡️
            </div>

            <div>

              <p>
                Storage Conditions
              </p>

              <strong>
                {loading
                  ? "..."
                  : `${storageValue} configured`}
              </strong>

            </div>

          </div>


          {/* STORAGE DATA */}

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
              💧
            </div>

            <div>

              <p>
                Storage Data
              </p>

              <strong>
                {loading
                  ? "..."
                  : storageMissingCount === 0
                    ? "Complete"
                    : `${storageMissingCount} missing`}
              </strong>

            </div>

          </div>


          {/* COMPLIANCE */}

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
              📋
            </div>

            <div>

              <p>
                Storage Compliance
              </p>

              <strong>
                {complianceValue}
              </strong>

            </div>

          </div>

        </section>



        {/* ========================================================
            STORAGE OPERATIONS
        ======================================================== */}

        <section className="action-section">

          <div className="section-heading">

            <div>

              <span className="mini-label">
                STORAGE OPERATIONS
              </span>

              <h2>
                Warehouse health
              </h2>

            </div>

            <span className="section-emoji">
              🌡️
            </span>

          </div>


          <div className="action-grid">


            {/* ====================================================
                INVENTORY HEALTH
            ==================================================== */}

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                📦🌱
              </div>

              <div>

                <span className="action-label">
                  INVENTORY
                </span>

                <h3>
                  Inventory Health
                </h3>

                <p>
                  Track stored food and
                  freshness information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                STORAGE COMPLIANCE
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                🌡️💧
              </div>

              <div>

                <span className="action-label">
                  STORAGE
                </span>

                <h3>
                  Storage Compliance
                </h3>

                <p>
                  Monitor environmental
                  storage conditions.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                BATCH FRESHNESS
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                📦⏳
              </div>

              <div>

                <span className="action-label">
                  BATCH MONITORING
                </span>

                <h3>
                  Batch Freshness
                </h3>

                <p>
                  Review freshness and
                  shelf-life information for stored food.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                ENVIRONMENTAL ANALYTICS
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                🌡️📊
              </div>

              <div>

                <span className="action-label">
                  ANALYTICS
                </span>

                <h3>
                  Environmental Analytics
                </h3>

                <p>
                  Review storage condition
                  and environmental monitoring information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>



        {/* ========================================================
            WAREHOUSE INSIGHTS
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
              WAREHOUSE OPERATOR INSIGHTS
            </span>

            <h2
              style={{
                marginBottom: "10px",
              }}
            >
              Maintain better
              <br />
              <span>
                storage conditions.
              </span>
            </h2>

            <p className="dashboard-subtitle">
              Monitor inventory health, storage
              compliance, batch freshness, and
              environmental conditions to support
              safe food storage operations.
            </p>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🌡️
            </div>

            <div className="fresh-ring">

              <span>
                HEALTH
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


export default WarehouseDashboard;
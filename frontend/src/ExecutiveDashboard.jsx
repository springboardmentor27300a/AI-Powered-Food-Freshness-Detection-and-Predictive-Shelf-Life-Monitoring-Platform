import { useEffect, useState } from "react";
import "./Dashboard.css";
import { apiFetch } from "./api";

function ExecutiveDashboard({ user, onBack, onLogout }) {

  const [reports, setReports] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // LOAD EXECUTIVE DATA
  // ============================================================

  const loadExecutiveData = async () => {

    try {

      setLoading(true);
      setError("");

      const [
        reportsResponse,
        foodItemsResponse,
        batchesResponse
      ] = await Promise.all([

        apiFetch("/analysis/reports"),

        apiFetch("/inventory/food-items"),

        apiFetch("/inventory/batches")

      ]);


      const reportsData =
        await reportsResponse.json();

      const foodItemsData =
        await foodItemsResponse.json();

      const batchesData =
        await batchesResponse.json();


      if (!reportsResponse.ok) {

        throw new Error(
          reportsData.detail ||
          "Could not load analysis reports."
        );

      }


      if (!foodItemsResponse.ok) {

        throw new Error(
          foodItemsData.detail ||
          "Could not load food items."
        );

      }


      if (!batchesResponse.ok) {

        throw new Error(
          batchesData.detail ||
          "Could not load food batches."
        );

      }


      // --------------------------------------------------------
      // REPORTS
      // --------------------------------------------------------

      if (
        Array.isArray(reportsData)
      ) {

        setReports(reportsData);

      }

      else if (
        reportsData &&
        Array.isArray(reportsData.reports)
      ) {

        setReports(
          reportsData.reports
        );

      }

      else {

        setReports([]);

      }


      // --------------------------------------------------------
      // FOOD ITEMS
      // --------------------------------------------------------

      if (
        Array.isArray(foodItemsData)
      ) {

        setFoodItems(
          foodItemsData
        );

      }

      else if (
        foodItemsData &&
        Array.isArray(foodItemsData.food_items)
      ) {

        setFoodItems(
          foodItemsData.food_items
        );

      }

      else {

        setFoodItems([]);

      }


      // --------------------------------------------------------
      // BATCHES
      // --------------------------------------------------------

      if (
        Array.isArray(batchesData)
      ) {

        setBatches(
          batchesData
        );

      }

      else if (
        batchesData &&
        Array.isArray(batchesData.batches)
      ) {

        setBatches(
          batchesData.batches
        );

      }

      else {

        setBatches([]);

      }

    }

    catch (err) {

      console.error(
        "Executive dashboard error:",
        err
      );

      setError(
        err.message ||
        "Unable to load executive dashboard."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // ============================================================
  // LOAD DATA WHEN PAGE OPENS
  // ============================================================

  useEffect(() => {

    loadExecutiveData();

  }, []);


  // ============================================================
  // CALCULATIONS
  // ============================================================

  const totalAnalyses =
    reports.length;


  const freshCount =
    reports.filter(
      (report) =>
        report.freshness_classification ===
        "Fresh"
    ).length;


  const moderatelyFreshCount =
    reports.filter(
      (report) =>
        report.freshness_classification ===
        "Moderately Fresh"
    ).length;


  const lowFreshnessCount =
    reports.filter(
      (report) =>
        report.freshness_classification ===
        "Low Freshness"
    ).length;


  const spoiledCount =
    reports.filter(
      (report) =>
        report.freshness_classification ===
        "Spoiled / Unsafe"
    ).length;


  // ============================================================
  // AVERAGE FRESHNESS
  // ============================================================

  const freshnessScores =
    reports
      .map(
        (report) =>
          Number(
            report.freshness_score
          )
      )
      .filter(
        (score) =>
          Number.isFinite(score)
      );


  const averageFreshness =
    freshnessScores.length > 0

      ? (
          freshnessScores.reduce(
            (sum, score) =>
              sum + score,
            0
          )
          /
          freshnessScores.length
        ).toFixed(1)

      : "0.0";


  // ============================================================
  // AVERAGE CONFIDENCE
  // ============================================================

  const confidenceScores =
    reports
      .map(
        (report) =>
          Number(
            report.freshness_confidence
          )
      )
      .filter(
        (confidence) =>
          Number.isFinite(confidence)
      );


  const averageConfidence =
    confidenceScores.length > 0

      ? (
          confidenceScores.reduce(
            (sum, confidence) =>
              sum + confidence,
            0
          )
          /
          confidenceScores.length
        ).toFixed(1)

      : "0.0";


  // ============================================================
  // PERCENTAGES
  // ============================================================

  const getPercentage = (count) => {

    if (totalAnalyses === 0) {

      return 0;

    }

    return (
      count /
      totalAnalyses
    ) * 100;

  };


  const freshPercentage =
    getPercentage(
      freshCount
    );


  const moderatePercentage =
    getPercentage(
      moderatelyFreshCount
    );


  const lowPercentage =
    getPercentage(
      lowFreshnessCount
    );


  const spoiledPercentage =
    getPercentage(
      spoiledCount
    );


  // ============================================================
  // RECENT REPORTS
  // ============================================================

  const recentReports =
    [...reports]
      .sort(
        (a, b) =>
          new Date(
            b.created_at || 0
          )
          -
          new Date(
            a.created_at || 0
          )
      )
      .slice(0, 5);


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (

      <div className="dashboard">

        <nav className="dashboard-navbar">

          <div className="dashboard-logo">
            🍎 FoodFresh
          </div>

          <div className="dashboard-user">

            <span>
              {user?.name} ({user?.role})
            </span>

            <button
              type="button"
              onClick={onLogout}
            >
              Logout
            </button>

          </div>

        </nav>


        <main className="dashboard-content">

          <div className="dashboard-header">

            <p className="dashboard-label">
              EXECUTIVE DASHBOARD
            </p>

            <h1>
              Platform Analytics
            </h1>

            <p>
              Loading platform data...
            </p>

          </div>

        </main>

      </div>

    );

  }


  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (

    <div className="dashboard">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="dashboard-navbar">

        <div className="dashboard-logo">
          🍎 FoodFresh
        </div>


        <div className="dashboard-user">

          <span>
            {user?.name} ({user?.role})
          </span>


          <button
            type="button"
            onClick={onLogout}
          >
            Logout
          </button>

        </div>

      </nav>


      {/* ======================================================
          CONTENT
      ====================================================== */}

      <main className="dashboard-content">

        <div className="dashboard-header">

          <p className="dashboard-label">
            EXECUTIVE DASHBOARD
          </p>


          <h1>
            Platform Analytics
          </h1>


          <p>
            Monitor food freshness, inventory,
            analysis activity and overall
            platform health.
          </p>

        </div>


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (

          <div className="analytics-message">

            {error}

          </div>

        )}


        {/* ====================================================
            SUMMARY CARDS
        ==================================================== */}

        <div className="dashboard-cards">

          {/* TOTAL USERS */}

          <div className="dashboard-card">

            <div className="card-icon">
              👥
            </div>

            <h2>
              Users
            </h2>

            <p>
              Platform user management
            </p>

            <div className="executive-number">
              —
            </div>

          </div>


          {/* FOOD ITEMS */}

          <div className="dashboard-card">

            <div className="card-icon">
              🍎
            </div>

            <h2>
              Food Items
            </h2>

            <p>
              Registered food products
            </p>

            <div className="executive-number">
              {foodItems.length}
            </div>

          </div>


          {/* BATCHES */}

          <div className="dashboard-card">

            <div className="card-icon">
              📦
            </div>

            <h2>
              Food Batches
            </h2>

            <p>
              Inventory batches
            </p>

            <div className="executive-number">
              {batches.length}
            </div>

          </div>


          {/* ANALYSES */}

          <div className="dashboard-card">

            <div className="card-icon">
              🔬
            </div>

            <h2>
              Analyses
            </h2>

            <p>
              Total freshness analyses
            </p>

            <div className="executive-number">
              {totalAnalyses}
            </div>

          </div>

        </div>


        {/* ====================================================
            FRESHNESS SUMMARY
        ==================================================== */}

        <section className="executive-section">

          <div className="executive-section-header">

            <div>

              <p className="dashboard-label">
                FRESHNESS OVERVIEW
              </p>

              <h2>
                Food Quality Summary
              </h2>

            </div>

          </div>


          <div className="executive-summary-grid">

            <div className="executive-summary-card">

              <span className="executive-summary-icon">
                🟢
              </span>

              <div>

                <strong>
                  {freshCount}
                </strong>

                <span>
                  Fresh
                </span>

              </div>

            </div>


            <div className="executive-summary-card">

              <span className="executive-summary-icon">
                🟡
              </span>

              <div>

                <strong>
                  {moderatelyFreshCount}
                </strong>

                <span>
                  Moderately Fresh
                </span>

              </div>

            </div>


            <div className="executive-summary-card">

              <span className="executive-summary-icon">
                🟠
              </span>

              <div>

                <strong>
                  {lowFreshnessCount}
                </strong>

                <span>
                  Low Freshness
                </span>

              </div>

            </div>


            <div className="executive-summary-card">

              <span className="executive-summary-icon">
                🔴
              </span>

              <div>

                <strong>
                  {spoiledCount}
                </strong>

                <span>
                  Spoiled / Unsafe
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* ====================================================
            PERFORMANCE METRICS
        ==================================================== */}

        <section className="executive-section">

          <p className="dashboard-label">
            PERFORMANCE
          </p>

          <h2>
            Freshness Performance
          </h2>


          <div className="executive-metrics-grid">

            <div className="executive-metric-card">

              <span>
                Average Freshness Score
              </span>

              <strong>
                {averageFreshness}/100
              </strong>

            </div>


            <div className="executive-metric-card">

              <span>
                Average AI Confidence
              </span>

              <strong>
                {averageConfidence}%
              </strong>

            </div>


            <div className="executive-metric-card">

              <span>
                Safe / Fresh Analyses
              </span>

              <strong>
                {freshPercentage.toFixed(1)}%
              </strong>

            </div>


            <div className="executive-metric-card">

              <span>
                Spoiled / Unsafe
              </span>

              <strong>
                {spoiledPercentage.toFixed(1)}%
              </strong>

            </div>

          </div>

        </section>


        {/* ====================================================
            FRESHNESS DISTRIBUTION
        ==================================================== */}

        <section className="executive-section">

          <p className="dashboard-label">
            VISUALIZATION
          </p>

          <h2>
            Freshness Distribution
          </h2>


          <div className="executive-chart-card">

            {/* FRESH */}

            <div className="executive-bar-row">

              <div className="executive-bar-label">

                <span>
                  Fresh
                </span>

                <strong>
                  {freshCount}
                </strong>

              </div>


              <div className="executive-bar-track">

                <div
                  className="executive-bar-fill executive-bar-fresh"
                  style={{
                    width:
                      `${freshPercentage}%`
                  }}
                />

              </div>

            </div>


            {/* MODERATE */}

            <div className="executive-bar-row">

              <div className="executive-bar-label">

                <span>
                  Moderately Fresh
                </span>

                <strong>
                  {moderatelyFreshCount}
                </strong>

              </div>


              <div className="executive-bar-track">

                <div
                  className="executive-bar-fill executive-bar-moderate"
                  style={{
                    width:
                      `${moderatePercentage}%`
                  }}
                />

              </div>

            </div>


            {/* LOW */}

            <div className="executive-bar-row">

              <div className="executive-bar-label">

                <span>
                  Low Freshness
                </span>

                <strong>
                  {lowFreshnessCount}
                </strong>

              </div>


              <div className="executive-bar-track">

                <div
                  className="executive-bar-fill executive-bar-low"
                  style={{
                    width:
                      `${lowPercentage}%`
                  }}
                />

              </div>

            </div>


            {/* SPOILED */}

            <div className="executive-bar-row">

              <div className="executive-bar-label">

                <span>
                  Spoiled / Unsafe
                </span>

                <strong>
                  {spoiledCount}
                </strong>

              </div>


              <div className="executive-bar-track">

                <div
                  className="executive-bar-fill executive-bar-spoiled"
                  style={{
                    width:
                      `${spoiledPercentage}%`
                  }}
                />

              </div>

            </div>

          </div>

        </section>


        {/* ====================================================
            RECENT REPORTS
        ==================================================== */}

        <section className="executive-section">

          <div className="executive-section-header">

            <div>

              <p className="dashboard-label">
                REPORTING
              </p>

              <h2>
                Recent Food Analysis Reports
              </h2>

            </div>


            <button
              type="button"
              onClick={loadExecutiveData}
            >
              Refresh
            </button>

          </div>


          {recentReports.length === 0 ? (

            <div className="analytics-message">

              No food analysis reports available.

            </div>

          ) : (

            <div className="executive-table-wrapper">

              <table className="executive-table">

                <thead>

                  <tr>

                    <th>
                      File
                    </th>

                    <th>
                      Classification
                    </th>

                    <th>
                      Score
                    </th>

                    <th>
                      Confidence
                    </th>

                    <th>
                      Condition
                    </th>

                    <th>
                      Date
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {recentReports.map(
                    (report) => (

                    <tr
                      key={report.id}
                    >

                      <td>
                        {report.filename}
                      </td>


                      <td>
                        {report.freshness_classification}
                      </td>


                      <td>
                        {Number(
                          report.freshness_score || 0
                        ).toFixed(1)}
                      </td>


                      <td>
                        {Number(
                          report.freshness_confidence || 0
                        ).toFixed(1)}%
                      </td>


                      <td>
                        {report.condition || "—"}
                      </td>


                      <td>
                        {report.created_at
                          ? new Date(
                              report.created_at
                            ).toLocaleDateString()
                          : "—"}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* ====================================================
            SYSTEM STATUS
        ==================================================== */}

        <section className="executive-section">

          <p className="dashboard-label">
            SYSTEM
          </p>

          <h2>
            Platform Status
          </h2>


          <div className="executive-status-grid">

            <div className="executive-status-card">

              <span className="status-dot">
                ●
              </span>

              <div>

                <strong>
                  Backend API
                </strong>

                <span>
                  Connected
                </span>

              </div>

            </div>


            <div className="executive-status-card">

              <span className="status-dot">
                ●
              </span>

              <div>

                <strong>
                  PostgreSQL
                </strong>

                <span>
                  Connected
                </span>

              </div>

            </div>


            <div className="executive-status-card">

              <span className="status-dot">
                ●
              </span>

              <div>

                <strong>
                  AI Analysis
                </strong>

                <span>
                  Operational
                </span>

              </div>

            </div>


            <div className="executive-status-card">

              <span className="status-dot">
                ●
              </span>

              <div>

                <strong>
                  Analytics
                </strong>

                <span>
                  Operational
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* ====================================================
            BACK BUTTON
        ==================================================== */}

        <button
          type="button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>

      </main>

    </div>

  );

}

export default ExecutiveDashboard;
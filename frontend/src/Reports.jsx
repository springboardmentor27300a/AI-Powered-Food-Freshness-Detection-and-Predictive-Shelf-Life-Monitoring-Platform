import { useEffect, useMemo, useState } from "react";
import "./Reports.css";
import { apiFetch, normalizeRole } from "./api";

function Reports({ user, onBack, onLogout }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  // ============================================================
  // LOAD REPORTS
  // ============================================================

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");

      const role = normalizeRole(user?.role);

      const allReportsRoles = [
        "Administrator",
        "Retail Manager",
        "Warehouse Operator",
        "Food Quality Inspector",
      ];

      const endpoint = allReportsRoles.includes(role)
        ? "/analysis/reports"
        : "/analysis/my-reports";

      const response = await apiFetch(endpoint);
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail || "Could not load reports."
        );
        return;
      }

      if (Array.isArray(data)) {
        setReports(data);
      } else if (Array.isArray(data?.reports)) {
        setReports(data.reports);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user]);

  // ============================================================
  // CLASSIFICATION HELPERS
  // ============================================================

  const getClassification = (report) => {
    return (
      report?.freshness_classification ||
      report?.condition ||
      "Unknown"
    );
  };

  const getClassificationType = (report) => {
    const value = getClassification(report).toLowerCase();

    if (
      value.includes("spoiled") ||
      value.includes("unsafe")
    ) {
      return "spoiled";
    }

    if (value.includes("low")) {
      return "low";
    }

    if (
      value.includes("moderate") ||
      value.includes("acceptable") ||
      value.includes("good")
    ) {
      return "moderate";
    }

    if (value === "fresh" || value.includes("fresh")) {
      return "fresh";
    }

    return "unknown";
  };

  // ============================================================
  // FILTER
  // ============================================================

  const filteredReports = useMemo(() => {
    if (filter === "All") {
      return reports;
    }

    return reports.filter((report) => {
      const type = getClassificationType(report);

      if (filter === "Fresh") return type === "fresh";
      if (filter === "Moderate") return type === "moderate";
      if (filter === "Low") return type === "low";
      if (filter === "Spoiled") return type === "spoiled";

      return true;
    });
  }, [reports, filter]);

  // ============================================================
  // SUMMARY
  // ============================================================

  const total = reports.length;

  const freshCount = reports.filter(
    (report) =>
      getClassificationType(report) === "fresh"
  ).length;

  const moderateCount = reports.filter(
    (report) =>
      getClassificationType(report) === "moderate"
  ).length;

  const lowCount = reports.filter(
    (report) =>
      getClassificationType(report) === "low"
  ).length;

  const spoiledCount = reports.filter(
    (report) =>
      getClassificationType(report) === "spoiled"
  ).length;

  const averageFreshness = useMemo(() => {
    const values = reports
      .map((report) =>
        Number(report.freshness_score)
      )
      .filter((value) => Number.isFinite(value));

    if (!values.length) return "0.0";

    return (
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    ).toFixed(1);
  }, [reports]);

  const averageConfidence = useMemo(() => {
    const values = reports
      .map((report) =>
        Number(report.freshness_confidence)
      )
      .filter((value) => Number.isFinite(value));

    if (!values.length) return "0.0";

    return (
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    ).toFixed(1);
  }, [reports]);

  // ============================================================
  // PERCENTAGE
  // ============================================================

  const percentage = (count) => {
    if (!total) return 0;

    return ((count / total) * 100).toFixed(1);
  };

  // ============================================================
  // CSV EXPORT
  // ============================================================

  const exportCSV = () => {
    if (!reports.length) {
      alert("There are no reports to export.");
      return;
    }

    const headers = [
      "ID",
      "Filename",
      "Classification",
      "Freshness Score",
      "Confidence",
      "Color Level",
      "Texture Level",
      "Mold Level",
      "Bruising Level",
      "Physical Damage",
      "Condition",
      "Recommendation",
      "Created At",
    ];

    const rows = reports.map((report) => [
      report.id ?? "",
      report.filename ?? "",
      report.freshness_classification ?? "",
      report.freshness_score ?? "",
      report.freshness_confidence ?? "",
      report.color_level ?? "",
      report.texture_level ?? "",
      report.mold_level ?? "",
      report.bruising_level ?? "",
      report.physical_damage_level ?? "",
      report.condition ?? "",
      report.recommendation ?? "",
      report.created_at ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "foodfresh_reports.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // ============================================================
  // PRINT / PDF
  // ============================================================

  const exportPDF = () => {
    window.print();
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="reports-page">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="reports-navbar">

        <div className="reports-brand">

          <div className="reports-brand-icon">
            🍎
          </div>

          <div className="reports-brand-text">

            <strong>
              FoodFresh
            </strong>

            <span>
              Food Freshness Monitoring Platform
            </span>

          </div>

        </div>


        <div className="reports-user">

          <div className="reports-user-info">

            <div className="reports-avatar">
              {user?.name
                ? user.name
                    .charAt(0)
                    .toUpperCase()
                : "U"}
            </div>

            <div>

              <strong>
                {user?.name || "User"}
              </strong>

              <span>
                {user?.role || "User"}
              </span>

            </div>

          </div>


          <button
            onClick={onLogout}
            className="reports-logout"
          >
            Logout
          </button>

        </div>

      </nav>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="reports-container">

        {/* HEADER */}

        <section className="reports-header">

          <div>

            <p className="reports-eyebrow">
              REPORTING CENTER
            </p>

            <h1>
              Food Freshness Reports
            </h1>

            <p className="reports-header-description">
              Review freshness analysis,
              quality conditions and food
              safety information in one place.
            </p>

          </div>


          <div className="reports-header-actions">

            <button
              className="reports-back-btn"
              onClick={onBack}
            >
              ← Back to Dashboard
            </button>

            <button
              className="reports-refresh-btn"
              onClick={loadReports}
            >
              ↻ Refresh
            </button>

          </div>

        </section>


        {/* ERROR */}

        {error && (
          <div className="reports-error">

            <span>⚠️</span>

            <div>
              <strong>
                Unable to load reports
              </strong>

              <p>
                {error}
              </p>
            </div>

          </div>
        )}


        {/* LOADING */}

        {loading ? (

          <div className="reports-loading">

            <div className="reports-spinner"></div>

            <h2>
              Loading Reports
            </h2>

            <p>
              Fetching freshness analysis data...
            </p>

          </div>

        ) : (

          <>

            {/* =================================================
                SUMMARY
            ================================================= */}

            <section className="reports-summary-grid">

              <div className="report-summary-card">

                <div className="report-summary-icon">
                  📊
                </div>

                <div>
                  <span>Total Reports</span>
                  <strong>{total}</strong>
                  <small>Analysis records</small>
                </div>

              </div>


              <div className="report-summary-card green">

                <div className="report-summary-icon">
                  🟢
                </div>

                <div>
                  <span>Fresh</span>
                  <strong>{freshCount}</strong>
                  <small>
                    {percentage(freshCount)}% of reports
                  </small>
                </div>

              </div>


              <div className="report-summary-card teal">

                <div className="report-summary-icon">
                  🟡
                </div>

                <div>
                  <span>Good / Acceptable</span>
                  <strong>{moderateCount}</strong>
                  <small>
                    {percentage(moderateCount)}% of reports
                  </small>
                </div>

              </div>


              <div className="report-summary-card orange">

                <div className="report-summary-icon">
                  🟠
                </div>

                <div>
                  <span>Low Freshness</span>
                  <strong>{lowCount}</strong>
                  <small>
                    {percentage(lowCount)}% of reports
                  </small>
                </div>

              </div>


              <div className="report-summary-card red">

                <div className="report-summary-icon">
                  🔴
                </div>

                <div>
                  <span>Spoiled / Unsafe</span>
                  <strong>{spoiledCount}</strong>
                  <small>
                    {percentage(spoiledCount)}% of reports
                  </small>
                </div>

              </div>


              <div className="report-summary-card blue">

                <div className="report-summary-icon">
                  ⭐
                </div>

                <div>
                  <span>Avg. Freshness</span>
                  <strong>
                    {averageFreshness}
                    <small className="score-unit">
                      /100
                    </small>
                  </strong>
                  <small>Quality score</small>
                </div>

              </div>


              <div className="report-summary-card purple">

                <div className="report-summary-icon">
                  🤖
                </div>

                <div>
                  <span>Avg. Confidence</span>
                  <strong>
                    {averageConfidence}%
                  </strong>
                  <small>AI model confidence</small>
                </div>

              </div>

            </section>


            {/* =================================================
                VISUALIZATION
            ================================================= */}

            <section className="reports-visual-grid">


              {/* DISTRIBUTION */}

              <div className="reports-card">

                <div className="reports-card-header">

                  <div>

                    <p>
                      QUALITY OVERVIEW
                    </p>

                    <h2>
                      Freshness Distribution
                    </h2>

                  </div>

                  <span className="reports-card-icon">
                    📈
                  </span>

                </div>


                <div className="report-bars">

                  <div className="report-bar-row">

                    <div className="report-bar-label">

                      <span>🟢 Fresh</span>

                      <strong>
                        {percentage(freshCount)}%
                      </strong>

                    </div>

                    <div className="report-bar">
                      <div
                        className="report-bar-fill fresh"
                        style={{
                          width:
                            `${percentage(
                              freshCount
                            )}%`,
                        }}
                      />
                    </div>

                  </div>


                  <div className="report-bar-row">

                    <div className="report-bar-label">

                      <span>
                        🟡 Good / Acceptable
                      </span>

                      <strong>
                        {percentage(
                          moderateCount
                        )}%
                      </strong>

                    </div>

                    <div className="report-bar">
                      <div
                        className="report-bar-fill moderate"
                        style={{
                          width:
                            `${percentage(
                              moderateCount
                            )}%`,
                        }}
                      />
                    </div>

                  </div>


                  <div className="report-bar-row">

                    <div className="report-bar-label">

                      <span>
                        🟠 Low Freshness
                      </span>

                      <strong>
                        {percentage(lowCount)}%
                      </strong>

                    </div>

                    <div className="report-bar">
                      <div
                        className="report-bar-fill low"
                        style={{
                          width:
                            `${percentage(
                              lowCount
                            )}%`,
                        }}
                      />
                    </div>

                  </div>


                  <div className="report-bar-row">

                    <div className="report-bar-label">

                      <span>
                        🔴 Spoiled / Unsafe
                      </span>

                      <strong>
                        {percentage(
                          spoiledCount
                        )}%
                      </strong>

                    </div>

                    <div className="report-bar">
                      <div
                        className="report-bar-fill spoiled"
                        style={{
                          width:
                            `${percentage(
                              spoiledCount
                            )}%`,
                        }}
                      />
                    </div>

                  </div>

                </div>

              </div>


              {/* QUALITY SUMMARY */}

              <div className="reports-card">

                <div className="reports-card-header">

                  <div>

                    <p>
                      QUALITY STATUS
                    </p>

                    <h2>
                      Overall Summary
                    </h2>

                  </div>

                  <span className="reports-card-icon">
                    ⭐
                  </span>

                </div>


                <div className="quality-score">

                  <div className="quality-score-circle">

                    <strong>
                      {averageFreshness}
                    </strong>

                    <span>
                      /100
                    </span>

                  </div>


                  <div>

                    <h3>
                      Average Freshness
                    </h3>

                    <p>
                      Overall freshness score
                      calculated from available
                      food analysis reports.
                    </p>

                  </div>

                </div>


                <div className="quality-metrics">

                  <div>
                    <span>Fresh</span>
                    <strong className="green-text">
                      {freshCount}
                    </strong>
                  </div>

                  <div>
                    <span>At Risk</span>
                    <strong className="orange-text">
                      {lowCount}
                    </strong>
                  </div>

                  <div>
                    <span>Unsafe</span>
                    <strong className="red-text">
                      {spoiledCount}
                    </strong>
                  </div>

                </div>

              </div>

            </section>


            {/* =================================================
                FILTERS + EXPORT
            ================================================= */}

            <section className="reports-toolbar">

              <div className="reports-filter-area">

                <p>
                  FILTER REPORTS
                </p>

                <div className="report-filters">

                  {[
                    "All",
                    "Fresh",
                    "Moderate",
                    "Low",
                    "Spoiled",
                  ].map((item) => (

                    <button
                      key={item}
                      className={
                        filter === item
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setFilter(item)
                      }
                    >
                      {item}
                    </button>

                  ))}

                </div>

              </div>


              <div className="report-export-buttons">

                <button
                  onClick={exportCSV}
                >
                  📗 Export CSV
                </button>

                <button
                  onClick={exportPDF}
                >
                  📄 Print / PDF
                </button>

              </div>

            </section>


            {/* =================================================
                REPORT TABLE
            ================================================= */}

            <section className="reports-card reports-table-card">

              <div className="reports-card-header">

                <div>

                  <p>
                    ANALYSIS HISTORY
                  </p>

                  <h2>
                    Food Freshness Reports
                  </h2>

                </div>

                <span className="report-count">
                  {filteredReports.length} reports
                </span>

              </div>


              {filteredReports.length === 0 ? (

                <div className="reports-empty">

                  <div>
                    📋
                  </div>

                  <h3>
                    No reports found
                  </h3>

                  <p>
                    There are no reports matching
                    the selected filter.
                  </p>

                </div>

              ) : (

                <div className="reports-table-wrapper">

                  <table>

                    <thead>

                      <tr>
                        <th>Food / Image</th>
                        <th>Classification</th>
                        <th>Freshness</th>
                        <th>Confidence</th>
                        <th>Condition</th>
                        <th>Date</th>
                      </tr>

                    </thead>


                    <tbody>

                      {filteredReports.map(
                        (report, index) => {

                          const classification =
                            getClassification(report);

                          const classificationType =
                            getClassificationType(
                              report
                            );

                          return (
                            <tr
                              key={
                                report.id ||
                                report.filename ||
                                index
                              }
                            >

                              <td>

                                <div className="report-food-cell">

                                  <div className="report-food-icon">
                                    🍎
                                  </div>

                                  <div>

                                    <strong>
                                      {report.filename ||
                                        "Food Image"}
                                    </strong>

                                    <span>
                                      Report #
                                      {report.id ??
                                        index + 1}
                                    </span>

                                  </div>

                                </div>

                              </td>


                              <td>

                                <span
                                  className={`classification-badge ${classificationType}`}
                                >
                                  {classification}
                                </span>

                              </td>


                              <td>

                                <strong className="table-score">
                                  {report.freshness_score ??
                                    "—"}
                                </strong>

                                <span>
                                  /100
                                </span>

                              </td>


                              <td>

                                {report.freshness_confidence ??
                                  "—"}
                                %

                              </td>


                              <td>
                                {report.condition ||
                                  "—"}
                              </td>


                              <td>

                                {report.created_at
                                  ? new Date(
                                      report.created_at
                                    ).toLocaleDateString()
                                  : "—"}

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </>

        )}

      </main>

    </div>
  );
}

export default Reports;
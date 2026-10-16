import { useCallback, useEffect, useMemo, useState } from "react";

import "./Dashboard.css";

import Inventory from "./Inventory";
import BatchManagement from "./BatchManagement";
import ShelfLife from "./ShelfLife";
import Reports from "./Reports";

import ConsumerDashboard from "./dashboards/ConsumerDashboard";
import RetailManagerDashboard from "./dashboards/RetailManagerDashboard";
import WarehouseDashboard from "./dashboards/WarehouseDashboard";
import QualityInspectorDashboard from "./dashboards/QualityInspectorDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";

import Recommendations from "./Recommendations";
import NotificationBell from "./NotificationBell";

import StorageMonitoring from "./StorageMonitoring";

import {
  analyzeFoodImage,
  apiFetch,
  normalizeRole
} from "./api";


/* ============================================================
   HELPER
============================================================ */

async function getApiData(path) {
  const response = await apiFetch(path);

  // Supports both:
  // 1. apiFetch returning Response
  // 2. apiFetch returning already parsed JSON

  if (
    response &&
    typeof response.json === "function"
  ) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        data?.message ||
        "Request failed."
      );
    }

    return data;
  }

  return response;
}


/* ============================================================
   MAIN DASHBOARD
============================================================ */

function Dashboard({ user, onLogout }) {

  const [currentPage, setCurrentPage] =
    useState("dashboard");


  /* ==========================================================
     ANALYSIS STATE
  ========================================================== */

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [analysis, setAnalysis] =
    useState(null);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState("");


  /* ==========================================================
     ANALYTICS STATE
  ========================================================== */

  const [analytics, setAnalytics] =
    useState([]);

  const [analyticsLoading, setAnalyticsLoading] =
    useState(false);

  const [analyticsError, setAnalyticsError] =
    useState("");

  const [analyticsSearch, setAnalyticsSearch] =
    useState("");

  const [analyticsFilter, setAnalyticsFilter] =
    useState("All");


  const role =
    normalizeRole(user?.role) || "Consumer";


  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const navigate = (page) => {
    setCurrentPage(page);
  };


  const goDashboard = () => {
    setCurrentPage("dashboard");
  };


  /* ==========================================================
     IMAGE CHANGE
  ========================================================== */

  const handleFileChange = (event) => {

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }


    if (!file.type.startsWith("image/")) {

      setAnalysisError(
        "Please select a valid image file."
      );

      return;
    }


    if (file.size > 10 * 1024 * 1024) {

      setAnalysisError(
        "Image size must be less than 10 MB."
      );

      return;
    }


    setSelectedFile(file);

    setAnalysis(null);

    setAnalysisError("");


    const preview =
      URL.createObjectURL(file);

    setImagePreview(preview);
  };


  /* ==========================================================
     ANALYZE FOOD
  ========================================================== */

  const handleAnalyze = async () => {

    if (!selectedFile) {

      setAnalysisError(
        "Please select a food image first."
      );

      return;
    }


    try {

      setAnalyzing(true);

      setAnalysisError("");

      setAnalysis(null);


      const result =
        await analyzeFoodImage(
          selectedFile
        );


      setAnalysis(result);


      // Refresh analytics after successful analysis
      loadFreshnessAnalytics();

    }

    catch (error) {

      console.error(
        "Food analysis error:",
        error
      );

      setAnalysisError(
        error?.message ||
        "Unable to analyze the food image."
      );

    }

    finally {

      setAnalyzing(false);

    }
  };


  /* ==========================================================
     CLEAR ANALYSIS
  ========================================================== */

  const clearAnalysis = () => {

    setSelectedFile(null);

    setImagePreview("");

    setAnalysis(null);

    setAnalysisError("");

  };


  /* ==========================================================
     LOAD ANALYTICS
  ========================================================== */

  const loadFreshnessAnalytics = async () => {

    try {

      setAnalyticsLoading(true);

      setAnalyticsError("");


      const canViewAllReports = [
        "Administrator",
        "Retail Manager",
        "Warehouse Operator",
        "Food Quality Inspector",
      ].includes(role);

      const endpoint = canViewAllReports
        ? "/analysis/reports"
        : "/analysis/my-reports";


      const data =
        await getApiData(endpoint);


      const reports =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.reports)
            ? data.reports
            : [];


      setAnalytics(reports);

    }

    catch (error) {

      console.error(
        "Analytics error:",
        error
      );

      setAnalyticsError(
        error?.message ||
        "Unable to load freshness analytics."
      );

      setAnalytics([]);

    }

    finally {

      setAnalyticsLoading(false);

    }
  };


  useEffect(() => {

    if (
      currentPage === "analytics"
    ) {

      loadFreshnessAnalytics();

    }

  }, [currentPage, role]);


  /* ==========================================================
     ROLE DASHBOARDS
  ========================================================== */

  if (currentPage === "dashboard") {

    if (role === "Consumer") {

      return (
        <ConsumerDashboard
          user={user}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      );

    }


    if (role === "Retail Manager") {

      return (
        <RetailManagerDashboard
          user={user}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      );

    }


    if (role === "Warehouse Operator") {

      return (
        <WarehouseDashboard
          user={user}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      );

    }


    if (
      role === "Food Quality Inspector"
    ) {

      return (
        <QualityInspectorDashboard
          user={user}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      );

    }


    if (role === "Administrator") {

      return (
        <AdminDashboard
          user={user}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      );

    }

    return (
      <ConsumerDashboard
        user={user}
        onNavigate={navigate}
        onLogout={onLogout}
      />
    );

  }


  /* ==========================================================
     INVENTORY
  ========================================================== */

  if (currentPage === "inventory") {

    return (
      <Inventory
        user={user}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }


  /* ==========================================================
     BATCH MANAGEMENT
  ========================================================== */

  if (currentPage === "batches") {

    return (
      <BatchManagement
        user={user}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }


  /* ==========================================================
     SHELF LIFE
  ========================================================== */

  if (currentPage === "shelf-life") {

    return (
      <ShelfLife
        user={user}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }


  /* ==========================================================
     REPORTS
  ========================================================== */

  if (currentPage === "reports") {

    return (
      <Reports
        user={user}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }
  if (currentPage === "recommendations") {
  return (
    <Recommendations
      user={user}
      onBack={() => navigate("dashboard")}
      onLogout={onLogout}
    />
  );
}
if (currentPage === "storage-monitoring") {
  return (
    <StorageMonitoring
      user={user}
      onBack={() => navigate("dashboard")}
      onLogout={onLogout}
    />
  );
}


  /* ==========================================================
     FRESHNESS ANALYSIS
  ========================================================== */

  if (currentPage === "analysis") {

    return (
      <FreshnessAnalysisPage
        user={user}
        selectedFile={selectedFile}
        imagePreview={imagePreview}
        analysis={analysis}
        analyzing={analyzing}
        error={analysisError}
        onFileChange={handleFileChange}
        onAnalyze={handleAnalyze}
        onClear={clearAnalysis}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }


  /* ==========================================================
     FRESHNESS ANALYTICS
  ========================================================== */

  if (currentPage === "analytics") {

    return (
      <FreshnessAnalyticsPage
        user={user}
        reports={analytics}
        loading={analyticsLoading}
        error={analyticsError}
        search={analyticsSearch}
        setSearch={setAnalyticsSearch}
        filter={analyticsFilter}
        setFilter={setAnalyticsFilter}
        onRefresh={loadFreshnessAnalytics}
        onBack={goDashboard}
        onLogout={onLogout}
      />
    );

  }


  return null;
}


/* ============================================================
   COMMON HEADER
============================================================ */

function PageNavbar({
  user,
  subtitle,
  onBack,
  onLogout
}) {

  return (
    <header className="dashboard-navbar">

      <div className="dashboard-brand">

        <div className="brand-icon">
          🍎
        </div>

        <div>
          <h2>FoodFresh</h2>

          <span>
            {subtitle ||
              "Food Freshness Monitoring"}
          </span>
        </div>

      </div>


      <div className="dashboard-user">
        <NotificationBell />

        <div
          style={{
            textAlign: "right"
          }}
        >

          <strong>
            {user?.name || "User"}
          </strong>

          <span
            className="user-role"
            style={{
              display: "block"
            }}
          >
            {user?.role}
          </span>

        </div>


        {onBack && (

          <button
            className="back-button"
            onClick={onBack}
          >
            ← Back
          </button>

        )}


        <button
          className="logout-btn"
          onClick={onLogout}
        >
          Logout
        </button>

      </div>

    </header>
  );
}


/* ============================================================
   FRESHNESS ANALYSIS PAGE
============================================================ */

function FreshnessAnalysisPage({
  user,
  selectedFile,
  imagePreview,
  analysis,
  analyzing,
  error,
  onFileChange,
  onAnalyze,
  onClear,
  onBack,
  onLogout
}) {

  return (

    <div className="dashboard-page">

      <PageNavbar
        user={user}
        subtitle="AI Food Freshness Analysis"
        onBack={onBack}
        onLogout={onLogout}
      />


      <main className="dashboard-content">

        <section
          style={{
            marginBottom: "28px"
          }}
        >

          <span className="section-label">
            AI FOOD INSPECTION
          </span>

          <h1>
            Food Freshness Analysis
          </h1>

          <p>
            Upload a clear food image to evaluate
            freshness, quality indicators and
            spoilage risk using the AI analysis engine.
          </p>

        </section>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(320px, 0.9fr) minmax(400px, 1.4fr)",
            gap: "24px",
            alignItems: "start"
          }}
        >

          {/* =================================================
              UPLOAD
          ================================================= */}

          <section
            className="dashboard-card"
            style={{
              padding: "28px"
            }}
          >

            <div
              style={{
                fontSize: "42px",
                marginBottom: "10px"
              }}
            >
              📷
            </div>

            <h2>
              Upload Food Image
            </h2>

            <p>
              Use a clear image with the food item
              visible from a good angle.
            </p>


            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "230px",
                marginTop: "20px",
                padding: "25px",
                border: "2px dashed #b8c7ba",
                borderRadius: "18px",
                cursor: "pointer",
                background: "#fafcf9",
                textAlign: "center"
              }}
            >

              {imagePreview ? (

                <img
                  src={imagePreview}
                  alt="Food preview"
                  style={{
                    width: "100%",
                    height: "210px",
                    objectFit: "cover",
                    borderRadius: "14px",
                    marginBottom: "14px"
                  }}
                />

              ) : (

                <>
                  <span
                    style={{
                      fontSize: "45px"
                    }}
                  >
                    ⬆️
                  </span>

                  <strong>
                    Click to choose food image
                  </strong>

                  <small>
                    JPG, JPEG, PNG or WEBP • Max 10 MB
                  </small>
                </>

              )}


              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={onFileChange}
                style={{
                  display: "none"
                }}
              />

            </label>


            {selectedFile && (

              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  background: "#f4f7f4",
                  borderRadius: "12px"
                }}
              >

                <strong>
                  📄 {selectedFile.name}
                </strong>

                <small
                  style={{
                    display: "block",
                    marginTop: "4px"
                  }}
                >
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </small>

              </div>

            )}


            {error && (

              <div
                style={{
                  marginTop: "15px",
                  padding: "13px",
                  borderRadius: "10px",
                  background: "#fff0f0",
                  color: "#a32929"
                }}
              >
                ⚠️ {error}
              </div>

            )}


            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px"
              }}
            >

              <button
                className="primary-btn"
                onClick={onAnalyze}
                disabled={
                  !selectedFile ||
                  analyzing
                }
                style={{
                  flex: 1
                }}
              >

                {analyzing
                  ? "🔄 Analyzing..."
                  : "🔍 Analyze Food"}

              </button>


              {selectedFile && (

                <button
                  className="secondary-btn"
                  onClick={onClear}
                >
                  Clear
                </button>

              )}

            </div>

          </section>


          {/* =================================================
              RESULT
          ================================================= */}

          <section
            className="dashboard-card"
            style={{
              padding: "28px",
              minHeight: "500px"
            }}
          >

            {analyzing && (

              <div
                style={{
                  textAlign: "center",
                  padding: "100px 20px"
                }}
              >

                <div
                  style={{
                    fontSize: "50px"
                  }}
                >
                  🔬
                </div>

                <h2>
                  Analyzing Food...
                </h2>

                <p>
                  The system is checking freshness,
                  color, texture and spoilage indicators.
                </p>

              </div>

            )}


            {!analysis && !analyzing && (

              <div
                style={{
                  textAlign: "center",
                  padding: "100px 20px"
                }}
              >

                <div
                  style={{
                    fontSize: "55px"
                  }}
                >
                  🌱
                </div>

                <h2>
                  Analysis Results
                </h2>

                <p>
                  Upload and analyze a food image
                  to see the detailed freshness report.
                </p>

              </div>

            )}


            {analysis && (

              <AnalysisResult
                analysis={analysis}
              />

            )}

          </section>

        </div>

      </main>

    </div>
  );
}


/* ============================================================
   ANALYSIS RESULT
============================================================ */

function AnalysisResult({
  analysis
}) {

  const report =
    analysis?.report ||
    analysis ||
    {};

  const overall =
    report?.overall_assessment ||
    {};


  const score = Math.max(
    0,
    Math.min(
      100,
      Number(
        overall?.freshness_score ??
        report?.freshness_score ??
        0
      )
    )
  );


  const classification =
    overall?.classification ||
    report?.freshness_classification ||
    report?.classification ||
    overall?.condition ||
    "Unknown";


  const confidence = Math.max(
    0,
    Math.min(
      100,
      Number(
        overall?.confidence ??
        report?.freshness_confidence ??
        report?.confidence ??
        0
      )
    )
  );


  const recommendation =
    overall?.recommendation ||
    report?.recommendation ||
    "Continue monitoring the food item and maintain proper storage conditions.";


  const color =
    report?.color_degradation ||
    report?.color ||
    {};

  const texture =
    report?.surface_texture_changes ||
    report?.texture ||
    {};

  const mold =
    report?.mold_detection ||
    report?.mold ||
    {};

  const bruising =
    report?.bruising_detection ||
    report?.bruising ||
    {};

  const damage =
    report?.physical_damage_detection ||
    report?.physical_damage ||
    {};


  const statusClass =
    getFreshnessStatus(
      classification
    );


  return (

    <div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "28px"
        }}
      >

        <div>

          <span className="section-label">
            AI ASSESSMENT
          </span>

          <h2>
            Freshness Result
          </h2>

          <p>
            Detailed visual quality assessment
            generated from the uploaded image.
          </p>

        </div>


        <span
          style={{
            padding: "9px 15px",
            borderRadius: "30px",
            fontWeight: 700,
            whiteSpace: "nowrap"
          }}
          className={statusClass}
        >
          {classification}
        </span>

      </div>


      {/* SCORE */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "190px 1fr",
          gap: "28px",
          alignItems: "center",
          padding: "24px",
          borderRadius: "18px",
          background: "#f7faf7",
          marginBottom: "25px"
        }}
      >

        <div
          style={{
            width: "155px",
            height: "155px",
            borderRadius: "50%",
            margin: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              `conic-gradient(#3d8b58 ${score * 3.6}deg, #e7ece8 0deg)`
          }}
        >

          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center"
            }}
          >

            <strong
              style={{
                fontSize: "36px"
              }}
            >
              {Math.round(score)}
            </strong>

            <span>
              /100
            </span>

          </div>

        </div>


        <div>

          <h3>
            Overall Freshness Score
          </h3>

          <p>
            The score combines the visual condition
            of the food with the detected freshness
            indicators.
          </p>


          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "15px"
            }}
          >

            <span>
              AI Confidence
            </span>

            <strong>
              {confidence
                ? `${Math.round(confidence)}%`
                : "N/A"}
            </strong>

          </div>


          <div
            style={{
              height: "9px",
              background: "#e4e9e5",
              borderRadius: "20px",
              overflow: "hidden",
              marginTop: "7px"
            }}
          >

            <div
              style={{
                width: `${confidence}%`,
                height: "100%",
                background: "#4c9361"
              }}
            />

          </div>

        </div>

      </div>


      {/* METRICS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0,1fr))",
          gap: "14px"
        }}
      >

        <AnalysisMetric
          icon="🎨"
          title="Color Condition"
          value={
            color?.level ||
            report?.color_level ||
            "Analyzed"
          }
          score={
            color?.score ??
            report?.color_score
          }
        />


        <AnalysisMetric
          icon="🧶"
          title="Surface Texture"
          value={
            texture?.level ||
            report?.texture_level ||
            "Analyzed"
          }
          score={
            texture?.score ??
            report?.texture_score
          }
        />


        <AnalysisMetric
          icon="🦠"
          title="Mold Detection"
          value={
            mold?.level ||
            report?.mold_level ||
            "Analyzed"
          }
          score={
            mold?.score ??
            report?.mold_score
          }
        />


        <AnalysisMetric
          icon="🟤"
          title="Bruising"
          value={
            bruising?.level ||
            report?.bruising_level ||
            "Analyzed"
          }
          score={
            bruising?.score ??
            report?.bruising_score
          }
        />


        <AnalysisMetric
          icon="🔎"
          title="Physical Damage"
          value={
            damage?.level ||
            report?.physical_damage_level ||
            "Analyzed"
          }
          score={
            damage?.score ??
            report?.physical_damage_score
          }
        />

      </div>


      {/* RECOMMENDATION */}

      <div
        style={{
          marginTop: "22px",
          padding: "20px",
          borderRadius: "16px",
          background: "#eef8f0",
          border: "1px solid #d5ead9"
        }}
      >

        <div
          style={{
            fontSize: "25px"
          }}
        >
          💡
        </div>

        <h3>
          Recommendation
        </h3>

        <p>
          {recommendation}
        </p>

      </div>

    </div>
  );
}


/* ============================================================
   ANALYSIS METRIC
============================================================ */

function AnalysisMetric({
  icon,
  title,
  value,
  score
}) {

  return (

    <div
      style={{
        padding: "17px",
        border: "1px solid #e5ebe6",
        borderRadius: "14px",
        display: "flex",
        alignItems: "center",
        gap: "14px"
      }}
    >

      <div
        style={{
          fontSize: "27px"
        }}
      >
        {icon}
      </div>

      <div
        style={{
          flex: 1
        }}
      >

        <small>
          {title}
        </small>

        <strong
          style={{
            display: "block",
            marginTop: "4px"
          }}
        >
          {value}
        </strong>

        {score !== undefined &&
          score !== null && (

            <small>
              Score:{" "}
              {Math.round(
                Number(score)
              )}
            </small>

          )}

      </div>

    </div>
  );
}


/* ============================================================
   FRESHNESS ANALYTICS
============================================================ */

function FreshnessAnalyticsPage({
  user,
  reports,
  loading,
  error,
  search,
  setSearch,
  filter,
  setFilter,
  onRefresh,
  onBack,
  onLogout
}) {

  const safeReports =
    Array.isArray(reports)
      ? reports
      : [];


  /* ==========================================================
     SUMMARY
  ========================================================== */

  const summary =
    useMemo(() => {

      let fresh = 0;
      let good = 0;
      let acceptable = 0;
      let nearSpoilage = 0;
      let spoiled = 0;

      const scores = [];

      safeReports.forEach(
        (report) => {

          const status =
            String(
              report?.freshness_classification ||
              report?.condition ||
              ""
            ).toLowerCase();


          if (
            status.includes("spoiled") ||
            status.includes("unsafe")
          ) {

            spoiled++;

          }

          else if (
            status.includes("near")
          ) {

            nearSpoilage++;

          }

          else if (
            status.includes("acceptable") ||
            status.includes("moderate")
          ) {

            acceptable++;

          }

          else if (
            status.includes("good")
          ) {

            good++;

          }

          else if (
            status.includes("fresh")
          ) {

            fresh++;

          }


          const score =
            Number(
              report?.freshness_score
            );

          if (
            Number.isFinite(score)
          ) {
            scores.push(score);
          }

        }
      );


      const average =
        scores.length
          ? Math.round(
              scores.reduce(
                (a, b) => a + b,
                0
              ) / scores.length
            )
          : 0;


      return {
        fresh,
        good,
        acceptable,
        nearSpoilage,
        spoiled,
        average
      };

    }, [safeReports]);


  /* ==========================================================
     FILTERED REPORTS
  ========================================================== */

  const filteredReports =
    useMemo(() => {

      const query =
        search.trim().toLowerCase();


      return safeReports.filter(
        (report) => {

          const classification =
            String(
              report?.freshness_classification ||
              report?.condition ||
              ""
            );


          const filename =
            String(
              report?.filename ||
              ""
            );


          const matchesSearch =
            !query ||
            filename
              .toLowerCase()
              .includes(query) ||
            classification
              .toLowerCase()
              .includes(query);


          const status =
            classification.toLowerCase();


          let matchesFilter = true;


          if (filter === "Fresh") {

            matchesFilter =
              status.includes("fresh") ||
              status.includes("good");

          }


          if (filter === "Warning") {

            matchesFilter =
              status.includes("moderate") ||
              status.includes("acceptable") ||
              status.includes("near");

          }


          if (filter === "Spoiled") {

            matchesFilter =
              status.includes("spoiled") ||
              status.includes("unsafe");

          }


          return (
            matchesSearch &&
            matchesFilter
          );

        }
      );

    }, [
      safeReports,
      search,
      filter
    ]);


  return (

    <div className="dashboard-page">

      <PageNavbar
        user={user}
        subtitle="Freshness Analytics"
        onBack={onBack}
        onLogout={onLogout}
      />


      <main className="dashboard-content">

        {/* HEADER */}

        <section
          style={{
            marginBottom: "25px"
          }}
        >

          <span className="section-label">
            PLATFORM INSIGHTS
          </span>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "20px",
              alignItems: "end"
            }}
          >

            <div>

              <h1>
                Freshness Analytics
              </h1>

              <p>
                Monitor freshness performance,
                quality distribution and recent
                food analysis results.
              </p>

            </div>


            <button
              className="secondary-btn"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading
                ? "🔄 Refreshing..."
                : "↻ Refresh Data"}
            </button>

          </div>

        </section>


        {error && (

          <div
            style={{
              padding: "14px",
              marginBottom: "20px",
              borderRadius: "12px",
              background: "#fff0f0",
              color: "#a32929"
            }}
          >
            ⚠️ {error}
          </div>

        )}


        {/* =====================================================
            KPI CARDS
        ===================================================== */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0,1fr))",
            gap: "15px",
            marginBottom: "25px"
          }}
        >

          <AnalyticsCard
            icon="📊"
            label="Total Analyses"
            value={safeReports.length}
            hint="Reports"
          />

          <AnalyticsCard
            icon="🌿"
            label="Fresh / Good"
            value={
              summary.fresh +
              summary.good
            }
            hint="Healthy items"
          />

          <AnalyticsCard
            icon="⚠️"
            label="Needs Attention"
            value={
              summary.acceptable +
              summary.nearSpoilage
            }
            hint="Monitor closely"
          />

          <AnalyticsCard
            icon="🛑"
            label="Spoiled / Unsafe"
            value={summary.spoiled}
            hint="Immediate action"
          />

          <AnalyticsCard
            icon="⭐"
            label="Average Score"
            value={
              `${summary.average}/100`
            }
            hint="Overall freshness"
          />

        </section>


        {/* =====================================================
            DISTRIBUTION
        ===================================================== */}

        <section
          className="dashboard-card"
          style={{
            padding: "25px",
            marginBottom: "25px"
          }}
        >

          <span className="section-label">
            QUALITY DISTRIBUTION
          </span>

          <h2>
            Freshness Overview
          </h2>

          <div
            style={{
              marginTop: "20px"
            }}
          >

            <AnalyticsBar
              label="Fresh / Good"
              value={
                summary.fresh +
                summary.good
              }
              total={
                safeReports.length
              }
            />

            <AnalyticsBar
              label="Acceptable / Moderate"
              value={
                summary.acceptable
              }
              total={
                safeReports.length
              }
            />

            <AnalyticsBar
              label="Near Spoilage"
              value={
                summary.nearSpoilage
              }
              total={
                safeReports.length
              }
            />

            <AnalyticsBar
              label="Spoiled / Unsafe"
              value={
                summary.spoiled
              }
              total={
                safeReports.length
              }
            />

          </div>

        </section>


        {/* =====================================================
            REPORT TABLE
        ===================================================== */}

        <section
          className="dashboard-card"
          style={{
            padding: "25px"
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "15px",
              alignItems: "center",
              marginBottom: "20px"
            }}
          >

            <div>

              <span className="section-label">
                ANALYSIS HISTORY
              </span>

              <h2>
                Recent Food Reports
              </h2>

            </div>


            <div
              style={{
                display: "flex",
                gap: "10px"
              }}
            >

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search food..."
                style={{
                  padding: "11px 14px",
                  border: "1px solid #d8e0d9",
                  borderRadius: "10px",
                  minWidth: "190px"
                }}
              />


              <select
                value={filter}
                onChange={(e) =>
                  setFilter(
                    e.target.value
                  )
                }
                style={{
                  padding: "11px 14px",
                  border: "1px solid #d8e0d9",
                  borderRadius: "10px"
                }}
              >

                <option value="All">
                  All
                </option>

                <option value="Fresh">
                  Fresh / Good
                </option>

                <option value="Warning">
                  Needs Attention
                </option>

                <option value="Spoiled">
                  Spoiled
                </option>

              </select>

            </div>

          </div>


          {loading ? (

            <div
              style={{
                textAlign: "center",
                padding: "60px"
              }}
            >
              🔄 Loading reports...
            </div>

          ) : filteredReports.length === 0 ? (

            <div
              style={{
                textAlign: "center",
                padding: "60px"
              }}
            >

              <div
                style={{
                  fontSize: "45px"
                }}
              >
                📭
              </div>

              <h3>
                No reports found
              </h3>

              <p>
                Analyze a food image to start
                building your freshness history.
              </p>

            </div>

          ) : (

            <div
              style={{
                overflowX: "auto"
              }}
            >

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse"
                }}
              >

                <thead>

                  <tr>

                    <th style={tableHead}>
                      Food
                    </th>

                    <th style={tableHead}>
                      Classification
                    </th>

                    <th style={tableHead}>
                      Score
                    </th>

                    <th style={tableHead}>
                      Confidence
                    </th>

                    <th style={tableHead}>
                      Condition
                    </th>

                    <th style={tableHead}>
                      Date
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredReports
                    .slice(0, 20)
                    .map(
                      (
                        report,
                        index
                      ) => (

                        <tr
                          key={
                            report?.id ||
                            index
                          }
                        >

                          <td style={tableCell}>

                            <strong>
                              {report?.filename ||
                                `Food Analysis #${index + 1}`}
                            </strong>

                          </td>


                          <td style={tableCell}>

                            <span
                              className={
                                getFreshnessStatus(
                                  report?.freshness_classification ||
                                  report?.condition
                                )
                              }
                              style={{
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  "20px",
                                fontSize:
                                  "12px",
                                fontWeight: 700
                              }}
                            >

                              {report?.freshness_classification ||
                                report?.condition ||
                                "Unknown"}

                            </span>

                          </td>


                          <td style={tableCell}>

                            <strong>
                              {Number(
                                report?.freshness_score
                              ) || 0}
                              /100
                            </strong>

                          </td>


                          <td style={tableCell}>

                            {Number(
                              report?.freshness_confidence
                            )
                              ? `${Math.round(
                                  Number(
                                    report?.freshness_confidence
                                  )
                                )}%`
                              : "N/A"}

                          </td>


                          <td style={tableCell}>

                            {report?.condition ||
                              "—"}

                          </td>


                          <td style={tableCell}>

                            {formatDate(
                              report?.created_at
                            )}

                          </td>

                        </tr>

                      )
                    )}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}


/* ============================================================
   ANALYTICS CARD
============================================================ */

function AnalyticsCard({
  icon,
  label,
  value,
  hint
}) {

  return (

    <div
      className="dashboard-card"
      style={{
        padding: "19px"
      }}
    >

      <div
        style={{
          fontSize: "27px"
        }}
      >
        {icon}
      </div>

      <small>
        {label}
      </small>

      <strong
        style={{
          display: "block",
          fontSize: "27px",
          marginTop: "5px"
        }}
      >
        {value}
      </strong>

      <span
        style={{
          fontSize: "12px",
          opacity: 0.65
        }}
      >
        {hint}
      </span>

    </div>
  );
}


/* ============================================================
   ANALYTICS BAR
============================================================ */

function AnalyticsBar({
  label,
  value,
  total
}) {

  const percentage =
    total > 0
      ? Math.round(
          (value / total) * 100
        )
      : 0;


  return (

    <div
      style={{
        marginBottom: "18px"
      }}
    >

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "7px"
        }}
      >

        <span>
          {label}
        </span>

        <strong>
          {value} ({percentage}%)
        </strong>

      </div>


      <div
        style={{
          height: "11px",
          background: "#e9eeea",
          borderRadius: "20px",
          overflow: "hidden"
        }}
      >

        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background:
              "#4d8e5d",
            borderRadius: "20px",
            transition:
              "width .4s ease"
          }}
        />

      </div>

    </div>
  );
}


/* ============================================================
   STATUS
============================================================ */

function getFreshnessStatus(
  value
) {

  const text =
    String(value || "")
      .toLowerCase();


  if (
    text.includes("spoiled") ||
    text.includes("unsafe") ||
    text.includes("poor")
  ) {

    return "status-danger";

  }


  if (
    text.includes("near") ||
    text.includes("moderate") ||
    text.includes("acceptable")
  ) {

    return "status-warning";

  }


  if (
    text.includes("fresh") ||
    text.includes("good")
  ) {

    return "status-good";

  }


  return "status-neutral";
}


/* ============================================================
   DATE
============================================================ */

function formatDate(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


/* ============================================================
   TABLE STYLES
============================================================ */

const tableHead = {
  textAlign: "left",
  padding: "13px",
  borderBottom:
    "1px solid #e3e9e4",
  fontSize: "13px"
};


const tableCell = {
  padding: "14px 13px",
  borderBottom:
    "1px solid #edf1ee",
  fontSize: "13px"
};


export default Dashboard;
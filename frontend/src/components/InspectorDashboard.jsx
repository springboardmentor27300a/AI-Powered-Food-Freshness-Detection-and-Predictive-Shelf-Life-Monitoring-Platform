import { useEffect, useState } from "react";
import {
  Microscope,
  Leaf,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";
import {
  getAnalysisHistory,
  getShelfLifeHistory,
  getStorageConditions,
  getInventory,
} from "../api";

const CLASSIFICATION_CONFIG = {
  Fresh: { color: "#22c55e", bg: "#dcfce7" },
  Good: { color: "#84cc16", bg: "#ecfccb" },
  Acceptable: { color: "#eab308", bg: "#fef9c3" },
  "Near Spoilage": { color: "#f97316", bg: "#ffedd5" },
  Spoiled: { color: "#ef4444", bg: "#fee2e2" },
};

/**
 * Food Quality Inspector Dashboard
 *
 * IMPLEMENTATION DECISION:
 * The official M4 specification defines dashboards for Consumer, Retail, Warehouse, and Admin.
 * It does NOT specify a separate Food Quality Inspector dashboard.
 *
 * This implementation reuses the existing M2 Freshness Analysis view, which is the most
 * appropriate existing view for quality inspection work. The M2 view already provides:
 * - Image-based freshness classification
 * - Quality scores and spoilage probability
 * - Visual analysis breakdown (color, texture)
 * - Analysis history with PDF report download
 *
 * This is documented as an implementation decision, not an official requirement.
 */
export default function InspectorDashboard({ session }) {
  const [analyses, setAnalyses] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [storageConditions, setStorageConditions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [analysisData, predData, storageData, invData] = await Promise.all([
        getAnalysisHistory(session.token),
        getShelfLifeHistory(session.token),
        getStorageConditions(session.token),
        getInventory(session.token),
      ]);
      setAnalyses(analysisData);
      setPredictions(predData);
      setStorageConditions(storageData);
      setInventory(invData);
    } catch (err) {
      setError(err.message || "Failed to load inspector dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <div className="state-empty">
        <RefreshCw size={32} className="spinner" />
        <span>Loading quality inspection dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-empty">
        <AlertTriangle size={32} />
        <span>{error}</span>
        <button className="btn-secondary" onClick={refresh}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // Quality metrics
  const totalAnalyses = analyses.length;
  const freshCount = analyses.filter(
    (a) => a.classification === "Fresh" || a.classification === "Good"
  ).length;
  const spoiledCount = analyses.filter(
    (a) => a.classification === "Spoiled" || a.classification === "Near Spoilage"
  ).length;
  const avgQuality =
    totalAnalyses > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.quality_score, 0) / totalAnalyses)
      : null;

  return (
    <div className="dashboard-role">
      <div className="role-header">
        <div>
          <p className="eyebrow">FOOD QUALITY INSPECTOR</p>
          <h1>Quality Monitoring & Inspection</h1>
          <p>Freshness analysis, quality assessment, and storage condition monitoring</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Implementation Decision Notice */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#1e40af",
        }}
      >
        <strong>Implementation Decision:</strong> The official M4 specification does not define a
        separate Food Quality Inspector dashboard. This view reuses the existing M2 Freshness
        Analysis functionality, which is the most appropriate view for quality inspection work.
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Inspections</span>
          <strong className="kpi-value">{totalAnalyses}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Fresh/Good</span>
          <strong className="kpi-value text-success">{freshCount}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Spoiled/Near Spoilage</span>
          <strong className="kpi-value text-danger">{spoiledCount}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Quality Score</span>
          <strong className="kpi-value">{avgQuality !== null ? avgQuality : "—"}</strong>
        </div>
      </div>

      {/* Recent Freshness Analyses */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Recent Freshness Inspections</h2>
            <p>M2 image-based freshness analysis results</p>
          </div>
        </div>
        {analyses.length === 0 ? (
          <div className="state-empty">
            <Microscope size={28} />
            <span>No freshness analyses yet. Use the AI Freshness Detection tab to inspect food items.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {analyses.slice(0, 8).map((a) => {
              const cfg = CLASSIFICATION_CONFIG[a.classification] || CLASSIFICATION_CONFIG["Acceptable"];
              return (
                <div key={a.id} className="dashboard-card">
                  <div className="dashboard-card-icon" style={{ background: cfg.bg, color: cfg.color }}>
                    <Leaf size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong>{a.item_name || "Unknown"}</strong>
                    <span className="history-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      {a.classification}
                    </span>
                  </div>
                  <div className="dashboard-card-meta">
                    <span>Quality: <strong>{a.quality_score}</strong></span>
                    <span>Spoilage: <strong>{(a.spoilage_probability * 100).toFixed(0)}%</strong></span>
                  </div>
                  <span className="history-date">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shelf-Life Predictions for Quality Assessment */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Shelf-Life Quality Assessment</h2>
            <p>M3 predictions for quality monitoring</p>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <Clock size={28} />
            <span>No shelf-life predictions yet. Use the Shelf-Life & Storage tab to run forecasts.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {predictions.slice(0, 5).map((p) => (
              <div key={p.id} className="dashboard-card">
                <div
                  className="dashboard-card-icon"
                  style={{
                    background:
                      p.risk_level === "high" || p.risk_level === "critical"
                        ? "#fee2e2"
                        : "#dcfce7",
                    color:
                      p.risk_level === "high" || p.risk_level === "critical"
                        ? "#991b1b"
                        : "#166534",
                  }}
                >
                  <CheckCircle2 size={18} />
                </div>
                <div className="dashboard-card-info">
                  <strong style={{ textTransform: "capitalize" }}>{p.food_type}</strong>
                  <span className="history-badge" style={{ background: "#edf7ef", color: "#173d2a" }}>
                    {p.remaining_shelf_life_days} days RSL
                  </span>
                </div>
                <div className="dashboard-card-meta">
                  <span>Model: <strong>{p.model_type}</strong></span>
                  <span>Risk: <strong>{p.risk_level}</strong></span>
                </div>
                <span className="history-date">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Storage Conditions for Quality Reference */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Storage Conditions</h2>
            <p>Environmental data for quality assessment reference</p>
          </div>
        </div>
        {storageConditions.length === 0 ? (
          <div className="state-empty">
            <History size={28} />
            <span>No storage condition records yet.</span>
          </div>
        ) : (
          <div className="sc-table-wrapper">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Temp (°C)</th>
                  <th>Humidity (%)</th>
                  <th>Airflow</th>
                  <th>Light</th>
                  <th>Packaging</th>
                </tr>
              </thead>
              <tbody>
                {storageConditions.slice(0, 8).map((sc) => (
                  <tr key={sc.id}>
                    <td className="sc-date">{new Date(sc.observed_at).toLocaleString()}</td>
                    <td className="sc-num">{sc.temperature_c}</td>
                    <td className="sc-num">{sc.humidity_pct}</td>
                    <td>{sc.air_circulation}</td>
                    <td>{sc.light_exposure}</td>
                    <td className="sc-pkg">{sc.packaging_type.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

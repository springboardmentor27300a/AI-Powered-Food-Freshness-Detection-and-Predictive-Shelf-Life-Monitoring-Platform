import { useEffect, useState } from "react";
import {
  Leaf,
  Package,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  History,
  RefreshCw,
} from "lucide-react";
import {
  getAnalysisHistory,
  getShelfLifeHistory,
  getM3Analytics,
  getStorageConditions,
  getInventory,
  getExpiringSoon,
} from "../api";

const RISK_COLORS = {
  low: { color: "#22c55e", bg: "#dcfce7" },
  moderate: { color: "#eab308", bg: "#fef9c3" },
  high: { color: "#f97316", bg: "#ffedd5" },
  critical: { color: "#ef4444", bg: "#fee2e2" },
};

const CLASSIFICATION_CONFIG = {
  Fresh: { color: "#22c55e", bg: "#dcfce7" },
  Good: { color: "#84cc16", bg: "#ecfccb" },
  Acceptable: { color: "#eab308", bg: "#fef9c3" },
  "Near Spoilage": { color: "#f97316", bg: "#ffedd5" },
  Spoiled: { color: "#ef4444", bg: "#fee2e2" },
};

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return { label: "Unknown", className: "badge-neutral" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = expiryDateStr.split("-").map(Number);
  const expiry = new Date(y, m - 1, d);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Expired", className: "badge-expired" };
  if (diffDays === 0) return { label: "Expiring Today", className: "badge-expiring-today" };
  return { label: `${diffDays} days`, className: "badge-valid" };
}

export default function ConsumerDashboard({ session }) {
  const [analyses, setAnalyses] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [storageHistory, setStorageHistory] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [analysisData, predictionData, analyticsData, storageData, invData, soonData] =
        await Promise.all([
          getAnalysisHistory(session.token),
          getShelfLifeHistory(session.token),
          getM3Analytics(session.token),
          getStorageConditions(session.token),
          getInventory(session.token),
          getExpiringSoon(session.token, 7),
        ]);
      setAnalyses(analysisData);
      setPredictions(predictionData);
      setAnalytics(analyticsData);
      setStorageHistory(storageData);
      setInventory(invData);
      setExpiringSoon(soonData);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
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
        <span>Loading your dashboard...</span>
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

  return (
    <div className="dashboard-role">
      <div className="role-header">
        <div>
          <p className="eyebrow">CONSUMER DASHBOARD</p>
          <h1>My Freshness Overview</h1>
          <p>Your food freshness reports, shelf-life estimates, and storage recommendations</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Analyses</span>
          <strong className="kpi-value">{analyses.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Shelf-Life Predictions</span>
          <strong className="kpi-value">{predictions.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Inventory Items</span>
          <strong className="kpi-value">{inventory.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Expiring Soon</span>
          <strong className="kpi-value" style={{ color: expiringSoon.length > 0 ? "#ef4444" : undefined }}>
            {expiringSoon.length}
          </strong>
        </div>
      </div>

      {/* Freshness Reports */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Freshness Reports</h2>
            <p>Your recent freshness analysis results</p>
          </div>
        </div>
        {analyses.length === 0 ? (
          <div className="state-empty">
            <Leaf size={28} />
            <span>No freshness analyses yet. Upload an image to get started.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {analyses.slice(0, 5).map((a) => {
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
                    <span>Confidence: <strong>{(a.confidence * 100).toFixed(0)}%</strong></span>
                  </div>
                  <span className="history-date">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shelf-Life Estimates */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Shelf-Life Estimates</h2>
            <p>ML-predicted remaining shelf life for your items</p>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <Clock size={28} />
            <span>No shelf-life predictions yet. Run a forecast to see estimates.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {predictions.slice(0, 5).map((p) => {
              const riskCfg = RISK_COLORS[p.risk_level] || RISK_COLORS.moderate;
              return (
                <div key={p.id} className="dashboard-card">
                  <div className="dashboard-card-icon" style={{ background: riskCfg.bg, color: riskCfg.color }}>
                    <Clock size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong style={{ textTransform: "capitalize" }}>{p.food_type}</strong>
                    <span className="history-badge" style={{ color: riskCfg.color, background: riskCfg.bg }}>
                      {p.risk_level} risk
                    </span>
                  </div>
                  <div className="dashboard-card-meta">
                    <span>Remaining: <strong>{p.remaining_shelf_life_days} days</strong></span>
                    <span>Expiry: <strong>{p.predicted_expiry_date}</strong></span>
                  </div>
                  <span className="history-date">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Storage Recommendations */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Storage Recommendations</h2>
            <p>AI-generated recommendations from your latest predictions</p>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <CheckCircle2 size={28} />
            <span>No recommendations yet. Run a shelf-life forecast to get recommendations.</span>
          </div>
        ) : (
          <div className="recommendations-list">
            {predictions.slice(0, 3).map((p) => {
              let recs = [];
              try {
                const parsed = JSON.parse(p.recommendations);
                recs = parsed.recommendations || [];
              } catch {
                recs = [];
              }
              return (
                <div key={p.id} className="recommendation-group">
                  <h4 style={{ marginBottom: "8px", textTransform: "capitalize" }}>{p.food_type}</h4>
                  {recs.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#64748b" }}>No specific recommendations.</p>
                  ) : (
                    recs.slice(0, 3).map((r, i) => (
                      <div key={i} className="m3-recommendation">
                        <strong>{r.action}</strong>
                        <span>{r.reason}</span>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Food Inventory Overview */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Food Inventory Overview</h2>
            <p>Your food items and expiry status</p>
          </div>
        </div>
        {inventory.length === 0 ? (
          <div className="state-empty">
            <Package size={28} />
            <span>No inventory items yet. Add items from the Inventory tab.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {inventory.slice(0, 8).map((item) => {
              const expStatus = getExpiryStatus(item.expiry_date);
              return (
                <div key={item.id} className="dashboard-card">
                  <div className="dashboard-card-icon" style={{ background: "#edf7ef", color: "#173d2a" }}>
                    <Package size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong>{item.name}</strong>
                    <span>{item.category} &bull; Batch: <code>{item.batch_number}</code></span>
                  </div>
                  <div className="dashboard-card-meta">
                    <span>Qty: <strong>{item.quantity}</strong></span>
                    <span className={`badge ${expStatus.className}`}>{expStatus.label}</span>
                  </div>
                  <span className="history-date">{item.expiry_date}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

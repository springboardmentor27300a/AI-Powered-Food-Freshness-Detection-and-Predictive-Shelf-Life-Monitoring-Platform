import { useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Leaf,
  Clock,
} from "lucide-react";
import {
  getInventory,
  getShelfLifeHistory,
  getM3Analytics,
  getExpiringSoon,
  getAnalysisHistory,
} from "../api";

const RISK_COLORS = {
  low: { color: "#22c55e", bg: "#dcfce7" },
  moderate: { color: "#eab308", bg: "#fef9c3" },
  high: { color: "#f97316", bg: "#ffedd5" },
  critical: { color: "#ef4444", bg: "#fee2e2" },
};

export default function RetailDashboard({ session }) {
  const [inventory, setInventory] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [invData, predData, analyticsData, soonData, analysisData] = await Promise.all([
        getInventory(session.token),
        getShelfLifeHistory(session.token),
        getM3Analytics(session.token),
        getExpiringSoon(session.token, 7),
        getAnalysisHistory(session.token),
      ]);
      setInventory(invData);
      setPredictions(predData);
      setAnalytics(analyticsData);
      setExpiringSoon(soonData);
      setAnalyses(analysisData);
    } catch (err) {
      setError(err.message || "Failed to load retail dashboard");
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
        <span>Loading retail dashboard...</span>
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

  // Compute shelf-life alerts
  const alerts = [];
  for (const pred of predictions) {
    if (pred.risk_level === "high" || pred.risk_level === "critical") {
      alerts.push({
        type: "high_risk",
        food_type: pred.food_type,
        risk_level: pred.risk_level,
        remaining_days: pred.remaining_shelf_life_days,
        message: `High risk: ${pred.food_type} — ${pred.remaining_shelf_life_days} days remaining`,
      });
    } else if (pred.remaining_shelf_life_days <= 2) {
      alerts.push({
        type: "expiring_soon",
        food_type: pred.food_type,
        risk_level: pred.risk_level,
        remaining_days: pred.remaining_shelf_life_days,
        message: `Expiring soon: ${pred.food_type} — ${pred.remaining_shelf_life_days} days remaining`,
      });
    }
  }

  // Waste reduction insights
  const expiredCount = predictions.filter((p) => p.remaining_shelf_life_days <= 0).length;
  const atRiskCount = predictions.filter((p) => p.remaining_shelf_life_days > 0 && p.remaining_shelf_life_days <= 2).length;
  const totalPredictions = predictions.length;

  // Inventory quality metrics
  const totalItems = inventory.length;
  const inStock = inventory.filter((i) => Number(i.quantity) > 0).length;
  const outOfStock = inventory.filter((i) => Number(i.quantity) === 0).length;

  return (
    <div className="dashboard-role">
      <div className="role-header">
        <div>
          <p className="eyebrow">RETAIL MANAGER DASHBOARD</p>
          <h1>Product Freshness & Inventory</h1>
          <p>Monitor product freshness, inventory quality, and waste reduction</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Products</span>
          <strong className="kpi-value">{totalItems}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">In Stock</span>
          <strong className="kpi-value text-success">{inStock}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Out of Stock</span>
          <strong className="kpi-value text-warning">{outOfStock}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Expiring Soon</span>
          <strong className="kpi-value" style={{ color: expiringSoon.length > 0 ? "#ef4444" : undefined }}>
            {expiringSoon.length}
          </strong>
        </div>
      </div>

      {/* Product Freshness Analytics */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Product Freshness Analytics</h2>
            <p>Freshness scores from your M2 image analyses</p>
          </div>
        </div>
        {analyses.length === 0 ? (
          <div className="state-empty">
            <Leaf size={28} />
            <span>No freshness analyses yet. Upload product images to analyze freshness.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {analyses.slice(0, 5).map((a) => (
              <div key={a.id} className="dashboard-card">
                <div className="dashboard-card-icon" style={{ background: "#edf7ef", color: "#173d2a" }}>
                  <Leaf size={18} />
                </div>
                <div className="dashboard-card-info">
                  <strong>{a.item_name || "Unknown"}</strong>
                  <span>{a.classification}</span>
                </div>
                <div className="dashboard-card-meta">
                  <span>Quality: <strong>{a.quality_score}</strong></span>
                  <span>Spoilage: <strong>{(a.spoilage_probability * 100).toFixed(0)}%</strong></span>
                </div>
                <span className="history-date">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inventory Quality Monitoring */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventory Quality Monitoring</h2>
            <p>Shelf-life predictions and risk levels for your products</p>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <BarChart3 size={28} />
            <span>No shelf-life predictions yet. Run M3 forecasts to monitor quality.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {predictions.slice(0, 5).map((p) => {
              const riskCfg = RISK_COLORS[p.risk_level] || RISK_COLORS.moderate;
              return (
                <div key={p.id} className="dashboard-card">
                  <div className="dashboard-card-icon" style={{ background: riskCfg.bg, color: riskCfg.color }}>
                    <BarChart3 size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong style={{ textTransform: "capitalize" }}>{p.food_type}</strong>
                    <span className="history-badge" style={{ color: riskCfg.color, background: riskCfg.bg }}>
                      {p.risk_level} risk
                    </span>
                  </div>
                  <div className="dashboard-card-meta">
                    <span>Score: <strong>{p.official_freshness_score}</strong></span>
                    <span>Remaining: <strong>{p.remaining_shelf_life_days}d</strong></span>
                  </div>
                  <span className="history-date">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shelf-Life Alerts */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Shelf-Life Alerts</h2>
            <p>Items requiring immediate attention</p>
          </div>
        </div>
        {alerts.length === 0 ? (
          <div className="state-empty">
            <Clock size={28} />
            <span>No active alerts. All items are within safe shelf-life ranges.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {alerts.slice(0, 8).map((alert, i) => {
              const riskCfg = RISK_COLORS[alert.risk_level] || RISK_COLORS.moderate;
              return (
                <div key={i} className="dashboard-card" style={{ borderLeft: `3px solid ${riskCfg.color}` }}>
                  <div className="dashboard-card-icon" style={{ background: riskCfg.bg, color: riskCfg.color }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong style={{ textTransform: "capitalize" }}>{alert.food_type}</strong>
                    <span>{alert.message}</span>
                  </div>
                  <span className="history-date">{alert.remaining_days} days left</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Waste Reduction Insights */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Waste Reduction Insights</h2>
            <p>Track and reduce food waste in your inventory</p>
          </div>
        </div>
        <div className="waste-insights">
          <div className="waste-metric">
            <span className="waste-label">Expired Items</span>
            <strong className="waste-value text-danger">{expiredCount}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">At Risk (≤2 days)</span>
            <strong className="waste-value text-warning">{atRiskCount}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">Total Predictions</span>
            <strong className="waste-value">{totalPredictions}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">Reduction Potential</span>
            <strong className="waste-value text-success">
              {atRiskCount > 0 ? `${atRiskCount} items` : "None"}
            </strong>
          </div>
        </div>
        {expiringSoon.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <h4 style={{ marginBottom: "8px" }}>Items to Prioritize</h4>
            <div className="dashboard-list">
              {expiringSoon.slice(0, 5).map((item) => (
                <div key={item.id} className="dashboard-card">
                  <div className="dashboard-card-icon" style={{ background: "#fee2e2", color: "#991b1b" }}>
                    <TrendingDown size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong>{item.name}</strong>
                    <span>{item.category} &bull; {item.is_expired ? "Expired" : `${item.days_until_expiry} days left`}</span>
                  </div>
                  <span className="history-date">{item.expiry_date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Package,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import {
  getStorageConditions,
  getInventory,
  getShelfLifeHistory,
  getM3Analytics,
} from "../api";

export default function WarehouseDashboard({ session }) {
  const [storageConditions, setStorageConditions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [storageData, invData, predData, analyticsData] = await Promise.all([
        getStorageConditions(session.token),
        getInventory(session.token),
        getShelfLifeHistory(session.token),
        getM3Analytics(session.token),
      ]);
      setStorageConditions(storageData);
      setInventory(invData);
      setPredictions(predData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || "Failed to load warehouse dashboard");
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
        <span>Loading warehouse dashboard...</span>
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

  // Environmental analytics
  const avgTemp =
    storageConditions.length > 0
      ? (storageConditions.reduce((sum, sc) => sum + sc.temperature_c, 0) / storageConditions.length).toFixed(1)
      : null;
  const avgHumidity =
    storageConditions.length > 0
      ? (storageConditions.reduce((sum, sc) => sum + sc.humidity_pct, 0) / storageConditions.length).toFixed(1)
      : null;

  const airCirculationDist = {
    good: storageConditions.filter((sc) => sc.air_circulation === "good").length,
    moderate: storageConditions.filter((sc) => sc.air_circulation === "moderate").length,
    poor: storageConditions.filter((sc) => sc.air_circulation === "poor").length,
  };

  const lightExposureDist = {
    low: storageConditions.filter((sc) => sc.light_exposure === "low").length,
    moderate: storageConditions.filter((sc) => sc.light_exposure === "moderate").length,
    high: storageConditions.filter((sc) => sc.light_exposure === "high").length,
  };

  // Storage compliance
  const compliantCount = predictions.filter((p) => p.storage_compliance === "compliant").length;
  const needsAttentionCount = predictions.filter((p) => p.storage_compliance === "needs_attention").length;

  // Inventory health
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="dashboard-role">
      <div className="role-header">
        <div>
          <p className="eyebrow">WAREHOUSE OPERATOR DASHBOARD</p>
          <h1>Storage & Inventory Operations</h1>
          <p>Monitor storage compliance, inventory health, and environmental conditions</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Storage Records</span>
          <strong className="kpi-value">{storageConditions.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Temperature</span>
          <strong className="kpi-value">{avgTemp !== null ? `${avgTemp}°C` : "—"}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Humidity</span>
          <strong className="kpi-value">{avgHumidity !== null ? `${avgHumidity}%` : "—"}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Inventory Items</span>
          <strong className="kpi-value">{inventory.length}</strong>
        </div>
      </div>

      {/* Storage Compliance Monitoring */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Storage Compliance Monitoring</h2>
            <p>Compliance status from shelf-life predictions</p>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <CheckCircle2 size={28} />
            <span>No storage compliance data yet. Run M3 forecasts to assess compliance.</span>
          </div>
        ) : (
          <div className="waste-insights" style={{ marginBottom: "16px" }}>
            <div className="waste-metric">
              <span className="waste-label">Compliant</span>
              <strong className="waste-value text-success">{compliantCount}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Needs Attention</span>
              <strong className="waste-value text-danger">{needsAttentionCount}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Compliance Rate</span>
              <strong className="waste-value">
                {predictions.length > 0 ? `${Math.round((compliantCount / predictions.length) * 100)}%` : "—"}
              </strong>
            </div>
          </div>
        )}
        {storageConditions.length > 0 && (
          <div className="sc-table-wrapper">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Temp (°C)</th>
                  <th>Humidity (%)</th>
                  <th>Airflow</th>
                  <th>Light</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {storageConditions.slice(0, 10).map((sc) => (
                  <tr key={sc.id}>
                    <td className="sc-date">{new Date(sc.observed_at).toLocaleString()}</td>
                    <td className="sc-num">{sc.temperature_c}</td>
                    <td className="sc-num">{sc.humidity_pct}</td>
                    <td>
                      <span className={`badge ${sc.air_circulation === "good" ? "badge-valid" : sc.air_circulation === "poor" ? "badge-expired" : "badge-expiring-today"}`}>
                        {sc.air_circulation}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${sc.light_exposure === "low" ? "badge-valid" : sc.light_exposure === "high" ? "badge-expired" : "badge-expiring-today"}`}>
                        {sc.light_exposure}
                      </span>
                    </td>
                    <td className="sc-num">{sc.storage_duration_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Inventory Health Tracking */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventory Health Tracking</h2>
            <p>Expiry status and risk levels for all inventory items</p>
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
              const [y, m, d] = (item.expiry_date || "").split("-").map(Number);
              const expiry = y ? new Date(y, m - 1, d) : null;
              const daysUntil = expiry ? Math.round((expiry - today) / (1000 * 60 * 60 * 24)) : null;
              const isExpired = daysUntil !== null && daysUntil < 0;
              const isExpiringSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;

              // Find latest prediction for this item
              const itemPred = predictions.find((p) => p.food_item_id === item.id);
              const riskLevel = itemPred?.risk_level || null;

              return (
                <div key={item.id} className="dashboard-card">
                  <div
                    className="dashboard-card-icon"
                    style={{
                      background: isExpired ? "#fee2e2" : isExpiringSoon ? "#fef9c3" : "#dcfce7",
                      color: isExpired ? "#991b1b" : isExpiringSoon ? "#854d0e" : "#166534",
                    }}
                  >
                    <Package size={18} />
                  </div>
                  <div className="dashboard-card-info">
                    <strong>{item.name}</strong>
                    <span>{item.category} &bull; Batch: <code>{item.batch_number}</code></span>
                  </div>
                  <div className="dashboard-card-meta">
                    <span>Qty: <strong>{item.quantity}</strong></span>
                    {riskLevel && (
                      <span
                        className="history-badge"
                        style={{
                          color: riskLevel === "high" || riskLevel === "critical" ? "#991b1b" : "#166534",
                          background: riskLevel === "high" || riskLevel === "critical" ? "#fee2e2" : "#dcfce7",
                        }}
                      >
                        {riskLevel} risk
                      </span>
                    )}
                  </div>
                  <span className="history-date">
                    {isExpired ? `Expired ${Math.abs(daysUntil)}d ago` : daysUntil !== null ? `${daysUntil}d left` : "No expiry"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Batch Freshness Reports */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Batch Freshness Reports</h2>
            <p>Freshness analysis results from M2 image scans</p>
          </div>
        </div>
        {analytics && analytics.total_predictions > 0 ? (
          <div className="waste-insights">
            <div className="waste-metric">
              <span className="waste-label">Total Predictions</span>
              <strong className="waste-value">{analytics.total_predictions}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Avg Freshness Score</span>
              <strong className="waste-value">
                {analytics.average_freshness_score !== null ? analytics.average_freshness_score : "—"}
              </strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Avg Remaining Life</span>
              <strong className="waste-value">
                {analytics.average_remaining_shelf_life_days !== null
                  ? `${analytics.average_remaining_shelf_life_days} days`
                  : "—"}
              </strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">High Risk Items</span>
              <strong className="waste-value text-danger">{analytics.high_risk_count || 0}</strong>
            </div>
          </div>
        ) : (
          <div className="state-empty">
            <BarChart3 size={28} />
            <span>No batch freshness data yet. Run M3 forecasts to generate reports.</span>
          </div>
        )}
      </section>

      {/* Environmental Analytics */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Environmental Analytics</h2>
            <p>Storage environment conditions across all recorded data</p>
          </div>
        </div>
        {storageConditions.length === 0 ? (
          <div className="state-empty">
            <Thermometer size={28} />
            <span>No environmental data yet. Storage conditions are recorded when you run forecasts.</span>
          </div>
        ) : (
          <div className="environmental-grid">
            <div className="env-card">
              <Thermometer size={20} color="#0369a1" />
              <div>
                <span className="env-label">Avg Temperature</span>
                <strong className="env-value">{avgTemp}°C</strong>
              </div>
            </div>
            <div className="env-card">
              <Droplets size={20} color="#0891b2" />
              <div>
                <span className="env-label">Avg Humidity</span>
                <strong className="env-value">{avgHumidity}%</strong>
              </div>
            </div>
            <div className="env-card">
              <Wind size={20} color="#059669" />
              <div>
                <span className="env-label">Air Circulation</span>
                <strong className="env-value">
                  {airCirculationDist.good > airCirculationDist.moderate && airCirculationDist.good > airCirculationDist.poor
                    ? "Good"
                    : airCirculationDist.poor > airCirculationDist.good
                    ? "Poor"
                    : "Moderate"}
                </strong>
              </div>
            </div>
            <div className="env-card">
              <Sun size={20} color="#d97706" />
              <div>
                <span className="env-label">Light Exposure</span>
                <strong className="env-value">
                  {lightExposureDist.low > lightExposureDist.moderate && lightExposureDist.low > lightExposureDist.high
                    ? "Low"
                    : lightExposureDist.high > lightExposureDist.low
                    ? "High"
                    : "Moderate"}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

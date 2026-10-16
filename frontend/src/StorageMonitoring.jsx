import { useEffect, useState } from "react";
import "./AnalysisUI.css";

import { API } from "./api";

export default function StorageMonitoring({ role }) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const canSaveStorage =
    normalizedRole === "warehouse operator" ||
    normalizedRole === "administrator";
  const [foodType, setFoodType] = useState("Apple");
  const [batchId, setBatchId] = useState("");
  const [temperature, setTemperature] = useState("3");
  const [humidity, setHumidity] = useState("88");
  const [air, setAir] = useState("moderate");
  const [light, setLight] = useState("low");
  const [packaging, setPackaging] = useState("sealed");
  const [duration, setDuration] = useState("0");
  const [overview, setOverview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/storage/overview`);
      if (!response.ok) throw new Error("Unable to load storage overview");
      const data = await response.json();
      setOverview(data);
      setError("");
    } catch (err) {
      setOverview({
        summary: { monitored_locations: 0, average_compliance: null, compliant: 0, needs_attention: 0 },
        latest_readings: [],
      });
      setError("Storage history could not be loaded. You can still enter and analyze a new reading.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData();
    const fields = {
      food_type: foodType,
      temperature,
      humidity,
      air_circulation: air,
      light_exposure: light,
      packaging_type: packaging,
      storage_duration: duration,
      save_reading: true,
    };

    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    if (batchId) form.append("batch_id", batchId);

    try {
      const response = await fetch(`${API}/storage/analyze`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Storage analysis failed");
      setResult(data);
      await loadOverview();
    } catch (err) {
      setError(err.message || "Storage analysis failed");
    } finally {
      setSaving(false);
    }
  };

  const readings = Array.isArray(overview?.latest_readings) ? overview.latest_readings : [];
  const summary = overview?.summary || {};

  return (
    <div className="analysis-page storage-monitoring-page">
      <div className="analysis-head">
        <div>
          <p className="eyebrow">STORAGE CONDITION MONITORING</p>
          <h2>Environmental compliance & optimization</h2>
          <p>
            Record temperature, humidity, air circulation, light exposure, packaging and storage duration.
            FoodTrace validates every reading, stores it for reporting, estimates compliance and feeds dynamic storage alerts.
          </p>
        </div>
      </div>

      {error && <div className="analysis-error">{error}</div>}

      <section className="metric-grid storage-summary">
        <article><span>Monitored</span><strong>{loading ? "…" : (summary.monitored_locations ?? 0)}</strong><em>latest linked readings</em></article>
        <article><span>Average compliance</span><strong>{loading ? "…" : (summary.average_compliance ?? "-")}{summary.average_compliance != null ? "%" : ""}</strong><em>environmental score</em></article>
        <article><span>Compliant</span><strong>{loading ? "…" : (summary.compliant ?? 0)}</strong><em>75% or higher</em></article>
        <article><span>Needs attention</span><strong>{loading ? "…" : (summary.needs_attention ?? 0)}</strong><em>feeds dynamic alerts</em></article>
      </section>

      <form className="analysis-input-card" onSubmit={canSaveStorage ? save : (e) => e.preventDefault()}>
        <div className="panel-title">
          <div>
            <p className="eyebrow">NEW STORAGE READING</p>
            <h3>Enter live or virtual environmental conditions</h3>
          </div>
          <span className="status-pill good">{role}</span>
        </div>

        <div className="storage-input-grid">
          <label><span>Food type</span><input disabled={!canSaveStorage} value={foodType} onChange={(e) => setFoodType(e.target.value)} required /></label>
          <label><span>Batch ID</span><input disabled={!canSaveStorage} type="number" min="1" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Optional" /></label>
          <label><span>Temperature °C</span><input disabled={!canSaveStorage} type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} required /></label>
          <label><span>Humidity %</span><input disabled={!canSaveStorage} type="number" min="0" max="100" step="0.1" value={humidity} onChange={(e) => setHumidity(e.target.value)} required /></label>
          <label><span>Air circulation</span><select disabled={!canSaveStorage} value={air} onChange={(e) => setAir(e.target.value)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
          <label><span>Light exposure</span><select disabled={!canSaveStorage} value={light} onChange={(e) => setLight(e.target.value)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
          <label><span>Packaging</span><select disabled={!canSaveStorage} value={packaging} onChange={(e) => setPackaging(e.target.value)}><option value="sealed">Sealed</option><option value="vacuum">Vacuum</option><option value="ventilated">Ventilated</option></select></label>
          <label><span>Storage duration (days)</span><input disabled={!canSaveStorage} type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} required /></label>
        </div>

        <div className="analysis-submit-row">
          <div><strong>Compliance engine</strong><span> · reading is stored and reused by alerts/reports</span></div>
          {canSaveStorage ? (
            <button type="submit" disabled={saving}>
              {saving ? "Analyzing…" : "Analyze & Save Reading"}
            </button>
          ) : (
            <span className="status-pill good">View only</span>
          )}
        </div>
      </form>

      {result && (
        <section className="analysis-panel">
          <div className="panel-title">
            <div><p className="eyebrow">COMPLIANCE RESULT</p><h3>{result.overall_storage_status || "Storage analysis"}</h3></div>
            <span className={`status-pill ${Number(result.storage_compliance_score || 0) >= 75 ? "good" : "warn"}`}>
              {result.storage_compliance_score ?? 0}% compliant
            </span>
          </div>

          <div className="storage-condition-table">
            {["temperature", "humidity", "air_circulation", "light_exposure"].map((key) => {
              const item = result[key] || {};
              const recommended = Array.isArray(item.recommended) ? item.recommended.join(", ") : (item.recommended || "-");
              const current = item.current ?? "-";
              return (
                <div className="storage-row" key={key}>
                  <span>{key.replaceAll("_", " ")}</span>
                  <strong>{String(current)}{key === "temperature" ? " °C" : key === "humidity" ? "%" : ""}</strong>
                  <span>{recommended}</span>
                  <b className={(item.status === "Optimal" || item.status === "Suitable") ? "ok" : "bad"}>{item.status || "-"}</b>
                </div>
              );
            })}
            <div className="storage-row"><span>Packaging</span><strong>{result.packaging_type || packaging}</strong><span>Recorded with storage reading</span><b className="ok">Recorded</b></div>
            <div className="storage-row"><span>Storage duration</span><strong>{result.storage_duration_days ?? duration} days</strong><span>Used in freshness/shelf-life context</span><b className="ok">Recorded</b></div>
          </div>

          <div className="recommend-grid">
            <article className="overall-action">
              <span>Storage optimization recommendations</span>
              <strong>{Array.isArray(result.recommendations) && result.recommendations.length ? result.recommendations.join(" ") : "Maintain current recommended storage conditions."}</strong>
            </article>
          </div>
        </section>
      )}

      <section className="analysis-panel">
        <p className="eyebrow">RECENT ENVIRONMENTAL READINGS</p>
        <h3>Storage monitoring history</h3>
        {loading ? (
          <p className="storage-empty-note">Loading stored readings…</p>
        ) : readings.length === 0 ? (
          <p className="storage-empty-note">No storage readings have been saved yet. Use the form above to create the first reading; it will then appear in alerts and the Storage Compliance Report.</p>
        ) : (
          <div className="storage-history-table">
            <div className="storage-history-row header"><span>Batch / Food</span><span>Temp</span><span>Humidity</span><span>Air</span><span>Light</span><span>Compliance</span></div>
            {readings.map((reading) => (
              <div className="storage-history-row" key={reading.id}>
                <span>{reading.batch_id ? `Batch #${reading.batch_id} · ${reading.food_type}` : reading.food_type}</span>
                <span>{reading.temperature}°C</span>
                <span>{reading.humidity}%</span>
                <span>{reading.air_circulation}</span>
                <span>{reading.light_exposure}</span>
                <strong>{reading.compliance_score}%</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

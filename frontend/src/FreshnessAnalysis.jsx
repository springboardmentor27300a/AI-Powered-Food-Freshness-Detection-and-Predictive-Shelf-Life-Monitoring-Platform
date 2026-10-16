import { useEffect, useMemo, useState } from "react";
import "./AnalysisUI.css";

import { API } from "./api";
import AssessmentHistory from "./AssessmentHistory";

function FreshnessAnalysis({ user }) {
  const [foodType, setFoodType] = useState("Apple");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [storageMode, setStorageMode] = useState("recommended");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [airCirculation, setAirCirculation] = useState("moderate");
  const [lightExposure, setLightExposure] = useState("low");
  const [packagingType, setPackagingType] = useState("sealed");
  const [storageDuration, setStorageDuration] = useState("0");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/batches`).then(r => r.ok ? r.json() : []).then(v => setBatches(Array.isArray(v) ? v : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!image) { setImagePreview(""); return; }
    const url = URL.createObjectURL(image); setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const analyze = async (e) => {
    e?.preventDefault();
    if (!foodType.trim() || !image) { setError("Select a food image and enter the food type."); return; }
    if (storageMode === "monitored" && (temperature === "" || humidity === "")) {
      setError("Enter temperature and humidity for monitored storage."); return;
    }
    setLoading(true); setError(""); setData(null);
    const form = new FormData();
    form.append("food_type", foodType.trim()); form.append("image", image, image.name);
    if (selectedBatchId) form.append("batch_id", selectedBatchId);
    form.append("prediction_mode", storageMode); form.append("packaging_type", packagingType);
    form.append("storage_duration", String(Number(storageDuration || 0)));
    form.append("air_circulation", airCirculation); form.append("light_exposure", lightExposure);
    if (storageMode === "monitored") { form.append("temperature", temperature); form.append("humidity", humidity); }
    try {
      const response = await fetch(`${API}/assessments/complete`, { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(Array.isArray(json.detail) ? json.detail.map(x => x.msg).join(", ") : json.detail || "Assessment failed");
      setData(json);
      const used = json.conditions_used || {};
      setTemperature(String(used.temperature ?? "")); setHumidity(String(used.humidity ?? ""));
      setAirCirculation(used.air_circulation || "moderate"); setLightExposure(used.light_exposure || "low");
    } catch (err) { setError(err.message || "Cannot connect to FoodTrace analysis services."); }
    finally { setLoading(false); }
  };

  const visual = data?.visual_analysis || {};
  const shelf = data?.shelf_life || {};
  const storage = data?.storage || {};
  const recs = data?.recommendations || {};
  const score = visual?.freshness_analysis?.freshness_score;
  const finalStatus = visual?.final_assessment?.final_classification || visual?.classification?.quality_classification || "-";

  const trend = useMemo(() => {
    const total = Math.max(1, Number(shelf.remaining_shelf_life_days || 0));
    const steps = Math.min(total, 12);

    return Array.from({ length: steps + 1 }, (_, i) => {
      const day = Math.round((total / steps) * i);
      const remaining = Math.max(total - day, 0);
      const x = 70 + (i / Math.max(steps, 1)) * 860;
      const y = 35 + (1 - remaining / total) * 155;
      return { day, remaining, x, y };
    });
  }, [shelf.remaining_shelf_life_days]);

  const trendPolyline = trend.map((point) => `${point.x},${point.y}`).join(" ");
  const trendTotalDays = Math.max(0, Number(shelf.remaining_shelf_life_days || 0));

  const download = (kind) => {
    if (!data?.assessment_id) return;
    window.open(`${API}/reports/assessment/${data.assessment_id}/${kind}`, "_blank");
  };

  const finding = (obj, preferred = []) => {
    if (!obj || typeof obj !== "object") return "Not available";
    for (const key of preferred) if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
    const pair = Object.entries(obj).find(([,v]) => ["string","number","boolean"].includes(typeof v));
    return pair ? String(pair[1]) : "Analysis recorded";
  };

  const recText = (value) => Array.isArray(value) ? value.join(" ") : value || "No action required.";

  return (
    <div className="analysis-page">
      <div className="analysis-head">
        <div><p className="eyebrow">COMPLETE FRESHNESS ASSESSMENT</p><h2>Image-to-decision freshness intelligence</h2><p>Analyze visual quality, storage compliance, remaining shelf life, spoilage risk and actionable recommendations in one workflow.</p></div>
        <div className="analysis-head-actions">
          <AssessmentHistory />

          {data?.assessment_id && (
            <div className="report-actions">
              <button onClick={() => download("pdf")}>
                Download PDF Report
              </button>

              <button
                className="secondary"
                onClick={() => download("excel")}
              >
                Download Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <form className="analysis-input-card" onSubmit={analyze}>
        <div className="analysis-input-grid">
          <label><span>Food type</span><input value={foodType} onChange={e => setFoodType(e.target.value)} placeholder="Apple" /></label>
          <label><span>Inventory batch (optional)</span><select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}><option value="">Not linked</option>{batches.map(b => <option value={b.id} key={b.id}>Batch #{b.id} · Food item {b.food_item_id}</option>)}</select></label>
          <label><span>Storage mode</span><select value={storageMode} onChange={e => setStorageMode(e.target.value)}><option value="recommended">Recommended baseline</option><option value="monitored">Recorded / monitored conditions</option></select></label>
          <label><span>Packaging</span><select value={packagingType} onChange={e => setPackagingType(e.target.value)}><option value="sealed">Sealed</option><option value="vacuum">Vacuum</option><option value="ventilated">Ventilated</option></select></label>
          <label><span>Storage duration (days)</span><input type="number" min="0" value={storageDuration} onChange={e => setStorageDuration(e.target.value)} /></label>
          <label className="image-field"><span>Food image</span><input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} /></label>
        </div>

        {storageMode === "monitored" && <div className="storage-input-grid">
          <label><span>Temperature (°C)</span><input type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} /></label>
          <label><span>Humidity (%)</span><input type="number" step="0.1" value={humidity} onChange={e => setHumidity(e.target.value)} /></label>
          <label><span>Air circulation</span><select value={airCirculation} onChange={e => setAirCirculation(e.target.value)}><option>low</option><option>moderate</option><option>high</option></select></label>
          <label><span>Light exposure</span><select value={lightExposure} onChange={e => setLightExposure(e.target.value)}><option>low</option><option>moderate</option><option>high</option></select></label>
        </div>}

        <div className="analysis-submit-row"><div>{imagePreview && <img src={imagePreview} className="analysis-thumb" alt="Selected food" />}{image && <span>{image.name}</span>}</div><button type="submit" disabled={loading}>{loading ? "Running complete analysis..." : "Analyze Freshness & Shelf Life"}</button></div>
        {error && <div className="analysis-error">{error}</div>}
      </form>

      {data && <div className="analysis-results">
        <section className="metric-grid">
          <article><span>Freshness score</span><strong>{Number(score ?? 0).toFixed(2)}%</strong><em>{finalStatus}</em></article>
          <article><span>Remaining shelf life</span><strong>{shelf.remaining_shelf_life_days ?? "-"} days</strong><em>at assessment</em></article>
          <article><span>Predicted expiry</span><strong>{shelf.predicted_expiry_date || "-"}</strong><em>storage-adjusted forecast</em></article>
          <article><span>Spoilage risk</span><strong>{shelf.spoilage_risk || "-"}</strong><em>{shelf.spoilage_probability ?? "-"}% probability</em></article>
          <article><span>Storage compliance</span><strong>{storage.storage_compliance_score ?? "-"}%</strong><em>{storage.overall_storage_status || "-"}</em></article>
          <article><span>Overall food health</span><strong>{data.overall_health_score ?? "-"}%</strong><em>weighted FoodTrace score</em></article>
        </section>

        <section className="analysis-panel">
          <div className="panel-title"><div><p className="eyebrow">VISUAL FRESHNESS ANALYSIS</p><h3>What the image shows</h3></div>{imagePreview && <img src={imagePreview} className="result-image" alt="Analyzed food" />}</div>
          <div className="finding-grid">
            <article><span>Color degradation</span><strong>{finding(visual.color_analysis,["color_degradation","status","condition"])}</strong></article>
            <article><span>Texture change</span><strong>{finding(visual.texture_analysis,["texture_change","status","condition"])}</strong></article>
            <article><span>Mold detection</span><strong>{finding(visual.mold_analysis,["mold_detected","status"])}</strong></article>
            <article><span>Bruising</span><strong>{finding(visual.bruising_analysis,["bruising_detected","status"])}</strong></article>
            <article><span>Physical damage</span><strong>{finding(visual.physical_damage_analysis,["physical_damage_detected","status"])}</strong></article>
            <article><span>Final assessment</span><strong>{finalStatus}</strong></article>
          </div>
        </section>

        <section className="analysis-panel">
          <div className="panel-title"><div><p className="eyebrow">STORAGE MONITORING</p><h3>Environmental compliance & shelf-life impact</h3></div><span className={`status-pill ${Number(storage.storage_compliance_score || 0) >= 75 ? "good" : "warn"}`}>{storage.overall_storage_status}</span></div>
          <div className="storage-condition-table">
            {["temperature","humidity","air_circulation","light_exposure"].map(key => {
              const item = storage[key] || {};
              return <div className="storage-row" key={key}><span>{key.replaceAll("_"," ")}</span><strong>{String(item.current ?? "-")}{key==="temperature"?" °C":key==="humidity"?"%":""}</strong><span>{Array.isArray(item.recommended)?item.recommended.join(", "):item.recommended || "-"}</span><b className={(item.status==="Optimal"||item.status==="Suitable")?"ok":"bad"}>{item.status || "-"}</b></div>;
            })}
            <div className="storage-row"><span>Packaging</span><strong>{packagingType}</strong><span>{shelf?.packaging?.status || "Included in prediction"}</span><b className="ok">Recorded</b></div>
            <div className="storage-row"><span>Storage duration</span><strong>{storageDuration} days</strong><span>Applied to shelf-life estimate</span><b className="ok">Recorded</b></div>
          </div>
          <div className="storage-impact-grid">
            <article><span>Temperature factor</span><strong>{shelf?.storage_impact?.temperature_factor ?? "-"}</strong></article>
            <article><span>Humidity factor</span><strong>{shelf?.storage_impact?.humidity_factor ?? "-"}</strong></article>
            <article><span>Air circulation</span><strong>{shelf?.storage_impact?.air_circulation_status ?? "-"}</strong></article>
            <article><span>Light exposure</span><strong>{shelf?.storage_impact?.light_exposure_status ?? "-"}</strong></article>
            <article><span>Packaging factor</span><strong>{shelf?.storage_impact?.packaging_factor ?? "-"}</strong></article>
          </div>
        </section>

        <section className="analysis-panel shelf-trend-panel">
          <div className="trend-heading-row">
            <div>
              <p className="eyebrow">SHELF-LIFE TREND</p>
              <h3>Projected remaining shelf life</h3>
              <p className="trend-subtitle">Expected day-by-day decline from this assessment to the predicted expiry date.</p>
            </div>
            <div className="trend-summary-badge"><strong>{trendTotalDays}</strong><span>days at assessment</span></div>
          </div>

          <div className="svg-trend-chart">
            <svg viewBox="0 0 1000 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Remaining shelf life decreases from assessment day to predicted expiry">
              {[35, 74, 113, 152, 190].map((y) => (
                <line key={y} x1="70" y1={y} x2="930" y2={y} className="trend-gridline" />
              ))}
              <line x1="70" y1="35" x2="70" y2="190" className="trend-axis" />
              <line x1="70" y1="190" x2="930" y2="190" className="trend-axis" />
              <polyline points={trendPolyline} className="trend-polyline" fill="none" />
              {trend.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r="4.3" className="trend-dot">
                  <title>{`Day ${point.day}: ${point.remaining} day(s) left`}</title>
                </circle>
              ))}
              <text x="20" y="40" className="trend-svg-label">{trendTotalDays}d</text>
              <text x="40" y="194" className="trend-svg-label">0d</text>
              <text x="70" y="216" className="trend-svg-caption">Assessment day</text>
              <text x="930" y="216" textAnchor="end" className="trend-svg-caption">Predicted expiry · {shelf.predicted_expiry_date || "-"}</text>
            </svg>
          </div>
        </section>

        <section className="analysis-panel">
          <p className="eyebrow">RECOMMENDATION ENGINE</p><h3>Actions generated from freshness, shelf life & storage</h3>
          <div className="recommend-grid">
            <article><span>Storage recommendation</span><strong>{recText(recs.storage_recommendations)}</strong></article>
            <article><span>Consumption recommendation</span><strong>{recText(recs.consumption_recommendations)}</strong></article>
            <article><span>Inventory rotation</span><strong>{shelf.remaining_shelf_life_days <= 2 ? "Use this batch first under FEFO rotation." : shelf.remaining_shelf_life_days <= 7 ? "Move this batch ahead of later-expiring stock." : "Continue FEFO rotation based on effective expiry."}</strong></article>
            <article><span>Waste reduction</span><strong>{recText(recs.waste_reduction_recommendations)}</strong></article>
            <article><span>Quality improvement</span><strong>{recText(recs.quality_improvement_recommendations)}</strong></article>
            <article className="overall-action"><span>Overall action</span><strong>{recs.overall_action || "Continue monitoring"}</strong></article>
          </div>
        </section>

        <section className="analysis-panel report-ready">
          <div><p className="eyebrow">PROFESSIONAL REPORT READY</p><h3>Individual Freshness Analysis Report</h3><p>The downloadable report includes visual findings, current storage conditions, compliance, shelf-life forecast, spoilage risk, recommendations and final conclusion.</p></div>
          <div className="report-actions"><button onClick={() => download("pdf")}>Download PDF</button><button className="secondary" onClick={() => download("excel")}>Download Excel</button></div>
        </section>
      </div>}
    </div>
  );
}

export default FreshnessAnalysis;

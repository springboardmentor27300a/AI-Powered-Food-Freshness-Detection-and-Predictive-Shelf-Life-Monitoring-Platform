import { useEffect, useState } from "react";
import { AlertTriangle, Camera, FileText, Microscope, RefreshCw, Upload } from "lucide-react";
import {
  analyzeM2Image,
  assessM2Defect,
  downloadM2AssessmentReport,
  getM2AnalysisHistory,
  getM2AnalysisTrends,
} from "../api";

const CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy Products",
  "Meat & Poultry",
  "Seafood",
  "Bakery Products",
  "Packaged Foods",
  "Beverages",
];

const FRESHNESS_LEVELS = ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"];
const DEFECTS = [
  ["mold", "Mold"],
  ["bruising", "Bruising"],
  ["physical_damage", "Physical damage"],
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Unknown date";
}

export default function M2FreshnessAnalysisView({ session }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subtype, setSubtype] = useState("");
  const [itemName, setItemName] = useState("");
  const [targetSurface, setTargetSurface] = useState("food_surface");
  const [result, setResult] = useState(null);
  const [defectResult, setDefectResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [pendingReport, setPendingReport] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const refreshHistory = async () => {
    try {
      const [historyResult, trendsResult] = await Promise.all([
        getM2AnalysisHistory(session.token),
        getM2AnalysisTrends(session.token),
      ]);
      setHistory(historyResult);
      setTrends(trendsResult);
    } catch (requestError) {
      setError(requestError.message || "Unable to load M2 history and trends.");
    }
  };

  useEffect(() => {
    refreshHistory();
  }, [session.token]);

  const selectFile = (selected) => {
    if (!selected) return;
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
    if (!supportedTypes.includes(selected.type)) {
      setError("Choose a JPEG, PNG, WebP, or BMP image.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Image uploads are limited to 10 MB.");
      return;
    }
    setFile(selected);
    setResult(null);
    setDefectResult(null);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setDefectResult(null);
    try {
      const assessment = await analyzeM2Image(session.token, file, category, subtype, itemName);
      setResult(assessment);
      await refreshHistory();
    } catch (requestError) {
      setError(requestError.message || "M2 image assessment failed.");
    } finally {
      setLoading(false);
    }
  };

  const runDefectWorkflow = async (defectType) => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const assessment = await assessM2Defect(
        session.token,
        file,
        category,
        defectType,
        defectType === "physical_damage" ? targetSurface : undefined,
      );
      setDefectResult(assessment);
    } catch (requestError) {
      setError(requestError.message || "Defect assessment failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (analysisId) => {
    setPendingReport(analysisId);
    setReportError("");
    try {
      await downloadM2AssessmentReport(session.token, analysisId);
    } catch (requestError) {
      setReportError(requestError.message || "Unable to download report.");
    } finally {
      setPendingReport(null);
    }
  };

  const resultFreshness = result?.freshness;

  return (
    <div className="analysis-shell">
      <div className="analysis-grid">
        <section className="panel analysis-upload-panel">
          <div className="panel-head">
            <div>
              <h2>Food Freshness Analysis</h2>
              <p>Category-aware image assessment with explicit model availability.</p>
            </div>
            <div className="panel-badge"><Camera size={16} /> M2</div>
          </div>

          <div className="notice-box warning-box" role="note">
            <AlertTriangle size={18} />
            A photo cannot establish microbiological safety. Color and texture measurements are descriptive; unsupported model or defect workflows return “Not assessed.”
          </div>

          <label className="m2-field">
            Food category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="m2-field">
            Food subtype (optional)
            <input value={subtype} onChange={(event) => setSubtype(event.target.value)} maxLength={120} />
          </label>
          <label className="m2-field">
            Item name (optional)
            <input value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={120} />
          </label>

          <label className="dropzone m2-dropzone">
            {preview ? (
              <img src={preview} alt="Selected food item" className="preview-img" />
            ) : (
              <span className="dropzone-placeholder">
                <Upload size={30} />
                <span>Choose a food image</span>
                <span className="dropzone-hint">JPEG · PNG · WebP · BMP · Max 10 MB</span>
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>

          {error && <div className="notice-box error-box" role="alert">{error}</div>}
          <div className="upload-actions">
            <button className="btn-primary" onClick={analyze} disabled={!file || loading}>
              {loading ? <><RefreshCw size={16} className="spinner" /> Assessing…</> : <><Microscope size={16} /> Assess freshness</>}
            </button>
          </div>

          <div className="m2-defect-workflows">
            <h3>Dedicated defect workflows</h3>
            <p>Each workflow reports its own availability; no unavailable detector is presented as “defect-free.”</p>
            {DEFECTS.map(([key, title]) => (
              <button key={key} className="btn-secondary" onClick={() => runDefectWorkflow(key)} disabled={!file || loading}>
                {title}
              </button>
            ))}
            <label className="m2-field">
              Physical-damage target
              <select value={targetSurface} onChange={(event) => setTargetSurface(event.target.value)}>
                <option value="food_surface">Food surface</option>
                <option value="package">Package / container</option>
              </select>
            </label>
          </div>
        </section>

        <section className="panel analysis-result-panel" aria-live="polite">
          <h2>Assessment result</h2>
          {result ? (
            <div className="m2-result">
              <p><strong>Status:</strong> {result.assessment_status === "assessed" ? "Assessed" : "Not assessed"}</p>
              <p><strong>Category:</strong> {result.category.canonical_category}{result.category.declared_food_subtype ? ` · ${result.category.declared_food_subtype}` : ""}</p>
              <p><strong>Model capability:</strong> {result.category.capability_status}</p>
              <p><strong>Reason:</strong> {resultFreshness.reason}</p>
              {resultFreshness.classification && <p><strong>Freshness level:</strong> {resultFreshness.classification}</p>}
              {resultFreshness.quality_score != null && <p><strong>Quality score:</strong> {resultFreshness.quality_score}/100</p>}
              {resultFreshness.spoilage_probability != null && <p><strong>Visual spoilage probability:</strong> {(resultFreshness.spoilage_probability * 100).toFixed(1)}%</p>}
              {resultFreshness.confidence != null && <p><strong>Model confidence:</strong> {(resultFreshness.confidence * 100).toFixed(1)}%</p>}
              <div>
                <strong>Freshness levels</strong>
                <ul className="m2-levels">{FRESHNESS_LEVELS.map((level) => <li key={level}>{level}</li>)}</ul>
              </div>
              <h3>Descriptive image features</h3>
              <p>Color: {result.visual_analysis.color.dominant_color_hex}; discoloration indicator {result.visual_analysis.color.discoloration_index}</p>
              <p>Texture uniformity: {result.visual_analysis.texture.texture_uniformity}; roughness {result.visual_analysis.texture.surface_roughness}</p>
              <p className="m2-muted">These pixel metrics are not model-based freshness or defect findings.</p>
              <h3>Defects</h3>
              <ul>{result.defects.map((defect) => <li key={defect.defect_type}>{defect.defect_type}: {defect.status.replace("_", " ")} — {defect.reason}</li>)}</ul>
              <p className="m2-safety">{result.safety_notice}</p>
            </div>
          ) : (
            <p>No image assessment yet.</p>
          )}
          {defectResult && (
            <div className="notice-box warning-box m2-defect-result" role="status">
              <strong>{defectResult.defect_type.replace("_", " ")}: not assessed</strong>
              <p>{defectResult.reason}</p>
              <p>{defectResult.capture_guidance}</p>
              {defectResult.target_surface && <p>Target: {defectResult.target_surface.replace("_", " ")}</p>}
            </div>
          )}
          {reportError && <div className="notice-box error-box" role="alert">{reportError}</div>}
        </section>
      </div>

      <section className="panel m2-history">
        <div className="panel-head">
          <div><h2>Freshness history and trends</h2><p>Only assessed model results contribute numeric trend values.</p></div>
          <button className="btn-secondary" onClick={refreshHistory} disabled={loading}>Refresh</button>
        </div>
        <p>
          {trends
            ? `${trends.assessment_count} image assessments · ${trends.assessed_count} model-assessed`
            : "Trend data unavailable."}
        </p>
        {trends?.points?.map((point) => (
          <p key={point.date}>
            {point.date}: {point.assessment_count} assessments ·{" "}
            {point.average_quality_score == null
              ? "quality trend not assessed"
              : `average score ${point.average_quality_score}/100`}
          </p>
        ))}
        {history.length === 0 ? <p>No saved M2 assessments.</p> : (
          <ul className="m2-history-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <span>{formatDate(entry.created_at)} · {entry.category} · {entry.assessment_status.replace("_", " ")}</span>
                <span>{entry.freshness.classification || entry.reason}</span>
                <button
                  className="btn-secondary"
                  onClick={() => downloadReport(entry.id)}
                  disabled={pendingReport === entry.id}
                  aria-label={`Download report for analysis ${entry.id}`}
                >
                  <FileText size={15} /> {pendingReport === entry.id ? "Preparing…" : "PDF report"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

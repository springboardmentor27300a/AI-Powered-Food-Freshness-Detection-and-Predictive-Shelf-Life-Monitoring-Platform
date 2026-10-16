import React, { useEffect, useRef, useState } from "react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { getInventory } from "../api/inventory.js";
import {
  analyzeFreshness,
  getFreshnessHistory,
  getFreshnessAssessmentImageDataUrl,
} from "../api/freshness.js";
import { recordStorageCondition } from "../api/storage.js";
import { getItemAnalysis } from "../api/analysis.js";
import ShelfLifeChart from "../components/ShelfLifeChart.jsx";

// Visual styling for each of the 5 freshness categories.
const CATEGORY_STYLES = {
  fresh: { label: "Fresh", classes: "bg-brand-100 text-brand-700" },
  good: { label: "Good", classes: "bg-emerald-100 text-emerald-700" },
  acceptable: { label: "Acceptable", classes: "bg-amber-100 text-amber-700" },
  near_spoilage: { label: "Near Spoilage", classes: "bg-orange-100 text-orange-700" },
  spoiled: { label: "Spoiled", classes: "bg-red-100 text-red-700" },
};

function FreshnessBadge({ category }) {
  const style = CATEGORY_STYLES[category] || {
    label: category,
    classes: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.classes}`}>
      {style.label}
    </span>
  );
}

function IndicatorPill({ label, active }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {label}: {active ? "Detected" : "Not detected"}
    </span>
  );
}

const RISK_STYLES = {
  Low: "bg-brand-100 text-brand-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-red-100 text-red-700",
};

function RiskBadge({ level }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
        RISK_STYLES[level] || "bg-gray-100 text-gray-600"
      }`}
    >
      {level} Risk
    </span>
  );
}

const COMPLIANCE_STYLES = {
  suitable: { label: "Suitable", classes: "bg-brand-100 text-brand-700" },
  warning: { label: "Warning", classes: "bg-amber-100 text-amber-700" },
  critical: { label: "Critical", classes: "bg-red-100 text-red-700" },
};

function ComplianceBadge({ status }) {
  const style = COMPLIANCE_STYLES[status] || { label: status, classes: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.classes}`}>
      {style.label}
    </span>
  );
}

const ALERT_SEVERITY_STYLES = {
  info: "bg-blue-50 border-blue-200 text-blue-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

const METHOD_LABELS = {
  refrigerated: "Refrigerated",
  frozen: "Frozen",
  room_temperature: "Room temperature",
  unknown: "Unknown",
};

const formatDate = (value) =>
  value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

const formatRange = (range, unit) =>
  range ? `${range[0]}–${range[1]}${unit}` : null;

export default function FreshnessAnalysis() {
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");

  const [selectedItemId, setSelectedItemId] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [latestResult, setLatestResult] = useState(null);

  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // --- Milestone 3 state ---
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [reportImageDataUrl, setReportImageDataUrl] = useState(null);

  // Identifies the most recent item selection. Responses that arrive
  // for an older selection are ignored, so switching items quickly can
  // never leave another item's shelf-life/history on screen.
  const selectionTokenRef = useRef(0);

  const [storageForm, setStorageForm] = useState({
    temperature_celsius: "",
    humidity_percent: "",
    air_circulation: "",
    light_exposure: "",
    packaging_type: "",
  });
  const [storageSubmitting, setStorageSubmitting] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageSuccess, setStorageSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    getInventory()
      .then((data) => {
        if (mounted) setItems(data);
      })
      .catch(() => {
        if (mounted) setItemsError("Could not load your inventory. Please try again.");
      })
      .finally(() => {
        if (mounted) setItemsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadHistory = async (inventoryId, token = selectionTokenRef.current) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await getFreshnessHistory(inventoryId);
      if (token !== selectionTokenRef.current) return; // stale response
      setHistory(data);
    } catch (err) {
      if (token !== selectionTokenRef.current) return;
      setHistoryError("Could not load freshness history for this item.");
    } finally {
      if (token === selectionTokenRef.current) setHistoryLoading(false);
    }
  };

  // Loads the combined shelf-life / health-score / recommendations /
  // alerts bundle for the selected item (Milestone 3).
  const loadAnalysis = async (inventoryId, token = selectionTokenRef.current) => {
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const data = await getItemAnalysis(inventoryId);
      if (token !== selectionTokenRef.current) return; // stale response
      setAnalysisData(data);
    } catch (err) {
      if (token !== selectionTokenRef.current) return;
      setAnalysisData(null);
      setAnalysisError("Could not load shelf-life and recommendation data for this item.");
    } finally {
      if (token === selectionTokenRef.current) setAnalysisLoading(false);
    }
  };

  const handleItemChange = (e) => {
    const id = e.target.value;
    selectionTokenRef.current += 1;
    const token = selectionTokenRef.current;
    setSelectedItemId(id);
    setHistoryLoading(false);
    setAnalysisLoading(false);
    setHistoryError("");
    setLatestResult(null);
    setAnalyzeError("");
    setHistory(null);
    setAnalysisData(null);
    setAnalysisError("");
    setReportImageDataUrl(null);
    setStorageError("");
    setStorageSuccess("");
    if (id) {
      loadHistory(id, token);
      loadAnalysis(id, token);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setAnalyzeError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setAnalyzeError("");

    if (!selectedItemId) {
      setAnalyzeError("Please select an inventory item first.");
      return;
    }
    if (!imageFile) {
      setAnalyzeError("Please choose a photo to analyze.");
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeFreshness(selectedItemId, imageFile);
      setLatestResult(result);
      await loadHistory(selectedItemId);
      await loadAnalysis(selectedItemId);
      try {
        const dataUrl = await getFreshnessAssessmentImageDataUrl(result.id);
        setReportImageDataUrl(dataUrl);
      } catch (imgErr) {
        // Non-fatal: the report/UI still works without the embedded photo.
        setReportImageDataUrl(null);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setAnalyzeError(
        typeof detail === "string"
          ? detail
          : "Could not analyze this image. Please try a different photo."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedItem = items.find((it) => it.id === selectedItemId);

  const handleStorageFormChange = (e) => {
    const { name, value } = e.target;
    setStorageForm((prev) => ({ ...prev, [name]: value }));
    setStorageError("");
  };

  const handleStorageSubmit = async (e) => {
    e.preventDefault();
    setStorageError("");
    setStorageSuccess("");

    if (storageForm.temperature_celsius === "" || storageForm.humidity_percent === "") {
      setStorageError("Please enter both temperature and humidity.");
      return;
    }

    setStorageSubmitting(true);
    try {
      await recordStorageCondition(selectedItemId, {
        temperature_celsius: Number(storageForm.temperature_celsius),
        humidity_percent: Number(storageForm.humidity_percent),
        air_circulation: storageForm.air_circulation || null,
        light_exposure: storageForm.light_exposure || null,
        packaging_type: storageForm.packaging_type || null,
      });
      setStorageSuccess("Storage condition recorded.");
      await loadAnalysis(selectedItemId);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setStorageError(
        typeof detail === "string"
          ? detail
          : "Could not save this storage reading. Please check the values and try again."
      );
    } finally {
      setStorageSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Freshness Analysis">
      {/*
        Print-only styling for the "Download Report" feature below.
        On screen, .print-only is hidden entirely. When printing
        (or "Save as PDF" from the print dialog), everything else on
        the page is hidden and only the #freshness-print-report block
        is shown — so the printed/saved output contains just the
        report, not the dashboard nav, upload form, or buttons.
      */}
      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Food Image Analysis</h2>
        <p className="text-gray-500 text-sm mt-1">
          Upload a photo of a food item to get a heuristic freshness estimate.
        </p>
        <p className="text-xs text-gray-400 mt-1 italic">
          This uses rule-based computer-vision analysis (color, texture, and
          visual spoilage cues) — it is not a trained AI/machine-learning
          model, and should be treated as a rough estimate, not a food-safety
          guarantee.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        {itemsLoading ? (
          <p className="text-sm text-gray-500">Loading your inventory…</p>
        ) : itemsError ? (
          <p className="text-sm text-red-500">{itemsError}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add an item to your inventory first, then come back here to analyze it.
          </p>
        ) : (
          <form onSubmit={handleAnalyze}>
            <div className="mb-4">
              <label
                htmlFor="inventory-item"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Inventory item
              </label>
              <select
                id="inventory-item"
                value={selectedItemId}
                onChange={handleItemChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent bg-white"
              >
                <option value="">Select an item…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.food_name} ({item.category}) — batch {item.batch_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-1">
                Food photo
              </label>
              <input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                JPEG, PNG, or WEBP, up to 5MB.
              </p>
            </div>

            {previewUrl && (
              <div className="mb-4">
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="h-40 rounded-lg border border-gray-200 object-cover"
                />
              </div>
            )}

            {analyzeError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {analyzeError}
              </div>
            )}

            <button
              type="submit"
              disabled={analyzing}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
            >
              {analyzing ? "Analyzing…" : "Analyze Freshness"}
            </button>
          </form>
        )}
      </div>

      {latestResult && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              Latest report{selectedItem ? ` — ${selectedItem.food_name}` : ""}
            </h3>
            <div className="flex items-center gap-3">
              <FreshnessBadge category={latestResult.freshness_category} />
              <button
                type="button"
                onClick={() => window.print()}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-300 rounded-lg px-3 py-1.5 transition"
              >
                Download Report
              </button>
            </div>
          </div>

          {reportImageDataUrl && (
            <div className="mb-5">
              <img
                src={reportImageDataUrl}
                alt="Analyzed food item"
                className="h-40 rounded-lg border border-gray-200 object-cover"
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div>
              <p className="text-xs text-gray-500">Freshness Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestResult.freshness_score}/100
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Spoilage Probability</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(latestResult.spoilage_probability * 100)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Color Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(latestResult.color_analysis.color_score)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Texture Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(latestResult.texture_analysis.texture_score)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <IndicatorPill label="Mold" active={latestResult.mold_detected} />
            <IndicatorPill label="Bruising" active={latestResult.bruising_detected} />
            <IndicatorPill
              label="Physical damage"
              active={latestResult.physical_damage_detected}
            />
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-700 mb-1">Overall assessment</p>
            <p>{latestResult.quality_assessment}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs text-gray-500">
            <p>
              Color degradation level:{" "}
              <span className="font-medium text-gray-700">
                {latestResult.color_analysis.degradation_level}
              </span>
            </p>
            <p>
              Texture change level:{" "}
              <span className="font-medium text-gray-700">
                {latestResult.texture_analysis.texture_change_level}
              </span>
            </p>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {analysisError}
        </div>
      )}

      {analysisLoading && (
        <p className="text-sm text-gray-500 mb-6">Loading shelf-life and recommendation data…</p>
      )}

      {analysisData && (
        <>
          {/* --- Shelf-Life Information --- */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Shelf-Life Information</h3>
            <p className="text-xs text-gray-400 italic mb-4">
              Estimated using transparent, rule-based food-specific rules, the item's
              recorded dates, its storage method, the latest freshness result and the
              latest storage reading — not a trained prediction model, and not a
              food-safety guarantee.
            </p>

            {analysisData.shelf_life.current.is_expired && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-semibold">
                Expired — the recorded expiry date has passed.
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Remaining Shelf Life</p>
                <p className="text-3xl font-bold text-gray-900">
                  {analysisData.shelf_life.current.is_expired
                    ? "Expired"
                    : `${analysisData.shelf_life.current.remaining_shelf_life_days} days`}
                </p>
                {analysisData.shelf_life.current.is_expired && (
                  <p className="text-xs text-gray-500 mt-1">0 days remaining</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Original Expiry (as recorded)</p>
                <p className="text-base font-semibold text-gray-900">
                  {formatDate(analysisData.shelf_life.current.original_expiry_date)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Analysis Date</p>
                <p className="text-base font-semibold text-gray-900">
                  {formatDate(analysisData.shelf_life.current.analysis_date)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  {analysisData.shelf_life.current.is_expired ? "Expired On" : "Forecast Date"}
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {formatDate(analysisData.shelf_life.current.forecasted_expiry_date)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <RiskBadge level={analysisData.shelf_life.current.risk_level} />
              <span className="text-sm text-gray-600">
                {analysisData.shelf_life.current.matched_food_rule
                  ? `Rule used: ${analysisData.shelf_life.current.matched_food_rule}`
                  : "No food-specific rule — recorded dates used"}
                {analysisData.shelf_life.current.storage_method_used
                  ? ` · Storage: ${METHOD_LABELS[analysisData.shelf_life.current.storage_method_used]}`
                  : " · Storage method unknown"}
              </span>
            </div>

            <ul className="list-disc list-inside text-sm text-gray-600 mb-4 space-y-1">
              {analysisData.shelf_life.current.risk_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>

            <details className="mb-6 text-sm text-gray-600">
              <summary className="cursor-pointer font-medium text-gray-700">
                Why this estimate?
              </summary>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {analysisData.shelf_life.current.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </details>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Shelf-Life Trend</p>
              {analysisData.shelf_life.has_sufficient_history ? (
                <ShelfLifeChart
                  points={analysisData.shelf_life.points.map((p) => ({
                    date: p.assessment_date,
                    days: p.remaining_shelf_life_days,
                  }))}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  {analysisData.shelf_life.points.length === 1
                    ? "Only one image analysis exists for this item, so there is not enough history for a meaningful trend. "
                    : "No image analyses exist for this item yet, so there is no trend. "}
                  Analyze this item again later to build a real shelf-life history.
                </p>
              )}
            </div>
          </div>

          {/* --- Storage Conditions --- */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Storage Conditions</h3>

            {analysisData.storage_guidance && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 mb-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-800 mb-2">
                  Recommended storage
                  {analysisData.storage_guidance.rule_label
                    ? ` for ${analysisData.storage_guidance.rule_label}`
                    : ""}
                </p>
                <ul className="space-y-1">
                  <li>
                    <strong>Method:</strong>{" "}
                    {METHOD_LABELS[analysisData.storage_guidance.recommended_method]}
                  </li>
                  {analysisData.storage_guidance.temperature_range_c && (
                    <li>
                      <strong>Temperature:</strong>{" "}
                      {formatRange(analysisData.storage_guidance.temperature_range_c, "°C")}
                    </li>
                  )}
                  {analysisData.storage_guidance.humidity_range_percent && (
                    <li>
                      <strong>Humidity:</strong>{" "}
                      {formatRange(analysisData.storage_guidance.humidity_range_percent, "%")}
                    </li>
                  )}
                  <li><strong>Packaging:</strong> {analysisData.storage_guidance.packaging}</li>
                  <li><strong>Handling:</strong> {analysisData.storage_guidance.handling}</li>
                </ul>
                {analysisData.storage_guidance.comparison_notes.length > 0 && (
                  <ul className="list-disc list-inside mt-3 text-gray-600 space-y-1">
                    {analysisData.storage_guidance.comparison_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-400 italic mt-2">
                  General guidance only; always follow the label and the recorded expiry date.
                </p>
              </div>
            )}

            {analysisData.latest_storage_condition ? (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <ComplianceBadge status={analysisData.latest_storage_condition.compliance_status} />
                <span className="text-sm text-gray-600">
                  {analysisData.latest_storage_condition.temperature_celsius}°C,{" "}
                  {analysisData.latest_storage_condition.humidity_percent}% humidity
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                No storage conditions recorded yet for this item.
              </p>
            )}
            {analysisData.latest_storage_condition && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                {analysisData.latest_storage_condition.compliance_notes}
              </p>
            )}

            <p className="text-xs text-gray-400 italic mb-4">
              There is no automatic sensor connected yet — enter a reading manually below.
            </p>

            <form onSubmit={handleStorageSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="temperature_celsius"
                  value={storageForm.temperature_celsius}
                  onChange={handleStorageFormChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Humidity (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="humidity_percent"
                  value={storageForm.humidity_percent}
                  onChange={handleStorageFormChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="e.g. 85"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Air Circulation (optional)
                </label>
                <input
                  type="text"
                  name="air_circulation"
                  value={storageForm.air_circulation}
                  onChange={handleStorageFormChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="e.g. Good"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Light Exposure (optional)
                </label>
                <input
                  type="text"
                  name="light_exposure"
                  value={storageForm.light_exposure}
                  onChange={handleStorageFormChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="e.g. Low"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Packaging Type (optional)
                </label>
                <input
                  type="text"
                  name="packaging_type"
                  value={storageForm.packaging_type}
                  onChange={handleStorageFormChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="e.g. Sealed carton"
                />
              </div>

              {storageError && (
                <div className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                  {storageError}
                </div>
              )}
              {storageSuccess && (
                <div className="sm:col-span-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-sm px-4 py-3">
                  {storageSuccess}
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={storageSubmitting}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
                >
                  {storageSubmitting ? "Saving…" : "Save Storage Reading"}
                </button>
              </div>
            </form>
          </div>

          {/* --- Overall Food Health Score --- */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Overall Food Health Score</h3>
            <div className="flex items-center gap-6 mb-5">
              <div className="text-4xl font-bold text-gray-900">
                {analysisData.health_score.overall_food_health_score}/100
              </div>
              <p className="text-xs text-gray-500">
                Weighted: Visual Condition 40% · Storage 25% · Shelf-Life 20% · Product Age 15%
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Visual Condition</p>
                <p className="font-semibold text-gray-800">
                  {analysisData.health_score.visual_condition_score}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Storage Conditions</p>
                <p className="font-semibold text-gray-800">
                  {analysisData.health_score.storage_condition_score}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Shelf-Life</p>
                <p className="font-semibold text-gray-800">
                  {analysisData.health_score.shelf_life_score}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Product Age</p>
                <p className="font-semibold text-gray-800">
                  {analysisData.health_score.product_age_score}
                </p>
              </div>
            </div>
          </div>

          {/* --- Recommendations --- */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Recommendations</h3>
            {analysisData.recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">No specific recommendations right now.</p>
            ) : (
              <ul className="space-y-2">
                {analysisData.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-2.5 flex items-start gap-2"
                  >
                    <span className="text-xs uppercase tracking-wide text-brand-600 font-semibold shrink-0">
                      {rec.type.replace("_", " ")}
                    </span>
                    <span>{rec.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* --- Alerts --- */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Alerts</h3>
            {analysisData.alerts.length === 0 ? (
              <p className="text-sm text-gray-500">No active alerts for this item.</p>
            ) : (
              <ul className="space-y-2">
                {analysisData.alerts.map((alert, i) => (
                  <li
                    key={i}
                    className={`text-sm rounded-lg px-4 py-2.5 border ${
                      ALERT_SEVERITY_STYLES[alert.severity] || "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {latestResult && (
        <div id="freshness-print-report" className="print-only">
          <h1>Food Freshness Monitoring Platform</h1>
          <h2>Freshness Analysis Report</h2>

          {reportImageDataUrl && (
            <img
              src={reportImageDataUrl}
              alt="Analyzed food item"
              style={{ maxWidth: "300px", maxHeight: "300px", margin: "12px 0" }}
            />
          )}

          <table>
            <tbody>
              <tr>
                <td><strong>Food item:</strong></td>
                <td>{selectedItem ? selectedItem.food_name : "N/A"}</td>
              </tr>
              <tr>
                <td><strong>Category:</strong></td>
                <td>{selectedItem ? selectedItem.category : "N/A"}</td>
              </tr>
              {selectedItem?.batch_number && (
                <tr>
                  <td><strong>Batch number:</strong></td>
                  <td>{selectedItem.batch_number}</td>
                </tr>
              )}
              <tr>
                <td><strong>Analysis date:</strong></td>
                <td>{new Date(latestResult.created_at).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <h3>Freshness Summary</h3>
          <table>
            <tbody>
              <tr>
                <td><strong>Freshness score:</strong></td>
                <td>{latestResult.freshness_score}/100</td>
              </tr>
              <tr>
                <td><strong>Freshness category:</strong></td>
                <td>{CATEGORY_STYLES[latestResult.freshness_category]?.label || latestResult.freshness_category}</td>
              </tr>
              <tr>
                <td><strong>Spoilage probability:</strong></td>
                <td>{Math.round(latestResult.spoilage_probability * 100)}%</td>
              </tr>
            </tbody>
          </table>

          <h3>Color Analysis</h3>
          <table>
            <tbody>
              <tr>
                <td><strong>Color score:</strong></td>
                <td>{Math.round(latestResult.color_analysis.color_score)}</td>
              </tr>
              <tr>
                <td><strong>Color degradation level:</strong></td>
                <td>{latestResult.color_analysis.degradation_level}</td>
              </tr>
            </tbody>
          </table>

          <h3>Texture Analysis</h3>
          <table>
            <tbody>
              <tr>
                <td><strong>Texture score:</strong></td>
                <td>{Math.round(latestResult.texture_analysis.texture_score)}</td>
              </tr>
              <tr>
                <td><strong>Texture change level:</strong></td>
                <td>{latestResult.texture_analysis.texture_change_level}</td>
              </tr>
            </tbody>
          </table>

          <h3>Spoilage Indicators</h3>
          <table>
            <tbody>
              <tr>
                <td><strong>Mold detection:</strong></td>
                <td>{latestResult.mold_detected ? "Detected" : "Not detected"}</td>
              </tr>
              <tr>
                <td><strong>Bruising detection:</strong></td>
                <td>{latestResult.bruising_detected ? "Detected" : "Not detected"}</td>
              </tr>
              <tr>
                <td><strong>Physical damage detection:</strong></td>
                <td>{latestResult.physical_damage_detected ? "Detected" : "Not detected"}</td>
              </tr>
            </tbody>
          </table>

          <h3>Overall Quality Assessment</h3>
          <p>{latestResult.quality_assessment}</p>

          {analysisData && (
            <>
              <h3>Shelf-Life Information</h3>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Remaining shelf life:</strong></td>
                    <td>
                      {analysisData.shelf_life.current.is_expired
                        ? "Expired (0 days)"
                        : `${analysisData.shelf_life.current.remaining_shelf_life_days} days`}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Original expiry (as recorded):</strong></td>
                    <td>{formatDate(analysisData.shelf_life.current.original_expiry_date)}</td>
                  </tr>
                  <tr>
                    <td><strong>Analysis date:</strong></td>
                    <td>{formatDate(analysisData.shelf_life.current.analysis_date)}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>
                        {analysisData.shelf_life.current.is_expired ? "Expired on:" : "Forecast date:"}
                      </strong>
                    </td>
                    <td>{formatDate(analysisData.shelf_life.current.forecasted_expiry_date)}</td>
                  </tr>
                  <tr>
                    <td><strong>Shelf-life risk:</strong></td>
                    <td>{analysisData.shelf_life.current.risk_level}</td>
                  </tr>
                </tbody>
              </table>

              <h3>Storage Condition</h3>
              {analysisData.latest_storage_condition ? (
                <table>
                  <tbody>
                    <tr>
                      <td><strong>Temperature:</strong></td>
                      <td>{analysisData.latest_storage_condition.temperature_celsius}°C</td>
                    </tr>
                    <tr>
                      <td><strong>Humidity:</strong></td>
                      <td>{analysisData.latest_storage_condition.humidity_percent}%</td>
                    </tr>
                    <tr>
                      <td><strong>Compliance status:</strong></td>
                      <td>{analysisData.latest_storage_condition.compliance_status}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p>No storage readings recorded for this item.</p>
              )}
              {analysisData.storage_guidance && (
                <p>
                  <strong>Recommended storage:</strong>{" "}
                  {METHOD_LABELS[analysisData.storage_guidance.recommended_method]}
                  {analysisData.storage_guidance.temperature_range_c
                    ? `, ${formatRange(analysisData.storage_guidance.temperature_range_c, "°C")}`
                    : ""}
                  {analysisData.storage_guidance.humidity_range_percent
                    ? `, humidity ${formatRange(analysisData.storage_guidance.humidity_range_percent, "%")}`
                    : ""}
                  . {analysisData.storage_guidance.packaging} {analysisData.storage_guidance.handling}
                </p>
              )}

              <h3>Overall Food Health Score</h3>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Overall score:</strong></td>
                    <td>{analysisData.health_score.overall_food_health_score}/100</td>
                  </tr>
                  <tr>
                    <td><strong>Visual condition (40%):</strong></td>
                    <td>{analysisData.health_score.visual_condition_score}</td>
                  </tr>
                  <tr>
                    <td><strong>Storage conditions (25%):</strong></td>
                    <td>{analysisData.health_score.storage_condition_score}</td>
                  </tr>
                  <tr>
                    <td><strong>Shelf-life (20%):</strong></td>
                    <td>{analysisData.health_score.shelf_life_score}</td>
                  </tr>
                  <tr>
                    <td><strong>Product age (15%):</strong></td>
                    <td>{analysisData.health_score.product_age_score}</td>
                  </tr>
                </tbody>
              </table>

              <h3>Recommendations</h3>
              {analysisData.recommendations.length === 0 ? (
                <p>No specific recommendations.</p>
              ) : (
                <ul>
                  {analysisData.recommendations.map((rec, i) => (
                    <li key={i}>{rec.message}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {history && history.total_assessments > 0 && (
            <>
              <h3>Freshness Trend / History</h3>
              <p>
                Trend based on {history.total_assessments} analysis
                {history.total_assessments === 1 ? "" : "es"}:{" "}
                {history.trend_direction.replace("_", " ")}
              </p>
              <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Category</th>
                    <th>Spoilage Prob.</th>
                  </tr>
                </thead>
                <tbody>
                  {history.assessments.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                      <td>{a.freshness_score}/100</td>
                      <td>{CATEGORY_STYLES[a.freshness_category]?.label || a.freshness_category}</td>
                      <td>{Math.round(a.spoilage_probability * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p style={{ marginTop: "24px", fontSize: "12px", fontStyle: "italic" }}>
            This report is generated from heuristic computer-vision analysis and is
            an estimate, not a food-safety guarantee.
          </p>
        </div>
      )}

      {selectedItemId && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            Freshness trend for this item
          </h3>
          {historyLoading ? (
            <p className="text-sm text-gray-500">Loading history…</p>
          ) : historyError ? (
            <p className="text-sm text-red-500">{historyError}</p>
          ) : !history || history.total_assessments === 0 ? (
            <p className="text-sm text-gray-500">
              No previous analyses for this item yet.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Trend based on {history.total_assessments} analysis
                {history.total_assessments === 1 ? "" : "es"}:{" "}
                <span className="font-medium text-gray-800">
                  {history.trend_direction.replace("_", " ")}
                </span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Score</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Spoilage Prob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.assessments.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 border-gray-50">
                        <td className="py-2 pr-4 text-gray-600">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 font-medium text-gray-800">
                          {a.freshness_score}/100
                        </td>
                        <td className="py-2 pr-4">
                          <FreshnessBadge category={a.freshness_category} />
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {Math.round(a.spoilage_probability * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

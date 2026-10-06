import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  downloadReportCsv,
  downloadReportExcel,
  downloadReportPdf,
  getReport,
} from "../api/reports";
import { imageUrl } from "../api/images";
import FreshnessBadge from "../components/FreshnessBadge";
import FreshnessScoreCircle from "../components/FreshnessScoreCircle";
import { friendlyError, friendlyPredictionMessage } from "../utils/errors";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  useEffect(() => {
    getReport(id).then(setReport).catch((err) => setError(friendlyError(err, "Could not load this report.")));
  }, [id]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadReportPdf(report.id, report.report_number);
    } catch (err) {
      setError(friendlyError(err, "PDF download failed. Please try again."));
    } finally {
      setDownloading(false);
    }
  }
 async function handleDownloadExcel() {
  setDownloadingExcel(true);

  try {
    await downloadReportExcel(report.id, report.report_number);
  } catch (err) {
    setError(
      friendlyError(err, "Excel download failed. Please try again.")
    );
  } finally {
    setDownloadingExcel(false);
  }
}
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!report) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/reports" className="text-sm text-brand-700 hover:underline">&larr; All reports</Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{report.report_number}</h1>
            <p className="text-sm text-slate-500">
              {report.food_item_name} &middot; Batch {report.batch_code} &middot; Inspector: {report.inspector_name || "—"}
            </p>
            <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDownloadPdf} disabled={downloading}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">
              {downloading ? "Preparing PDF..." : "Download PDF Report"}
            </button>
            <button
  onClick={() => downloadReportCsv(report.id, report.report_number)}
  className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
>
  CSV
</button>

<button
  onClick={handleDownloadExcel}
  disabled={downloadingExcel}
  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-slate-300"
>
  {downloadingExcel ? "Preparing Excel..." : "Excel"}
</button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-8">
          <FreshnessScoreCircle score={report.freshness_score} size={110} label="Freshness Score" />
          <div>
            <FreshnessBadge category={report.freshness_category} />
            <p className="mt-2 text-sm text-slate-500">Spoilage probability: <b>{report.spoilage_probability_pct}%</b></p>
          </div>
          {report.image && (
            <img src={imageUrl(report.image.url)} alt="Analyzed food"
              className="ml-auto h-28 w-28 rounded-lg border border-slate-200 object-cover" />
          )}
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3 text-center text-sm">
          {[
            ["Visual (40%)", report.visual_component_score],
            ["Storage (25%)", report.storage_component_score],
            ["Shelf Life (20%)", report.shelf_life_component_score],
            ["Product Age (15%)", report.product_age_component_score],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-semibold text-slate-800">{val}</p>
            </div>
          ))}
        </div>

        {report.cnn_prediction && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700">AI Freshness Prediction</h2>
            {report.cnn_prediction.status === "success" ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium capitalize">{report.cnn_prediction.predicted_class}</span>{" "}
                at {(report.cnn_prediction.confidence * 100).toFixed(1)}% confidence
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">{friendlyPredictionMessage(report.cnn_prediction)}</p>
            )}
          </div>
        )}

        {report.visual_analysis && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-slate-700">Visual Analysis (OpenCV)</h2>
            <p className="mt-1 text-sm text-slate-600">{report.visual_analysis.summary}</p>
            <p className="mt-1 text-xs italic text-slate-400">{report.visual_analysis.explanation}</p>
          </div>
        )}

        {report.shelf_life_prediction && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-slate-700">Shelf-Life Estimate</h2>
            <p className="mt-1 text-sm text-slate-600">
              <b>{report.shelf_life_prediction.estimated_days_remaining} day(s)</b> remaining
              (est. expiry {report.shelf_life_prediction.estimated_expiry_date}),
              risk: <b className="capitalize">{report.shelf_life_prediction.risk_level}</b>,
              confidence: {report.shelf_life_prediction.confidence_pct}%
            </p>
          </div>
        )}

        {report.storage_conditions_snapshot && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-slate-700">Storage Conditions</h2>
            <p className="mt-1 text-sm text-slate-600">
              {report.storage_conditions_snapshot.temperature_c}&deg;C,{" "}
              {report.storage_conditions_snapshot.humidity_pct}% humidity at{" "}
              {report.storage_conditions_snapshot.storage_location}
            </p>
          </div>
        )}

        {report.recommendations_snapshot?.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-slate-700">Recommendations</h2>
            <ul className="mt-2 space-y-1.5">
              {report.recommendations_snapshot.map((rec, i) => (
                <li key={i} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium uppercase">{rec.priority}</span>
                  <b>{rec.title}:</b> {rec.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          FoodCare is a monitoring and decision-support tool. This report is not a substitute for professional
          food safety inspection or laboratory testing.
        </p>
      </div>
    </div>
  );
}


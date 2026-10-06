import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import {
  getWasteReductionReport,
  downloadWasteReductionPdf,
  downloadWasteReductionCsv,
  downloadWasteReductionExcel,
} from "../api/reportModules";

import { friendlyError } from "../utils/errors";

export default function WasteReductionReports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    getWasteReductionReport()
      .then(setReport)
      .catch((err) =>
        setError(
          friendlyError(
            err,
            "Could not load waste reduction report."
          )
        )
      );
  }, []);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);

    try {
      await downloadWasteReductionPdf();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Waste reduction PDF download failed."
        )
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloadingCsv(true);

    try {
      await downloadWasteReductionCsv();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Waste reduction CSV download failed."
        )
      );
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true);

    try {
      await downloadWasteReductionExcel();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Waste reduction Excel download failed."
        )
      );
    } finally {
      setDownloadingExcel(false);
    }
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Loading waste reduction report...
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trash2
          className="text-brand-600"
          size={20}
        />

        <h2 className="text-lg font-semibold text-slate-900">
          Waste Reduction Reports
        </h2>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Identify at-risk inventory and recommendations to reduce food waste.
      </p>

      {/* Download Buttons */}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingPdf
            ? "Downloading..."
            : "Download PDF Report"}
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={downloadingCsv}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingCsv
            ? "Downloading..."
            : "CSV"}
        </button>

        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={downloadingExcel}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingExcel
            ? "Downloading..."
            : "Excel"}
        </button>
      </div>

      {/* Summary */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Total Batches
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.total_batches ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            At Risk
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.at_risk_batches ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Near Expiry
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.near_expiry_batches ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Expired
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.expired_batches ?? 0}
          </p>
        </div>
      </div>

      {/* At Risk Batches */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-900">
            At-Risk Inventory
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Batches that may contribute to food waste.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Food
                </th>

                <th className="px-4 py-3">
                  Batch
                </th>

                <th className="px-4 py-3">
                  Quantity
                </th>

                <th className="px-4 py-3">
                  Expiry
                </th>

                <th className="px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(report.items || report.at_risk_items || []).map(
                (item, index) => (
                  <tr
                    key={
                      item.batch_id ||
                      item.id ||
                      index
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.food_name ||
                        item.food_item_name ||
                        item.name ||
                        "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.batch_code || "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.quantity ?? "-"}
                      {item.unit
                        ? ` ${item.unit}`
                        : ""}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.expiry_date || "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.status
                        ? item.status.replace(
                            "_",
                            " "
                          )
                        : "-"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations &&
        report.recommendations.length > 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">
              Waste Reduction Recommendations
            </h3>

            <div className="mt-3 space-y-3">
              {report.recommendations.map(
                (recommendation, index) => (
                  <div
                    key={index}
                    className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                  >
                    {typeof recommendation ===
                    "string"
                      ? recommendation
                      : recommendation.message ||
                        recommendation.description ||
                        JSON.stringify(
                          recommendation
                        )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </div>
  );
}
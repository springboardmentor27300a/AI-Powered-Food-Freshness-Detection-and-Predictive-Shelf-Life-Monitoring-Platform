import React, { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import {
  getInventoryQualityReport,
  downloadInventoryQualityPdf,
  downloadInventoryQualityCsv,
  downloadInventoryQualityExcel,
} from "../api/reportModules";

import { friendlyError } from "../utils/errors";

const STATUS_STYLES = {
  available: "bg-brand-50 text-brand-700 border-brand-200",
  low_stock: "bg-amber-50 text-amber-700 border-amber-200",
  near_expiry: "bg-orange-50 text-orange-700 border-orange-200",
  expired: "bg-red-50 text-red-700 border-red-200",
  out_of_stock: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function InventoryQualityReports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    getInventoryQualityReport()
      .then(setReport)
      .catch((err) =>
        setError(
          friendlyError(err, "Could not load inventory quality report.")
        )
      );
  }, []);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);

    try {
      await downloadInventoryQualityPdf();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Inventory quality PDF download failed."
        )
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloadingCsv(true);

    try {
      await downloadInventoryQualityCsv();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Inventory quality CSV download failed."
        )
      );
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true);

    try {
      await downloadInventoryQualityExcel();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Inventory quality Excel download failed."
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
        Loading inventory quality report...
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardCheck
          className="text-brand-600"
          size={20}
        />

        <h2 className="text-lg font-semibold text-slate-900">
          Inventory Quality Reports
        </h2>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Current inventory quality based on batch quantity, expiry and status.
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
          {downloadingCsv ? "Downloading..." : "CSV"}
        </button>

        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={downloadingExcel}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingExcel ? "Downloading..." : "Excel"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Total", report.total_batches],
          ["Available", report.available_batches],
          ["Low Stock", report.low_stock_batches],
          ["Near Expiry", report.near_expiry_batches],
          ["Expired", report.expired_batches],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-slate-400">
              {label}
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  Category
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
              {report.items.map((item) => (
                <tr key={item.batch_id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {item.food_name}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {item.batch_code}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {item.category}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {item.quantity} {item.unit}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {item.expiry_date}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium capitalize ${
                        STATUS_STYLES[item.status] ||
                        STATUS_STYLES.available
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
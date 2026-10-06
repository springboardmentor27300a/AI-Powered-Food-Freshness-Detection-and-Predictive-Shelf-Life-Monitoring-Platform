import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import {
  getStorageComplianceReport,
  downloadStorageCompliancePdf,
  downloadStorageComplianceCsv,
  downloadStorageComplianceExcel,
} from "../api/reportModules";

import { friendlyError } from "../utils/errors";

export default function StorageComplianceReports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    getStorageComplianceReport()
      .then(setReport)
      .catch((err) =>
        setError(
          friendlyError(
            err,
            "Could not load storage compliance report."
          )
        )
      );
  }, []);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);

    try {
      await downloadStorageCompliancePdf();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Storage compliance PDF download failed."
        )
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloadingCsv(true);

    try {
      await downloadStorageComplianceCsv();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Storage compliance CSV download failed."
        )
      );
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true);

    try {
      await downloadStorageComplianceExcel();
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Storage compliance Excel download failed."
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
        Loading storage compliance report...
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck
          className="text-brand-600"
          size={20}
        />

        <h2 className="text-lg font-semibold text-slate-900">
          Storage Compliance Reports
        </h2>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Monitor storage conditions and identify compliant and non-compliant readings.
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

      {/* Summary Cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Total Readings
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.total_readings ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Compliant
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.compliant_readings ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Non-Compliant
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.non_compliant_readings ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            Compliance
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {report.compliance_percentage ?? 0}%
          </p>
        </div>
      </div>

      {/* Storage Readings */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-900">
            Storage Compliance Details
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Recorded storage conditions and compliance status.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Location
                </th>

                <th className="px-4 py-3">
                  Temperature
                </th>

                <th className="px-4 py-3">
                  Humidity
                </th>

                <th className="px-4 py-3">
                  Compliance
                </th>

                <th className="px-4 py-3">
                  Recorded At
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(report.items || []).map(
                (item, index) => (
                  <tr
                    key={
                      item.id ||
                      item.reading_id ||
                      index
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.storage_location ||
                        item.location ||
                        "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.temperature != null
                        ? `${item.temperature} °C`
                        : "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.humidity != null
                        ? `${item.humidity} %`
                        : "-"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${
                          item.is_compliant
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {item.is_compliant
                          ? "Compliant"
                          : "Non-Compliant"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {item.recorded_at ||
                        item.created_at ||
                        "-"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
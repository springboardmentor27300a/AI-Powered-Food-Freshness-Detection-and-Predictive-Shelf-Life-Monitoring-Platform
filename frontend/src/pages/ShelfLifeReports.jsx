import React, { useEffect, useState } from "react";
import { FileText, Search, Download } from "lucide-react";

import { listFoodItems } from "../api/food";
import { listBatches } from "../api/batches";
import { getShelfLifeHistory } from "../api/shelfLife";

import {
  downloadShelfLifePdf,
  downloadShelfLifeCsv,
  downloadShelfLifeExcel,
} from "../api/reportModules";

import { friendlyError } from "../utils/errors";

const RISK_STYLES = {
  low: "bg-brand-50 text-brand-700 border-brand-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

export default function ShelfLifeReports() {
  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    async function loadFoodItems() {
      try {
        const res = await listFoodItems({ page_size: 100 });
        setFoodItems(res.items || res || []);
      } catch (err) {
        setError(friendlyError(err, "Could not load food items."));
      }
    }

    loadFoodItems();
  }, []);

  useEffect(() => {
    async function loadBatches() {
      if (!selectedFoodItem) {
        setBatches([]);
        setSelectedBatch("");
        setHistory([]);
        return;
      }

      try {
        const res = await listBatches({
          food_item_id: selectedFoodItem,
          page_size: 100,
        });

        setBatches(res.items || res || []);
        setSelectedBatch("");
        setHistory([]);
      } catch (err) {
        setError(friendlyError(err, "Could not load batches."));
      }
    }

    loadBatches();
  }, [selectedFoodItem]);

  useEffect(() => {
    async function loadHistory() {
      if (!selectedBatch) {
        setHistory([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await getShelfLifeHistory(selectedBatch);
        setHistory(data || []);
      } catch (err) {
        setError(
          friendlyError(err, "Could not load shelf-life report data.")
        );
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [selectedBatch]);

  const selectedFood = foodItems.find(
    (food) => String(food.id) === String(selectedFoodItem)
  );

  const selectedBatchData = batches.find(
    (batch) => String(batch.id) === String(selectedBatch)
  );

  const handleDownloadPdf = async () => {
    if (!selectedBatch) return;

    setDownloadingPdf(true);
    setError("");

    try {
      await downloadShelfLifePdf(selectedBatch);
    } catch (err) {
      setError(
        friendlyError(err, "Could not download the shelf-life PDF report.")
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!selectedBatch) return;

    setDownloadingCsv(true);
    setError("");

    try {
      await downloadShelfLifeCsv(selectedBatch);
    } catch (err) {
      setError(
        friendlyError(err, "Could not download the shelf-life CSV report.")
      );
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedBatch) return;

    setDownloadingExcel(true);
    setError("");

    try {
      await downloadShelfLifeExcel(selectedBatch);
    } catch (err) {
      setError(
        friendlyError(err, "Could not download the shelf-life Excel report.")
      );
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <FileText className="text-brand-600" size={20} />

        <h2 className="text-lg font-semibold text-slate-900">
          Shelf-Life Reports
        </h2>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        View shelf-life estimates and prediction history for food batches.
      </p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">
              Food Item
            </label>

            <select
              value={selectedFoodItem}
              onChange={(e) => setSelectedFoodItem(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select food item...</option>

              {foodItems.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">
              Batch
            </label>

            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={!selectedFoodItem}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Select batch...</option>

              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedBatch && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-slate-400" />

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Shelf-Life Report
                </h3>

                <p className="text-xs text-slate-400">
                  {selectedFood?.name || "Food item"} ·{" "}
                  {selectedBatchData?.batch_code || "Batch"}
                </p>
              </div>
            </div>

            {history.length > 0 && !loading && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={14} />

                  {downloadingPdf ? "Downloading..." : "PDF"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={downloadingCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={14} />

                  {downloadingCsv ? "Downloading..." : "CSV"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={14} />

                  {downloadingExcel ? "Downloading..." : "Excel"}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Loading report...
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No shelf-life prediction has been generated for this batch yet.
            </div>
          ) : (
            <>
              <div className="grid gap-4 p-5 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">
                    Latest Remaining
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {history[0].estimated_days_remaining}
                    <span className="ml-1 text-sm font-medium text-slate-400">
                      days
                    </span>
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">
                    Estimated Expiry
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {history[0].estimated_expiry_date}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">
                    Risk Level
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                      RISK_STYLES[history[0].risk_level] ||
                      RISK_STYLES.moderate
                    }`}
                  >
                    {history[0].risk_level}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">
                    Confidence
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {history[0].confidence_pct}%
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Prediction History
                </h3>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">
                          Days Remaining
                        </th>
                        <th className="px-4 py-3">
                          Estimated Expiry
                        </th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Confidence</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {history.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(
                              item.created_at
                            ).toLocaleString()}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.estimated_days_remaining}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {item.estimated_expiry_date}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2 py-1 text-xs font-medium capitalize ${
                                RISK_STYLES[item.risk_level] ||
                                RISK_STYLES.moderate
                              }`}
                            >
                              {item.risk_level}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {item.confidence_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {history[0].explanation && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Calculation Explanation
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {history[0].explanation}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
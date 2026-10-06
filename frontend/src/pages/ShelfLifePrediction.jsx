import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TrendingUp, Clock } from "lucide-react";
import { listFoodItems } from "../api/food";
import { listBatches } from "../api/batches";
import { estimateShelfLife, getShelfLifeHistory } from "../api/shelfLife";
import { useAuth } from "../context/AuthContext";
import { CAN_RUN_PREDICTIONS } from "../constants/roles";
import { friendlyError } from "../utils/errors";

const RISK_STYLES = {
  low: "bg-brand-50 text-brand-700 border-brand-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

export default function ShelfLifePrediction() {
  const { user } = useAuth();
  const canRun = CAN_RUN_PREDICTIONS.includes(user.role);
  const [searchParams] = useSearchParams();

  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(searchParams.get("batch_id") || "");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listFoodItems({ page_size: 100 }).then((res) => setFoodItems(res.items || res));
  }, []);

  useEffect(() => {
    if (!selectedFoodItem) { setBatches([]); return; }
    listBatches({ food_item_id: selectedFoodItem, page_size: 100 }).then((res) => setBatches(res.items || res));
  }, [selectedFoodItem]);

  useEffect(() => {
    if (!selectedBatch) { setHistory([]); return; }
    getShelfLifeHistory(selectedBatch).then(setHistory).catch(() => setHistory([]));
  }, [selectedBatch]);

  async function handleEstimate() {
    setError(""); setBusy(true);
    try {
      await estimateShelfLife(selectedBatch);
      const hist = await getShelfLifeHistory(selectedBatch);
      setHistory(hist);
    } catch (err) {
      setError(friendlyError(err, "Could not generate a shelf-life estimate."));
    } finally {
      setBusy(false);
    }
  }

  const latest = history[0];

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="text-brand-600" size={20} />
        <h2 className="text-lg font-semibold text-slate-900">Shelf Life Prediction</h2>
      </div>
      <p className="text-sm text-slate-500">
        Transparent, factor-based shelf-life estimates for any batch — see docs/SHELF_LIFE_MODEL.md for the method.
      </p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Food item</label>
            <select value={selectedFoodItem} onChange={(e) => { setSelectedFoodItem(e.target.value); setSelectedBatch(""); }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select food item...</option>
              {foodItems.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Batch</label>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={!selectedFoodItem}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
              <option value="">Select batch...</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_code}</option>)}
            </select>
          </div>
        </div>

        {canRun && (
          <button onClick={handleEstimate} disabled={!selectedBatch || busy}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">
            {busy ? "Estimating..." : "Generate Estimate"}
          </button>
        )}
        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>

      {selectedBatch && (
        latest ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
              <p className="text-xs text-slate-400">Estimated Remaining</p>
              <p className="mt-1 text-4xl font-bold text-slate-900">{latest.estimated_days_remaining}<span className="text-base font-medium text-slate-400"> days</span></p>
              <p className="mt-1 text-sm text-slate-500">Est. expiry: {latest.estimated_expiry_date}</p>
              <div className={`mt-4 inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${RISK_STYLES[latest.risk_level] || RISK_STYLES.moderate}`}>
                {latest.risk_level} risk
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400"><span>Confidence</span><span>{latest.confidence_pct}%</span></div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${latest.confidence_pct}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700">How this was calculated</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{latest.explanation}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                {Object.entries(latest.factors || {}).map(([k, v]) => (
                  v === null || v === undefined ? null : (
                    <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-slate-400">{k.replace(/_/g, " ")}</p>
                      <p className="font-medium text-slate-700">{String(v)}</p>
                    </div>
                  )
                ))}
              </div>
            </div>

            {history.length > 1 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock size={15} /> Estimate History
                </div>
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                      <span className="font-medium text-slate-700">{h.estimated_days_remaining} days remaining</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${RISK_STYLES[h.risk_level]}`}>{h.risk_level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No shelf-life estimate yet for this batch. {canRun ? "Click \"Generate Estimate\" above." : "Ask a manager or inspector to generate one."}
          </div>
        )
      )}
    </div>
  );
}

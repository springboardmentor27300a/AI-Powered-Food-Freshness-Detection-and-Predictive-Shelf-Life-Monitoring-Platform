import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb, Package, Utensils, RotateCcw, Recycle, ShieldAlert } from "lucide-react";
import { listFoodItems } from "../api/food";
import { listBatches } from "../api/batches";
import { generateRecommendations, listRecommendations } from "../api/recommendations";
import { useAuth } from "../context/AuthContext";
import { CAN_RUN_PREDICTIONS } from "../constants/roles";
import { friendlyError } from "../utils/errors";

const TYPE_ICONS = {
  storage: Package,
  consumption: Utensils,
  rotation: RotateCcw,
  waste_reduction: Recycle,
  quality_improvement: ShieldAlert,
};

const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function Recommendations() {
  const { user } = useAuth();
  const canGenerate = CAN_RUN_PREDICTIONS.includes(user.role);
  const [searchParams] = useSearchParams();

  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(searchParams.get("batch_id") || "");
  const [recs, setRecs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listFoodItems({ page_size: 100 }).then((res) => setFoodItems(res.items || res));
  }, []);

  useEffect(() => {
    if (!selectedFoodItem) { setBatches([]); return; }
    listBatches({ food_item_id: selectedFoodItem, page_size: 100 }).then((res) => setBatches(res.items || res));
  }, [selectedFoodItem]);

  async function loadRecs() {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const res = await listRecommendations(selectedBatch);
      setRecs(res.items);
    } catch (err) {
      setError(friendlyError(err, "Could not load recommendations."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRecs(); }, [selectedBatch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setError(""); setBusy(true);
    try {
      const items = await generateRecommendations(selectedBatch);
      setRecs(items);
    } catch (err) {
      setError(friendlyError(err, "Could not generate recommendations."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-brand-600" size={20} />
        <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
      </div>
      <p className="text-sm text-slate-500">Storage, consumption, rotation, and quality guidance generated from real batch data.</p>

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
        {canGenerate && (
          <button onClick={handleGenerate} disabled={!selectedBatch || busy}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300">
            {busy ? "Generating..." : "Generate Recommendations"}
          </button>
        )}
        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>

      {selectedBatch && (
        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-slate-400">Loading recommendations...</p>
          ) : recs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No recommendations yet for this batch. {canGenerate ? "Click \"Generate Recommendations\" above." : "Check back later."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recs.map((r) => {
                const Icon = TYPE_ICONS[r.type] || Lightbulb;
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon size={17} />
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${PRIORITY_STYLES[r.priority]}`}>
                        {r.priority}
                      </span>
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-900">{r.title}</h3>
                    <p className="mt-1 text-sm capitalize text-slate-400">{r.type.replace(/_/g, " ")}</p>
                    <p className="mt-2 text-sm text-slate-600">{r.message}</p>
                    <p className="mt-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

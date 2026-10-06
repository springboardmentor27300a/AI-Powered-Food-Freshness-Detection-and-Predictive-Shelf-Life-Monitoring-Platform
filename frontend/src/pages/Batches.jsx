import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBatches } from "../api/batches";
import { listFoodItems } from "../api/food";
import StatusBadge from "../components/StatusBadge";
import { friendlyError } from "../utils/errors";

const STATUS_OPTIONS = ["", "available", "low_stock", "near_expiry", "expired", "out_of_stock"];
const STATUS_LABELS = {
  "": "All statuses", available: "Available", low_stock: "Low Stock",
  near_expiry: "Near Expiry", expired: "Expired", out_of_stock: "Out of Stock",
};

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [foodItemId, setFoodItemId] = useState("");
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 15;

  useEffect(() => {
    listFoodItems({ page_size: 100 }).then((res) => setFoodItems(res.items || res)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: pageSize };
      if (status) params.status = status;
      if (foodItemId) params.food_item_id = foodItemId;
      const res = await listBatches(params);
      setBatches(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(friendlyError(err, "Could not load batches."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, status, foodItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const foodItemMap = useMemo(() => {
    const map = {};
    foodItems.forEach((f) => { map[f.id] = f; });
    return map;
  }, [foodItems]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Batches</h2>
          <p className="text-sm text-slate-500">All tracked batches across your inventory.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={foodItemId} onChange={(e) => { setFoodItemId(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
          <option value="">All food items</option>
          {foodItems.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Batch Code</th>
                <th className="whitespace-nowrap px-4 py-3">Food Item</th>
                <th className="whitespace-nowrap px-4 py-3">Category</th>
                <th className="whitespace-nowrap px-4 py-3">Quantity</th>
                <th className="whitespace-nowrap px-4 py-3">Expiry</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading batches...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No batches found.</td></tr>
              ) : (
                batches.map((b) => {
                  const item = foodItemMap[b.food_item_id];
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link to={`/batches/${b.id}`} className="font-medium text-brand-700 hover:underline">
                          {b.batch_code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item?.name || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-500">
                        {(item?.category || "").replace(/_/g, " ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{b.quantity} {b.unit}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{b.expiry_date}</td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded-md bg-white px-3 py-1.5 shadow-sm disabled:opacity-40">Prev</button>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="rounded-md bg-white px-3 py-1.5 shadow-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

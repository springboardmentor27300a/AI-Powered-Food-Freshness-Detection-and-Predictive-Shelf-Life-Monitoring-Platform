import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getInventory, getInventorySummary } from "../api/inventory";
import { listFoodItems } from "../api/food";
import StatusBadge from "../components/StatusBadge";
import { friendlyError } from "../utils/errors";

export default function InventoryOverview() {
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInventory(100),
      getInventorySummary(),
      listFoodItems({ page_size: 100 }),
    ])
      .then(([inv, sum, items]) => {
        setBatches(inv);
        setSummary(sum);
        setFoodItems(items.items || items);
      })
      .catch((err) => setError(friendlyError(err, "Could not load inventory overview.")))
      .finally(() => setLoading(false));
  }, []);

  const foodItemMap = useMemo(() => {
    const map = {};
    foodItems.forEach((f) => { map[f.id] = f; });
    return map;
  }, [foodItems]);

  return (
    <div className="px-4 py-6 sm:px-6">
      <h2 className="text-lg font-semibold text-slate-900">Inventory Overview</h2>
      <p className="text-sm text-slate-500">A live, expiry-sorted view of every batch on hand.</p>

      {summary && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Food Items", summary.total_food_items],
            ["Batches", summary.total_batches],
            ["Available Qty", summary.total_available_quantity],
            ["Low Stock", summary.low_stock_count],
            ["Near Expiry", summary.near_expiry_count],
            ["Expired", summary.expired_count],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{val}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Batch</th>
                <th className="whitespace-nowrap px-4 py-3">Food Item</th>
                <th className="whitespace-nowrap px-4 py-3">Quantity</th>
                <th className="whitespace-nowrap px-4 py-3">Expiry (soonest first)</th>
                <th className="whitespace-nowrap px-4 py-3">Storage</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No inventory yet.</td></tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/batches/${b.id}`} className="font-medium text-brand-700 hover:underline">{b.batch_code}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{foodItemMap[b.food_item_id]?.name || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{b.quantity} {b.unit}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{b.expiry_date}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{b.storage_location || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={b.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

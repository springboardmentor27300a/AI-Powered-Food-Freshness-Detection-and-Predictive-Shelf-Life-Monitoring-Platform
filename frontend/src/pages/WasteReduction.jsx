import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Recycle, AlertTriangle, XCircle } from "lucide-react";
import { listBatches } from "../api/batches";
import { listFoodItems } from "../api/food";
import { friendlyError } from "../utils/errors";

export default function WasteReduction() {
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listBatches({ status: "near_expiry", page_size: 100 }),
      listBatches({ status: "expired", page_size: 100 }),
      listFoodItems({ page_size: 100 }),
    ])
      .then(([ne, ex, items]) => {
        setNearExpiry(ne.items);
        setExpired(ex.items);
        setFoodItems(items.items || items);
      })
      .catch((err) => setError(friendlyError(err, "Could not load waste-reduction data.")))
      .finally(() => setLoading(false));
  }, []);

  const foodItemMap = useMemo(() => {
    const map = {};
    foodItems.forEach((f) => { map[f.id] = f; });
    return map;
  }, [foodItems]);

  const atRiskQuantity = nearExpiry.reduce((sum, b) => sum + b.quantity, 0);
  const wastedQuantity = expired.reduce((sum, b) => sum + b.quantity, 0);

  function BatchCard({ batch, tone }) {
    const item = foodItemMap[batch.food_item_id];
    const Icon = tone === "expired" ? XCircle : AlertTriangle;
    const styles = tone === "expired"
      ? "border-red-200 bg-red-50"
      : "border-orange-200 bg-orange-50";
    const iconColor = tone === "expired" ? "text-red-600" : "text-orange-600";

    return (
      <div className={`rounded-xl border p-4 ${styles}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} className={iconColor} />
            <p className="font-semibold text-slate-900">{item?.name || "Unknown item"}</p>
          </div>
          <span className="text-xs text-slate-500">{batch.batch_code}</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {batch.quantity} {batch.unit} &middot; expiry {batch.expiry_date}
        </p>
        <div className="mt-3 flex gap-2">
          <Link to={`/batches/${batch.id}`} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            View Batch
          </Link>
          <Link to={`/recommendations?batch_id=${batch.id}`} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            Recommendations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Recycle className="text-brand-600" size={20} />
        <h2 className="text-lg font-semibold text-slate-900">Waste Reduction</h2>
      </div>
      <p className="text-sm text-slate-500">Inventory at risk of becoming waste, straight from your batch data.</p>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-700">Near-Expiry Batches</p>
          <p className="mt-1 text-2xl font-bold text-orange-800">{nearExpiry.length}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-700">At-Risk Quantity</p>
          <p className="mt-1 text-2xl font-bold text-orange-800">{atRiskQuantity}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">Expired Batches</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{expired.length}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">Expired Quantity</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{wastedQuantity}</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Near Expiry — act soon</h3>
            {nearExpiry.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing near expiry right now.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nearExpiry.map((b) => <BatchCard key={b.id} batch={b} tone="near_expiry" />)}
              </div>
            )}
          </div>

          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Expired — remove or write off</h3>
            {expired.length === 0 ? (
              <p className="text-sm text-slate-400">No expired batches on record.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {expired.map((b) => <BatchCard key={b.id} batch={b} tone="expired" />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

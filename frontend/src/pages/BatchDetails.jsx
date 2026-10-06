import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBatch, updateBatch, deleteBatch } from "../api/batches";
import { estimateShelfLife, getLatestShelfLife } from "../api/shelfLife";
import { generateRecommendations, listRecommendations } from "../api/recommendations";
import StatusBadge from "../components/StatusBadge";

export default function BatchDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isInspector = user.role === "quality_inspector";
  const canEditCore = ["retail_manager", "warehouse_operator", "administrator"].includes(user.role);
  const canEditInspection = ["quality_inspector", "administrator"].includes(user.role);
  const canDelete = user.role === "administrator";

  const [batch, setBatch] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [shelfLife, setShelfLife] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [busy, setBusy] = useState(false);

  const canEstimate = ["retail_manager", "warehouse_operator", "quality_inspector", "administrator"].includes(user.role);

  async function load() {
    const b = await getBatch(id);
    setBatch(b);
    setForm(b);
    getLatestShelfLife(id).then(setShelfLife).catch(() => setShelfLife(null));
    listRecommendations(id).then((res) => setRecommendations(res.items)).catch(() => {});
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setError("");
    try {
      const payload = isInspector
        ? { inspection_notes: form.inspection_notes }
        : {
            quantity: Number(form.quantity), unit: form.unit,
            expiry_date: form.expiry_date, storage_location: form.storage_location,
            is_available: form.is_available,
            ...(canEditInspection ? { inspection_notes: form.inspection_notes } : {}),
          };
      await updateBatch(id, payload);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed.");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this batch?")) return;
    await deleteBatch(id);
    navigate("/inventory");
  }

  async function handleEstimateShelfLife() {
    setBusy(true);
    try {
      const result = await estimateShelfLife(id);
      setShelfLife(result);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not estimate shelf life.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateRecommendations() {
    setBusy(true);
    try {
      const recs = await generateRecommendations(id);
      setRecommendations(recs);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate recommendations.");
    } finally {
      setBusy(false);
    }
  }

  if (!batch) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to={`/inventory/${batch.food_item_id}`} className="text-sm text-brand-700 hover:underline">&larr; Back to food item</Link>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{batch.batch_code}</h1>
            <div className="mt-1"><StatusBadge status={batch.status} /></div>
          </div>
          <div className="flex gap-2">
            <Link to={`/upload?batch_id=${batch.id}`}
              className="rounded-md bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
              Upload &amp; Analyze Image
            </Link>
            {(canEditCore || canEditInspection) && !editing && (
              <button onClick={() => setEditing(true)} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">Edit</button>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">Delete</button>
            )}
          </div>
        </div>

        {!editing ? (
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-400">Quantity</dt><dd>{batch.quantity} {batch.unit}</dd></div>
            <div><dt className="text-slate-400">Storage location</dt><dd>{batch.storage_location || "—"}</dd></div>
            <div><dt className="text-slate-400">Received</dt><dd>{batch.received_date || "—"}</dd></div>
            <div><dt className="text-slate-400">Manufactured</dt><dd>{batch.manufacturing_date || "—"}</dd></div>
            <div><dt className="text-slate-400">Expiry date</dt><dd>{batch.expiry_date}</dd></div>
            <div><dt className="text-slate-400">Available</dt><dd>{batch.is_available ? "Yes" : "No"}</dd></div>
            <div className="col-span-2"><dt className="text-slate-400">Inspection notes</dt><dd>{batch.inspection_notes || "No notes yet."}</dd></div>
          </dl>
        ) : (
          <div className="mt-5 space-y-3">
            {canEditCore && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="0" step="any" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  <input value={form.unit} disabled className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400" />
                </div>
                <input type="date" value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input value={form.storage_location || ""} placeholder="Storage location"
                  onChange={(e) => setForm({ ...form, storage_location: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
                  Available
                </label>
              </>
            )}
            {canEditInspection && (
              <textarea placeholder="Inspection notes" value={form.inspection_notes || ""}
                onChange={(e) => setForm({ ...form, inspection_notes: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            )}
            <div className="flex gap-2">
              <button onClick={handleSave} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              <button onClick={() => { setEditing(false); setForm(batch); }} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Shelf-Life Estimate</h2>
          {canEstimate && (
            <button onClick={handleEstimateShelfLife} disabled={busy}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 disabled:opacity-50">
              {busy ? "Working..." : "Re-estimate"}
            </button>
          )}
        </div>
        {shelfLife ? (
          <div className="mt-3 text-sm">
            <p><b>{shelfLife.estimated_days_remaining} day(s)</b> remaining &middot; est. expiry {shelfLife.estimated_expiry_date}</p>
            <p className="mt-1 text-slate-500">
              Risk: <span className="font-medium capitalize">{shelfLife.risk_level}</span> &middot;
              Confidence: {shelfLife.confidence_pct}%
            </p>
            <p className="mt-2 text-xs italic text-slate-400">{shelfLife.explanation}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No shelf-life estimate yet.</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recommendations</h2>
          {canEstimate && (
            <button onClick={handleGenerateRecommendations} disabled={busy}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 disabled:opacity-50">
              {busy ? "Working..." : "Generate"}
            </button>
          )}
        </div>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No recommendations yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {recommendations.map((r) => (
              <li key={r.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium uppercase">{r.priority}</span>
                <b>{r.title}:</b> {r.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

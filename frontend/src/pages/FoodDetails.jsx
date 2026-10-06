import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFoodItem, updateFoodItem, deleteFoodItem } from "../api/food";
import { listBatches, createBatch } from "../api/batches";
import StatusBadge from "../components/StatusBadge";
import { CAN_EDIT_INVENTORY } from "../constants/roles";

const UNITS = ["kg", "g", "l", "ml", "pieces", "packs", "boxes"];

export default function FoodDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT_INVENTORY.includes(user.role);
  const canDelete = user.role === "administrator";
  const canCreateBatch = ["retail_manager", "warehouse_operator", "administrator"].includes(user.role);

  const [item, setItem] = useState(null);
  const [batches, setBatches] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState({ quantity: "", unit: "kg", expiry_date: "", storage_location: "" });
  const [error, setError] = useState("");

  async function load() {
    const foodItem = await getFoodItem(id);
    setItem(foodItem);
    setForm(foodItem);
    const batchData = await listBatches({ food_item_id: id, page_size: 50 });
    setBatches(batchData.items);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    try {
      await updateFoodItem(id, {
        name: form.name, description: form.description,
        storage_location: form.storage_location, is_available: form.is_available,
      });
      setEditing(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed.");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this food item and all its batches?")) return;
    await deleteFoodItem(id);
    navigate("/inventory");
  }

  async function handleCreateBatch(e) {
    e.preventDefault();
    setError("");
    try {
      await createBatch({ ...batchForm, food_item_id: id, quantity: Number(batchForm.quantity) });
      setShowBatchForm(false);
      setBatchForm({ quantity: "", unit: "kg", expiry_date: "", storage_location: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create batch.");
    }
  }

  if (!item) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/inventory" className="text-sm text-brand-700 hover:underline">&larr; Back to inventory</Link>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{item.name}</h1>
                <p className="mt-1 text-sm text-slate-500 capitalize">{item.category.replace("_", " ")}</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(true)} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">Edit</button>
                  {canDelete && (
                    <button onClick={handleDelete} className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">Delete</button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-600">{item.description || "No description provided."}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-400">Storage location</dt><dd>{item.storage_location || "—"}</dd></div>
              <div><dt className="text-slate-400">Available</dt><dd>{item.is_available ? "Yes" : "No"}</dd></div>
            </dl>
          </>
        ) : (
          <div className="space-y-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input value={form.storage_location || ""} onChange={(e) => setForm({ ...form, storage_location: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
              Available
            </label>
            <div className="flex gap-2">
              <button onClick={handleSave} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              <button onClick={() => { setEditing(false); setForm(item); }} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">Batches</h2>
        {canCreateBatch && (
          <button onClick={() => setShowBatchForm((s) => !s)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {showBatchForm ? "Cancel" : "+ Add Batch"}
          </button>
        )}
      </div>

      {showBatchForm && (
        <form onSubmit={handleCreateBatch} className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required type="number" min="0" step="any" placeholder="Quantity" value={batchForm.quantity}
              onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select value={batchForm.unit} onChange={(e) => setBatchForm({ ...batchForm, unit: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input required type="date" value={batchForm.expiry_date}
              onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Storage location" value={batchForm.storage_location}
              onChange={(e) => setBatchForm({ ...batchForm, storage_location: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save Batch
          </button>
        </form>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Batch Code</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/batches/${b.id}`} className="font-medium text-brand-700 hover:underline">{b.batch_code}</Link>
                </td>
                <td className="px-4 py-3">{b.quantity} {b.unit}</td>
                <td className="px-4 py-3">{b.expiry_date}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No batches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

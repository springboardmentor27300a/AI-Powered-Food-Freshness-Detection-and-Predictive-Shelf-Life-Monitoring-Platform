import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listFoodItems, createFoodItem } from "../api/food";
import { CAN_EDIT_INVENTORY } from "../constants/roles";

const CATEGORIES = [
  "fruits", "vegetables", "dairy_products", "meat_poultry",
  "seafood", "bakery_products", "packaged_foods", "beverages",
];

const CATEGORY_LABELS = {
  fruits: "Fruits", vegetables: "Vegetables", dairy_products: "Dairy Products",
  meat_poultry: "Meat & Poultry", seafood: "Seafood", bakery_products: "Bakery Products",
  packaged_foods: "Packaged Foods", beverages: "Beverages",
};

export default function Inventory() {
  const { user } = useAuth();
  const canEdit = CAN_EDIT_INVENTORY.includes(user.role);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [newItem, setNewItem] = useState({ name: "", category: "fruits", description: "", storage_location: "" });

  const pageSize = 10;

  async function load() {
    const params = { page, page_size: pageSize };
    if (search) params.search = search;
    if (category) params.category = category;
    const data = await listFoodItems(params);
    setItems(data.items);
    setTotal(data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    try {
      await createFoodItem(newItem);
      setShowForm(false);
      setNewItem({ name: "", category: "fruits", description: "", storage_location: "" });
      load();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Could not create food item.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Food Items</h2>
          <p className="text-sm text-slate-500">Your food item catalog, by category.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            {showForm ? "Cancel" : "+ Add Food Item"}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {formError && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Name" value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <input placeholder="Storage location" value={newItem.storage_location}
              onChange={(e) => setNewItem({ ...newItem, storage_location: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Description" value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save Item
          </button>
        </form>
      )}

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Search food items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Storage</th>
              <th className="px-4 py-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/inventory/${item.id}`} className="font-medium text-brand-700 hover:underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[item.category] || item.category}</td>
                <td className="px-4 py-3 text-slate-600">{item.storage_location || "—"}</td>
                <td className="px-4 py-3">
                  <span className={item.is_available ? "text-brand-700" : "text-slate-400"}>
                    {item.is_available ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No food items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Page {page} of {totalPages} ({total} items)</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

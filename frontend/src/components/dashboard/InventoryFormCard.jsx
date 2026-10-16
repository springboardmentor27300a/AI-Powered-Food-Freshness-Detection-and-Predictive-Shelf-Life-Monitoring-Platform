import React, { useEffect, useState } from "react";
import { createInventory, updateInventory } from "../../api/inventory.js";
import { Card, ErrorBanner, inputCls } from "./ui.jsx";

export const CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy Products",
  "Meat & Poultry",
  "Seafood",
  "Bakery Products",
  "Packaged Foods",
  "Beverages",
];

const emptyForm = {
  food_name: "",
  category: "",
  batch_number: "",
  quantity: "",
  purchase_date: "",
  expiry_date: "",
  storage_location: "",
};

// Add / edit form for a food item. Same fields, validation and API calls
// (createInventory / updateInventory) as the original Retail dashboard form.
// `editingItem` null => add mode. `onSaved(item, wasEdit)` lets the page update its list.
export default function InventoryFormCard({ editingItem, onSaved, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setForm(
      editingItem
        ? {
            food_name: editingItem.food_name,
            category: editingItem.category,
            batch_number: editingItem.batch_number,
            quantity: String(editingItem.quantity),
            purchase_date: editingItem.purchase_date,
            expiry_date: editingItem.expiry_date,
            storage_location: editingItem.storage_location || "",
          }
        : emptyForm
    );
  }, [editingItem]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.food_name || !form.category || !form.batch_number || !form.quantity || !form.purchase_date || !form.expiry_date) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.expiry_date < form.purchase_date) {
      setError("Expiry date must be on or after purchase date.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        food_name: form.food_name,
        category: form.category,
        batch_number: form.batch_number,
        quantity: Number(form.quantity),
        purchase_date: form.purchase_date,
        expiry_date: form.expiry_date,
        storage_location: form.storage_location || null,
      };
      if (editingItem) {
        const updated = await updateInventory(editingItem.id, payload);
        onSaved(updated, true);
      } else {
        const created = await createInventory(payload);
        onSaved(created, false);
        setForm(emptyForm);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        detail
          ? Array.isArray(detail)
            ? detail.map((d) => d.msg).join(", ")
            : String(detail)
          : "Unable to save food item."
      );
    } finally {
      setSaving(false);
    }
  }

  const field = (label, name, props = {}) => (
    <div className={props.wide ? "md:col-span-2" : ""}>
      <label htmlFor={`inv-${name}`} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {props.options ? (
        <select id={`inv-${name}`} name={name} value={form[name]} onChange={handleChange} className={`${inputCls} w-full`}>
          <option value="">Select category</option>
          {props.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`inv-${name}`}
          name={name}
          type={props.type || "text"}
          min={props.min}
          value={form[name]}
          onChange={handleChange}
          placeholder={props.placeholder}
          className={`${inputCls} w-full`}
        />
      )}
    </div>
  );

  return (
    <Card
      id="register-item"
      title={editingItem ? "Edit Food Item" : "Register Food Item"}
      subtitle="Add food products to your inventory for freshness monitoring."
      right={
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
          {editingItem ? "Cancel Edit" : "Close"}
        </button>
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field("Food Name *", "food_name", { placeholder: "Example: Apple" })}
        {field("Category *", "category", { options: CATEGORIES })}
        {field("Batch Number *", "batch_number", { placeholder: "Example: APL-001" })}
        {field("Quantity *", "quantity", { type: "number", min: "1", placeholder: "Example: 20" })}
        {field("Purchase Date *", "purchase_date", { type: "date" })}
        {field("Expiry Date *", "expiry_date", { type: "date" })}
        {field("Storage Location", "storage_location", { wide: true, placeholder: "Example: Refrigerator" })}
        <div className="md:col-span-2 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-600 px-5 py-2.5 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : editingItem ? "Update Food Item" : "Register Food Item"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

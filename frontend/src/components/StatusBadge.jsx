import React from "react";

const STYLES = {
  available: "bg-brand-50 text-brand-700 border-brand-500/30",
  low_stock: "bg-amber-50 text-amber-700 border-amber-500/30",
  near_expiry: "bg-orange-50 text-orange-700 border-orange-500/30",
  expired: "bg-red-50 text-red-700 border-red-500/30",
  out_of_stock: "bg-slate-100 text-slate-600 border-slate-300",
};

const LABELS = {
  available: "Available",
  low_stock: "Low Stock",
  near_expiry: "Near Expiry",
  expired: "Expired",
  out_of_stock: "Out of Stock",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status] || STYLES.available}`}>
      {LABELS[status] || status}
    </span>
  );
}

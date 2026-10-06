import React from "react";

const STYLES = {
  fresh: "bg-brand-50 text-brand-700 border-brand-500/30",
  good: "bg-lime-50 text-lime-700 border-lime-500/30",
  acceptable: "bg-amber-50 text-amber-700 border-amber-500/30",
  near_spoilage: "bg-orange-50 text-orange-700 border-orange-500/30",
  spoiled: "bg-red-50 text-red-700 border-red-500/30",
};

const LABELS = {
  fresh: "Fresh",
  good: "Good",
  acceptable: "Acceptable",
  near_spoilage: "Near Spoilage",
  spoiled: "Spoiled",
};

export default function FreshnessBadge({ category }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[category] || STYLES.acceptable}`}>
      {LABELS[category] || category}
    </span>
  );
}

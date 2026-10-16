// Shared status / risk helpers for the four role dashboards.
// Everything here is derived from REAL inventory dates and the real
// per-item analysis returned by GET /api/inventory/{id}/analysis.
// Nothing is invented: when an item has no analysis, statuses fall back
// to the recorded dates only.

export const SOON_DAYS = 7; // "near expiry" window (matches the shelf-life risk bands)

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  return Math.round((d - today) / 86400000);
}

export function formatDate(value, withYear = true) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Pill colour classes (text on tinted background, all >= 4.5:1 contrast).
export const PILL = {
  green: "bg-green-100 text-green-900",
  emerald: "bg-emerald-100 text-emerald-900",
  amber: "bg-amber-100 text-amber-900",
  orange: "bg-orange-100 text-orange-900",
  red: "bg-red-100 text-red-900",
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-900",
};

export const RISK_PILL = { Low: PILL.green, Medium: PILL.amber, High: PILL.red };

export const COMPLIANCE_PILL = {
  suitable: { label: "Suitable", cls: PILL.green },
  warning: { label: "Warning", cls: PILL.amber },
  critical: { label: "Critical", cls: PILL.red },
};

export const METHOD_LABELS = {
  refrigerated: "Refrigerated",
  frozen: "Frozen",
  room_temperature: "Room temperature",
  unknown: "Unknown",
};

// Estimated remaining days for an item (analysis first, dates as fallback).
export function remainingDays(item, analysis) {
  if (analysis) return analysis.shelf_life.current.remaining_shelf_life_days;
  const d = daysUntil(item.expiry_date);
  return d === null ? null : Math.max(d, 0);
}

export function isExpired(item, analysis) {
  if (analysis) return analysis.shelf_life.current.is_expired;
  const d = daysUntil(item.expiry_date);
  return d !== null && d < 0;
}

export function riskLevel(item, analysis) {
  if (analysis) return analysis.shelf_life.current.risk_level;
  if (isExpired(item, null)) return "High";
  const d = remainingDays(item, null);
  if (d === null) return "Low";
  if (d <= 3) return "High";
  if (d <= SOON_DAYS) return "Medium";
  return "Low";
}

export function latestPoint(analysis) {
  const pts = analysis?.shelf_life?.points;
  return pts && pts.length ? pts[pts.length - 1] : null;
}

// One consistent freshness/expiry status for every table and card.
export function itemStatus(item, analysis) {
  if (isExpired(item, analysis)) return { key: "expired", label: "Expired", cls: PILL.red };
  const point = latestPoint(analysis);
  const cat = point?.freshness_category;
  if (cat === "spoiled") return { key: "spoiled", label: "Spoiled", cls: PILL.red };
  if (cat === "near_spoilage") return { key: "near", label: "Near spoilage", cls: PILL.orange };
  const rem = remainingDays(item, analysis);
  if (rem !== null && rem <= SOON_DAYS) return { key: "near", label: "Near expiry", cls: PILL.orange };
  if (cat === "acceptable") return { key: "ok", label: "Acceptable", cls: PILL.amber };
  if (cat === "good") return { key: "ok", label: "Good", cls: PILL.emerald };
  if (cat === "fresh") return { key: "ok", label: "Fresh", cls: PILL.green };
  return { key: "ok", label: "In date", cls: PILL.gray };
}

// Three-way bucket used by the summary cards:
//   expired -> expired or spoiled;  near -> near expiry / near spoilage;  fresh -> everything else
export function freshnessBucket(item, analysis) {
  const s = itemStatus(item, analysis).key;
  if (s === "expired" || s === "spoiled") return "expired";
  if (s === "near") return "near";
  return "fresh";
}

// Risk bucket used by retail/warehouse health charts.
export function healthBucket(item, analysis) {
  if (riskLevel(item, analysis) === "High") return "high";
  if (freshnessBucket(item, analysis) === "near" || riskLevel(item, analysis) === "Medium") return "near";
  return "healthy";
}

export function buildRows(items, analyses) {
  return items.map((item) => {
    const analysis = analyses[item.id] || null;
    return {
      item,
      analysis,
      status: itemStatus(item, analysis),
      risk: riskLevel(item, analysis),
      remaining: remainingDays(item, analysis),
      expired: isExpired(item, analysis),
      estExpiry: analysis ? analysis.shelf_life.current.forecasted_expiry_date : item.expiry_date,
      score: latestPoint(analysis)?.freshness_score ?? null,
      health: analysis ? analysis.health_score.overall_food_health_score : null,
    };
  });
}

export function initialsTile(name) {
  const palette = [
    ["#60a5fa", "#2563eb"],
    ["#f87171", "#b91c1c"],
    ["#fbbf24", "#b45309"],
    ["#34d399", "#047857"],
    ["#a78bfa", "#6d28d9"],
    ["#fb923c", "#c2410c"],
  ];
  const idx = (name || "?").split("").reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return { letter: (name || "?").charAt(0).toUpperCase(), from: palette[idx][0], to: palette[idx][1] };
}

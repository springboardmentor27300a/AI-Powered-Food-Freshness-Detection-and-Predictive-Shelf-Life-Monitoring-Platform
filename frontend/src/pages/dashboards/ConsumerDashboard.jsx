import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { deleteInventory } from "../../api/inventory.js";
import { getFreshnessHistory, getFreshnessAssessmentImageDataUrl } from "../../api/freshness.js";
import useDashboardData from "../../components/dashboard/useDashboardData.js";
import ReportDownloads from "../../components/dashboard/ReportDownloads.jsx";
import InventoryFormCard, { CATEGORIES } from "../../components/dashboard/InventoryFormCard.jsx";
import {
  Card, StatCard, Pill, EmptyState, ErrorBanner, SuccessBanner, Note, KV, TableSkeleton,
  PageHeading, Th, Td, inputCls,
} from "../../components/dashboard/ui.jsx";
import {
  COMPLIANCE_PILL, METHOD_LABELS, RISK_PILL, PILL, formatDate, formatDateTime, freshnessBucket,
  initialsTile, latestPoint,
} from "../../components/dashboard/status.js";

const CATEGORY_PILL = {
  fresh: PILL.green, good: PILL.emerald, acceptable: PILL.amber, near_spoilage: PILL.orange, spoiled: PILL.red,
};
const CATEGORY_LABEL = {
  fresh: "Fresh", good: "Good", acceptable: "Acceptable", near_spoilage: "Near spoilage", spoiled: "Spoiled",
};

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const { items, setItems, alerts, rows, loading, analysesLoading, error, analyses } = useDashboardData();

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [recentImages, setRecentImages] = useState({}); // item id -> data URL

  // Keep the selected item valid (clear stale selection when the list changes).
  // Default to the most urgent in-date item (fewest estimated days left).
  useEffect(() => {
    if (items.length === 0) {
      setSelectedId("");
    } else if (!items.some((i) => i.id === selectedId)) {
      const urgent = [...rows]
        .filter((r) => !r.expired)
        .sort((a, b) => (a.remaining ?? 9999) - (b.remaining ?? 9999))[0];
      setSelectedId((urgent || rows[0] || { item: items[0] }).item.id);
    }
  }, [items, rows, selectedId]);

  const counts = useMemo(() => {
    const c = { fresh: 0, near: 0, expired: 0 };
    rows.forEach((r) => {
      c[freshnessBucket(r.item, r.analysis)] += 1;
    });
    return c;
  }, [rows]);

  // Most recent real freshness analyses (items that actually have one).
  const recent = useMemo(
    () =>
      rows
        .filter((r) => latestPoint(r.analysis))
        .sort((a, b) => new Date(latestPoint(b.analysis).assessment_date) - new Date(latestPoint(a.analysis).assessment_date))
        .slice(0, 3),
    [rows]
  );

  // Fetch the real uploaded photo for each recent report (authenticated request).
  useEffect(() => {
    let cancelled = false;
    recent.forEach(async (r) => {
      try {
        const history = await getFreshnessHistory(r.item.id);
        const latest = [...history.assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        if (!latest) return;
        const url = await getFreshnessAssessmentImageDataUrl(latest.id);
        if (!cancelled) setRecentImages((prev) => ({ ...prev, [r.item.id]: url }));
      } catch {
        /* the colour tile is shown instead */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent.map((r) => `${r.item.id}:${latestPoint(r.analysis).assessment_date}`).join("|")]);

  const selected = rows.find((r) => r.item.id === selectedId) || null;

  const visibleRows = rows.filter(({ item, status }) => {
    const q = search.trim().toLowerCase();
    if (q && !`${item.food_name} ${item.category} ${item.batch_number}`.toLowerCase().includes(q)) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (statusFilter && status.label !== statusFilter) return false;
    return true;
  });
  const statusOptions = [...new Set(rows.map((r) => r.status.label))];

  function handleSaved(saved, wasEdit) {
    setItems((prev) => (wasEdit ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]));
    setMessage({ type: "ok", text: wasEdit ? "Food item updated successfully." : "Food item registered successfully." });
    setShowForm(false);
    setEditingItem(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this food item?")) return;
    setMessage({ type: "", text: "" });
    try {
      await deleteInventory(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setMessage({ type: "ok", text: "Food item deleted successfully." });
    } catch {
      setMessage({ type: "err", text: "Unable to delete food item." });
    }
  }

  const sl = selected?.analysis?.shelf_life.current;
  const guidance = selected?.analysis?.storage_guidance;
  const actual = selected?.analysis?.latest_storage_condition;

  return (
    <DashboardLayout title="Consumer Dashboard">
      <PageHeading
        name={user?.full_name?.split(" ")[0]}
        text="Your freshness reports, shelf-life estimates and storage tips."
      />
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total food items" value={items.length} icon="list" tone="blue" loading={loading} />
        <StatCard label="Fresh items" hint="Not near expiry" value={counts.fresh} icon="check" tone="green" loading={loading || analysesLoading} />
        <StatCard label="Nearing expiry" value={counts.near} icon="alert" tone="orange" loading={loading || analysesLoading} />
        <StatCard label="Expired" value={counts.expired} icon="x" tone="red" loading={loading || analysesLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 mb-4">
        <Card
          id="reports"
          title="Recent Freshness Reports"
          subtitle="Latest photo analyses · heuristic image estimate, not a food-safety guarantee"
        >
          {loading || analysesLoading ? (
            <TableSkeleton rows={3} cols={3} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No freshness analyses yet"
              action={
                <Link to="/freshness-analysis" className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  Upload a photo
                </Link>
              }
            >
              Upload a photo of a food item to get its first freshness report.
            </EmptyState>
          ) : (
            <ul>
              {recent.map(({ item, analysis }) => {
                const p = latestPoint(analysis);
                const tile = initialsTile(item.food_name);
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    {recentImages[item.id] ? (
                      <img src={recentImages[item.id]} alt={`${item.food_name} photo`} className="h-[54px] w-[54px] shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl text-xl font-extrabold text-white"
                        style={{ background: `linear-gradient(135deg, ${tile.from}, ${tile.to})` }}
                        aria-hidden="true"
                      >
                        {tile.letter}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{item.food_name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {item.category} · {formatDate(p.assessment_date)}
                      </p>
                    </div>
                    <Pill cls={CATEGORY_PILL[p.freshness_category] || PILL.gray}>
                      {CATEGORY_LABEL[p.freshness_category] || p.freshness_category}
                    </Pill>
                    <div className="w-14 text-right">
                      <p className="text-lg font-extrabold leading-none text-gray-900">{p.freshness_score ?? "—"}</p>
                      <p className="text-[11px] text-gray-500">score /100</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          id="shelf-life"
          title="Shelf-Life Estimate"
          subtitle={selected ? "Choose an item to see its estimate" : "Add a food item to see an estimate"}
          right={
            items.length > 0 && (
              <select
                aria-label="Select food item"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`${inputCls} max-w-[160px]`}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.food_name}
                  </option>
                ))}
              </select>
            )
          }
        >
          {loading || analysesLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : !selected ? (
            <EmptyState title="No items yet">Add a food item to get a shelf-life estimate.</EmptyState>
          ) : !sl ? (
            <EmptyState title="Estimate unavailable">We could not load the estimate for this item. Try again later.</EmptyState>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 mb-3">
                <p className={`text-[44px] font-extrabold leading-none ${sl.is_expired ? "text-red-700" : sl.risk_level === "High" ? "text-red-700" : "text-gray-900"}`}>
                  {sl.is_expired ? "Expired" : sl.remaining_shelf_life_days}
                  {!sl.is_expired && <span className="ml-1.5 text-lg font-semibold">days left</span>}
                </p>
                <Pill cls={RISK_PILL[sl.risk_level]}>{sl.risk_level} risk</Pill>
              </div>
              <KV label="Recorded expiry (printed)">{formatDate(sl.original_expiry_date)}</KV>
              <KV label={sl.is_expired ? "Expired on" : "Estimated expiry (forecast)"}>
                <span className={sl.risk_level === "High" ? "text-red-700" : ""}>{formatDate(sl.forecasted_expiry_date)}</span>
              </KV>
              <KV label="Analysis date">{formatDate(sl.analysis_date)}</KV>
              <Note>
                The estimate can only be <b>earlier</b> than the printed date, never later. It uses food type, storage
                and the latest photo — an estimate, not a safety guarantee.{" "}
                <Link to="/freshness-analysis" className="font-semibold text-green-700 hover:underline">
                  See full details
                </Link>
              </Note>
            </>
          )}
        </Card>
      </div>

      <Card
        id="storage"
        title={`Storage Recommendations${selected ? ` — ${selected.item.food_name}` : ""}`}
        subtitle="Recommended conditions are general guidance. They are shown separately from what you actually recorded."
        className="mb-4"
      >
        {loading || analysesLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : !guidance ? (
          <EmptyState title="No recommendation to show">Select or add a food item to see storage guidance.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="font-bold text-green-800 mb-1">Recommended</p>
              <KV label="Method">{METHOD_LABELS[guidance.recommended_method]}</KV>
              <KV label="Temperature">
                {guidance.temperature_range_c ? `${guidance.temperature_range_c[0]}–${guidance.temperature_range_c[1]} °C` : "No guidance for this food"}
              </KV>
              <KV label="Humidity">
                {guidance.humidity_range_percent ? `${guidance.humidity_range_percent[0]}–${guidance.humidity_range_percent[1]} %` : "No guidance for this food"}
              </KV>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li className="flex gap-2"><TipDot>1</TipDot><span><b>Packaging:</b> {guidance.packaging}</span></li>
                <li className="flex gap-2"><TipDot>2</TipDot><span><b>Handling:</b> {guidance.handling}</span></li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="font-bold text-gray-900 mb-1">Actually recorded</p>
              {actual ? (
                <>
                  <KV label="Temperature">{actual.temperature_celsius} °C</KV>
                  <KV label="Humidity">{actual.humidity_percent} %</KV>
                  <KV label="Status">
                    <Pill cls={COMPLIANCE_PILL[actual.compliance_status].cls}>{COMPLIANCE_PILL[actual.compliance_status].label}</Pill>
                  </KV>
                  <KV label="Recorded">{formatDateTime(actual.recorded_at)}</KV>
                  <Note>{actual.compliance_notes} (Manually entered reading.)</Note>
                </>
              ) : (
                <div className="mt-2">
                  <EmptyState
                    title="No storage readings recorded"
                    action={
                      <Link to="/freshness-analysis" className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                        Add a reading
                      </Link>
                    }
                  >
                    Nothing is assumed about your storage temperature.
                  </EmptyState>
                </div>
              )}
              {guidance.comparison_notes.length > 0 && actual && (
                <ul className="mt-3 list-disc list-inside text-xs text-gray-600 space-y-1">
                  {guidance.comparison_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card id="alerts" title="Alerts" subtitle="Freshness, shelf-life and storage alerts for your items" className="mb-4">
        {loading ? (
          <TableSkeleton rows={2} cols={1} />
        ) : alerts.length === 0 ? (
          <EmptyState title="No alerts">Nothing needs your attention right now.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                  a.severity === "critical" ? "border-red-200 bg-red-50" : a.severity === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                }`}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === "critical" ? "bg-red-600" : a.severity === "warning" ? "bg-amber-500" : "bg-blue-600"}`} />
                <span className="text-gray-800">{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showForm && (
        <div className="mb-4">
          <InventoryFormCard
            editingItem={editingItem}
            onSaved={handleSaved}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
          />
        </div>
      )}

      <Card id="inventory" title="My Food Inventory" subtitle="Search, filter and manage everything you have stored" className="mb-4">
        <ErrorBanner>{message.type === "err" ? message.text : ""}</ErrorBanner>
        <SuccessBanner>{message.type === "ok" ? message.text : ""}</SuccessBanner>
        <div className="flex flex-col gap-2 sm:flex-row mb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, batch or category…"
            aria-label="Search inventory"
            className={`${inputCls} flex-1 min-w-0`}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className={inputCls}>
            <option value="">Category: All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className={inputCls}>
            <option value="">Status: All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
              setMessage({ type: "", text: "" });
              setTimeout(() => document.getElementById("register-item")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 whitespace-nowrap"
          >
            + Add item
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : items.length === 0 ? (
          <EmptyState title="No items in your inventory yet">Add one to start tracking freshness.</EmptyState>
        ) : visibleRows.length === 0 ? (
          <EmptyState title="No items match your search">Try clearing the filters.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <Th>Food</Th><Th>Category</Th><Th>Qty</Th><Th>Batch</Th><Th>Purchased</Th><Th>Expires</Th>
                  <Th>Status</Th><Th>Health</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ item, status, health }) => (
                  <tr key={item.id}>
                    <Td className="font-bold text-gray-900">{item.food_name}</Td>
                    <Td>{item.category}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>{item.batch_number}</Td>
                    <Td>{formatDate(item.purchase_date, false)}</Td>
                    <Td>{formatDate(item.expiry_date, false)}</Td>
                    <Td><Pill cls={status.cls}>{status.label}</Pill></Td>
                    <Td>{health !== null ? `${health}/100` : "—"}</Td>
                    <Td>
                      <div className="flex gap-3 text-sm font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setShowForm(true);
                            setMessage({ type: "", text: "" });
                            setTimeout(() => document.getElementById("register-item")?.scrollIntoView({ behavior: "smooth" }), 50);
                          }}
                          className="text-blue-700 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(item.id)} className="text-red-700 hover:text-red-900">
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReportDownloads isEmpty={!loading && items.length === 0} />

      <Card id="account" title="Account details">
        <ProfileTable user={user} />
      </Card>
    </DashboardLayout>
  );
}

function TipDot({ children }) {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-extrabold text-green-700">
      {children}
    </span>
  );
}

export function ProfileTable({ user }) {
  if (!user) return null;
  const rows = [
    ["Full Name", user.full_name],
    ["Email", user.email],
    ["Phone", user.phone],
    ["Role", user.role],
    ["Status", user.is_active ? "Active" : "Inactive"],
    ["Joined", new Date(user.created_at).toLocaleDateString()],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0 border-gray-100">
            <td className="py-2 text-gray-500 w-40">{label}</td>
            <td className="py-2 text-gray-800 font-medium break-words">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

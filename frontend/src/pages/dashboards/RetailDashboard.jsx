import React, { useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { deleteInventory } from "../../api/inventory.js";
import useDashboardData from "../../components/dashboard/useDashboardData.js";
import ReportDownloads from "../../components/dashboard/ReportDownloads.jsx";
import InventoryFormCard, { CATEGORIES } from "../../components/dashboard/InventoryFormCard.jsx";
import { Donut, Legend, HBars } from "../../components/dashboard/charts.jsx";
import {
  Card, StatCard, Pill, EmptyState, ErrorBanner, SuccessBanner, Note, TableSkeleton, PageHeading, Th, Td, inputCls,
} from "../../components/dashboard/ui.jsx";
import { RISK_PILL, formatDate, healthBucket } from "../../components/dashboard/status.js";

const GREEN = "#16a34a";
const ORANGE = "#f97316";
const RED = "#dc2626";
const AMBER = "#f59e0b";
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const SEVERITY_STYLE = {
  critical: { box: "border-red-200 bg-red-50", dot: "bg-red-600" },
  warning: { box: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  info: { box: "border-blue-200 bg-blue-50", dot: "bg-blue-600" },
};

export default function RetailDashboard() {
  const { user } = useAuth();
  const { items, setItems, alerts, rows, loading, analysesLoading, error } = useDashboardData();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const busy = loading || analysesLoading;

  const counts = useMemo(() => {
    const c = { healthy: 0, near: 0, high: 0 };
    rows.forEach((r) => {
      c[healthBucket(r.item, r.analysis)] += 1;
    });
    return c;
  }, [rows]);

  // Average latest freshness score per category (only items that have a real analysis).
  const categoryScores = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      if (r.score === null) return;
      (m[r.item.category] ||= []).push(r.score);
    });
    return Object.entries(m)
      .map(([label, arr]) => {
        const value = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
        return { label, value, color: value >= 75 ? GREEN : value >= 55 ? AMBER : value >= 45 ? ORANGE : RED };
      })
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // FIFO / use-first queue: soonest ESTIMATED expiry first, oldest purchase breaks ties.
  const queue = useMemo(
    () =>
      rows
        .filter((r) => !r.expired)
        .sort((a, b) => String(a.estExpiry).localeCompare(String(b.estExpiry)) || String(a.item.purchase_date).localeCompare(String(b.item.purchase_date)))
        .slice(0, 5),
    [rows]
  );

  const expiredRows = rows.filter((r) => r.expired);
  const within7 = rows.filter((r) => !r.expired && r.remaining !== null && r.remaining <= 7);

  const categoryRemaining = useMemo(() => {
    const m = {};
    rows.filter((r) => !r.expired && r.remaining !== null).forEach((r) => (m[r.item.category] ||= []).push(r.remaining));
    const list = Object.entries(m).map(([cat, arr]) => ({ cat, avg: arr.reduce((s, v) => s + v, 0) / arr.length }));
    return list.sort((a, b) => a.avg - b.avg)[0] || null;
  }, [rows]);

  const sortedAlerts = [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const shownAlerts = showAllAlerts ? sortedAlerts : sortedAlerts.slice(0, 3);
  const topAction = (itemId) => rows.find((r) => r.item.id === itemId)?.analysis?.recommendations?.[0]?.message;

  const visibleRows = rows.filter(({ item, status, risk }) => {
    const q = search.trim().toLowerCase();
    if (q && !`${item.food_name} ${item.batch_number} ${item.category}`.toLowerCase().includes(q)) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (statusFilter && status.label !== statusFilter) return false;
    if (riskFilter && risk !== riskFilter) return false;
    return true;
  });
  const statusOptions = [...new Set(rows.map((r) => r.status.label))];

  function openForm(item) {
    setEditingItem(item);
    setShowForm(true);
    setMessage({ type: "", text: "" });
    setTimeout(() => document.getElementById("register-item")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

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

  const donutParts = [
    { label: "Fresh", value: counts.healthy, color: GREEN },
    { label: "Near", value: counts.near, color: ORANGE },
    { label: "High risk", value: counts.high, color: RED },
  ];

  return (
    <DashboardLayout title="Retail Dashboard">
      <PageHeading
        name={user?.full_name?.split(" ")[0]}
        text="Product freshness analytics, inventory quality and waste-reduction insights."
      />
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Products monitored" value={items.length} icon="list" tone="blue" loading={loading} />
        <StatCard label="Fresh" value={counts.healthy} icon="check" tone="green" loading={busy} />
        <StatCard label="Near expiry" value={counts.near} icon="alert" tone="orange" loading={busy} />
        <StatCard label="High-risk" value={counts.high} icon="alert" tone="red" loading={busy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-4">
        <Card id="analytics" title="Product Freshness Analytics" subtitle="Share of products by freshness and risk, and average freshness score by category (0–100)">
          {busy ? (
            <TableSkeleton rows={4} cols={2} />
          ) : items.length === 0 ? (
            <EmptyState title="No products to analyze yet">Register a food item below to start monitoring.</EmptyState>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="shrink-0">
                <Donut parts={donutParts} label="products" size={160} />
                <div className="mt-2"><Legend parts={donutParts} /></div>
              </div>
              <div className="flex-1 w-full pt-1">
                {categoryScores.length === 0 ? (
                  <EmptyState title="No freshness scores yet">Analyze a product photo to see average scores by category.</EmptyState>
                ) : (
                  <HBars rows={categoryScores} labelWidth="w-28" />
                )}
              </div>
            </div>
          )}
        </Card>

        <Card id="alerts" title="Shelf-Life Alerts" subtitle="Most urgent first · as of today">
          {loading ? (
            <TableSkeleton rows={3} cols={1} />
          ) : sortedAlerts.length === 0 && expiredRows.length === 0 ? (
            <EmptyState title="No alerts">Nothing needs attention right now.</EmptyState>
          ) : (
            <>
              {expiredRows.length > 0 && (
                <div className={`mb-2 flex gap-3 rounded-xl border px-3 py-2.5 ${SEVERITY_STYLE.critical.box}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_STYLE.critical.dot}`} />
                  <div className="text-sm">
                    <p className="font-bold text-gray-900">Expired: {expiredRows.length} product{expiredRows.length === 1 ? "" : "s"}</p>
                    <p className="text-xs text-gray-600">Remove from sale · Action: pull and log waste</p>
                  </div>
                </div>
              )}
              {shownAlerts.map((a, i) => {
                const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.info;
                const action = topAction(a.inventory_item_id);
                return (
                  <div key={i} className={`mb-2 flex gap-3 rounded-xl border px-3 py-2.5 ${s.box}`}>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                    <div className="text-sm min-w-0">
                      <p className="font-bold text-gray-900">{a.message}</p>
                      {action && <p className="text-xs text-gray-600">Action: {action}</p>}
                    </div>
                  </div>
                );
              })}
              {sortedAlerts.length > 3 && (
                <button type="button" onClick={() => setShowAllAlerts((v) => !v)} className="text-xs font-bold text-green-700 hover:underline">
                  {showAllAlerts ? "Show fewer" : `View all ${sortedAlerts.length} alerts →`}
                </button>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 mb-4">
        <Card id="waste" title="Waste Reduction Insights" subtitle="Based on the stock and dates in your inventory">
          {busy ? (
            <TableSkeleton rows={3} cols={1} />
          ) : items.length === 0 ? (
            <EmptyState title="No insights yet">Insights appear once you have products in your inventory.</EmptyState>
          ) : (
            <ul className="space-y-2.5 text-sm text-gray-700">
              {expiredRows.length > 0 && (
                <Insight n="!"><b>{expiredRows.length} expired product{expiredRows.length === 1 ? "" : "s"}</b> should be removed from sale.</Insight>
              )}
              {queue[0] && (
                <Insight n="1">
                  <b>Sell or use first (FIFO):</b> {queue[0].item.food_name}, batch {queue[0].item.batch_number} ({queue[0].item.quantity} unit
                  {queue[0].item.quantity === 1 ? "" : "s"}) has the earliest estimated expiry, {formatDate(queue[0].estExpiry)}.
                </Insight>
              )}
              <Insight n="2">
                <b>{within7.length} item{within7.length === 1 ? "" : "s"}</b> will reach their estimated expiry within 7 days.
              </Insight>
              {categoryRemaining && (
                <Insight n="3">
                  <b>{categoryRemaining.cat}</b> has the least estimated time left on average ({categoryRemaining.avg.toFixed(1)} days).
                </Insight>
              )}
            </ul>
          )}
          <Note>Insights come from recorded dates and image analyses. They are suggestions, not food-safety advice.</Note>
        </Card>

        <Card title="Rotate first — FIFO queue" subtitle="Soonest estimated expiry at the top">
          {busy ? (
            <TableSkeleton rows={3} cols={4} />
          ) : queue.length === 0 ? (
            <EmptyState title="Nothing to rotate">No in-date products in your inventory.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr><Th>#</Th><Th>Product</Th><Th>Batch</Th><Th>Qty</Th><Th>Est. expiry</Th></tr>
                </thead>
                <tbody>
                  {queue.map((r, i) => (
                    <tr key={r.item.id}>
                      <Td>{i + 1}</Td>
                      <Td className="font-bold text-gray-900">{r.item.food_name}</Td>
                      <Td>{r.item.batch_number}</Td>
                      <Td>{r.item.quantity}</Td>
                      <Td><Pill cls={RISK_PILL[r.risk]}>{formatDate(r.estExpiry, false)}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

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

      <Card
        id="inventory"
        title="Inventory Quality Monitoring"
        subtitle="Product and batch details with freshness score and risk"
        right={
          <button type="button" onClick={() => openForm(null)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 whitespace-nowrap">
            + Register item
          </button>
        }
        className="mb-4"
      >
        <ErrorBanner>{message.type === "err" ? message.text : ""}</ErrorBanner>
        <SuccessBanner>{message.type === "ok" ? message.text : ""}</SuccessBanner>
        <div className="flex flex-col gap-2 lg:flex-row mb-3">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or batch…" aria-label="Search products" className={`${inputCls} flex-1 min-w-0`} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className={inputCls}>
            <option value="">Category: All</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className={inputCls}>
            <option value="">Status: All</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} aria-label="Filter by risk" className={inputCls}>
            <option value="">Risk: All</option>
            {["Low", "Medium", "High"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={8} />
        ) : items.length === 0 ? (
          <EmptyState title="No food items found">Register your first food item to start monitoring.</EmptyState>
        ) : visibleRows.length === 0 ? (
          <EmptyState title="No products match your filters">Try clearing the search or filters.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <Th>Product</Th><Th>Category</Th><Th>Batch</Th><Th>Qty</Th><Th>Score</Th><Th>Freshness</Th>
                  <Th>Risk</Th><Th>Recorded expiry</Th><Th>Est. expiry</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ item, status, risk, score, estExpiry }) => (
                  <tr key={item.id}>
                    <Td className="font-bold text-gray-900">{item.food_name}</Td>
                    <Td>{item.category}</Td>
                    <Td>{item.batch_number}</Td>
                    <Td>{item.quantity}</Td>
                    <Td className="font-bold">{score ?? "—"}</Td>
                    <Td><Pill cls={status.cls}>{status.label}</Pill></Td>
                    <Td><Pill cls={RISK_PILL[risk]}>{risk}</Pill></Td>
                    <Td>{formatDate(item.expiry_date, false)}</Td>
                    <Td>{formatDate(estExpiry, false)}</Td>
                    <Td>
                      <div className="flex gap-3 text-sm font-semibold">
                        <button type="button" onClick={() => openForm(item)} className="text-blue-700 hover:text-blue-900">Edit</button>
                        <button type="button" onClick={() => handleDelete(item.id)} className="text-red-700 hover:text-red-900">Delete</button>
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

function Insight({ n, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-extrabold text-green-700">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function ProfileTable({ user }) {
  const rows = [
    ["Full Name", user?.full_name || "—"],
    ["Email", user?.email || "—"],
    ["Phone", user?.phone || "—"],
    ["Role", user?.role || "—"],
    ["Status", user?.is_active ? "Active" : "Inactive"],
    ["Joined", user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"],
  ];
  return (
    <div className="overflow-x-auto">
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
    </div>
  );
}

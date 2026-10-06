import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { ADMIN_ONLY } from "../constants/roles";
import {
  getFreshnessAnalytics, getInventoryAnalytics, getPlatformAnalytics, getStorageAnalytics,
} from "../api/analytics";
import { friendlyError, friendlyModelStatus } from "../utils/errors";

const FRESHNESS_COLORS = {
  fresh: "#16a34a", good: "#65a30d", acceptable: "#ca8a04",
  near_spoilage: "#ea580c", spoiled: "#dc2626",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "inventory", label: "Inventory" },
  { key: "freshness", label: "Freshness" },
  { key: "storage", label: "Storage" },
];

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value ?? "—"}</p>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = ADMIN_ONLY.includes(user.role);
  const tab = searchParams.get("tab") || "overview";

  const [inventory, setInventory] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [storage, setStorage] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getInventoryAnalytics(), getFreshnessAnalytics(), getStorageAnalytics(),
      isAdmin ? getPlatformAnalytics() : Promise.resolve(null),
    ])
      .then(([inv, fr, st, pl]) => { setInventory(inv); setFreshness(fr); setStorage(st); setPlatform(pl); })
      .catch((err) => setError(friendlyError(err, "Could not load analytics.")));
  }, [isAdmin]);

  const categoryData = inventory
    ? Object.entries(inventory.category_counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    : [];
  const freshnessData = freshness
    ? Object.entries(freshness.reports_by_category).map(([name, value]) => ({ name, value, fill: FRESHNESS_COLORS[name] }))
    : [];

  return (
    <div className="px-4 py-6 sm:px-6">
      <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
      <p className="text-sm text-slate-500">Live figures from the FoodCare database — nothing here is hardcoded.</p>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setSearchParams({ tab: "platform" })}
            className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === "platform" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Platform
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab === "overview" && inventory && freshness && storage && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Food Items" value={inventory.total_food_items} />
            <Stat label="Batches" value={inventory.total_batches} />
            <Stat label="Freshness Reports" value={freshness.total_reports} />
            <Stat label="Avg Freshness Score" value={freshness.average_freshness_score ?? "—"} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Inventory by Category">
              <CategoryBarChart data={categoryData} />
            </ChartCard>
            <ChartCard title="Freshness Distribution">
              <FreshnessDonut data={freshnessData} />
            </ChartCard>
          </div>
        </div>
      )}

      {tab === "inventory" && inventory && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Food Items" value={inventory.total_food_items} />
            <Stat label="Total Batches" value={inventory.total_batches} />
            <Stat label="Expiring Soon" value={inventory.expiring_soon_batches} />
            <Stat label="Expired" value={inventory.expired_batches} />
          </div>
          <ChartCard title="Inventory by Category">
            <CategoryBarChart data={categoryData} />
          </ChartCard>
        </div>
      )}

      {tab === "freshness" && freshness && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Reports" value={freshness.total_reports} />
            <Stat label="Average Score" value={freshness.average_freshness_score ?? "—"} />
          </div>
          <ChartCard title="Reports by Freshness Category">
            <FreshnessDonut data={freshnessData} />
          </ChartCard>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent Reports</h3>
            {freshness.recent_reports.length === 0 ? (
              <p className="text-sm text-slate-400">No reports yet.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {freshness.recent_reports.map((r) => (
                  <div key={r.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium text-brand-700">{r.report_number}</span>
                    <span className="capitalize text-slate-500">{r.category.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-slate-800">{r.freshness_score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "storage" && storage && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total Readings" value={storage.total_readings} />
          <Stat label="Readings (7 days)" value={storage.readings_last_7_days} />
          <Stat label="Non-Compliant (7 days)" value={storage.non_compliant_last_7_days} />
          <Stat label="Avg Temp / Humidity" value={`${storage.average_temperature_c ?? "—"}°C / ${storage.average_humidity_pct ?? "—"}%`} />
        </div>
      )}

      {tab === "platform" && isAdmin && platform && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Users" value={platform.total_users} />
            <Stat label="Food Items" value={platform.inventory.total_food_items} />
            <Stat label="Batches" value={platform.inventory.total_batches} />
            <Stat label="Freshness Reports" value={platform.freshness.total_reports} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">AI Prediction Status</h3>
            <p className="mt-2 text-sm text-slate-600">{friendlyModelStatus(platform.cnn_model_status).message}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Users by Role</h3>
            <div className="space-y-1.5 text-sm">
              {Object.entries(platform.users_by_role).map(([role, count]) => (
                <div key={role} className="flex justify-between">
                  <span className="capitalize text-slate-500">{role.replace(/_/g, " ")}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div style={{ width: "100%", height: 260 }}>{children}</div>
    </div>
  );
}

function CategoryBarChart({ data }) {
  if (data.every((d) => d.value === 0)) {
    return <p className="flex h-full items-center justify-center text-sm text-slate-400">No food items yet.</p>;
  }
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FreshnessDonut({ data }) {
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 0) {
    return <p className="flex h-full items-center justify-center text-sm text-slate-400">No freshness reports yet.</p>;
  }
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {nonZero.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

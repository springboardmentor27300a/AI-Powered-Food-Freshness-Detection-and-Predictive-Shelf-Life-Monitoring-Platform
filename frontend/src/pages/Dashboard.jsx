import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Layers,
  Boxes,
  AlertTriangle,
  Clock,
  XCircle,
  Camera,
  Sparkles,
  Thermometer,
  Droplets,
  ShieldCheck,
  BarChart3,
  Users,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "../context/AuthContext";
import {
  getInventoryAnalytics,
  getFreshnessAnalytics,
  getStorageAnalytics,
  getPlatformAnalytics,
} from "../api/analytics";
import { getInventorySummary } from "../api/inventory";
import { getModelStatus } from "../api/images";
import { CAN_ANALYZE_IMAGES } from "../constants/roles";
import { friendlyError, friendlyModelStatus } from "../utils/errors";

const CATEGORY_LABELS = {
  fruits: "Fruits",
  vegetables: "Vegetables",
  dairy_products: "Dairy Products",
  meat_poultry: "Meat & Poultry",
  seafood: "Seafood",
  bakery_products: "Bakery Products",
  packaged_foods: "Packaged Foods",
  beverages: "Beverages",
};

const FRESHNESS_COLORS = {
  fresh: "#16a34a",
  good: "#65a30d",
  acceptable: "#ca8a04",
  near_spoilage: "#ea580c",
  spoiled: "#dc2626",
};

function greeting() {
  const h = new Date().getHours();

  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";

  return "Good evening";
}

function SummaryCard({
  to,
  icon: Icon,
  label,
  value,
  tone = "default",
}) {
  const tones = {
    default: "bg-slate-50 text-slate-600",
    brand: "bg-brand-50 text-brand-600",
    warn: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    success: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };

  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          tones[tone]
        }`}
      >
        <Icon size={20} />
      </div>

      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">
          {value ?? "—"}
        </p>

        <p className="truncate text-sm text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

function SectionTitle({ title, link, children }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {title}
      </h3>

      {link && (
        <Link
          to={link}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          View report →
        </Link>
      )}

      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [storage, setStorage] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setError("");

      const results = await Promise.allSettled([
        getInventorySummary(),
        getInventoryAnalytics(),
        getFreshnessAnalytics(),
        getStorageAnalytics(),
        getModelStatus(),
      ]);

      if (results[0].status === "fulfilled") {
        setSummary(results[0].value);
      } else {
        setError(
          friendlyError(
            results[0].reason,
            "Could not load dashboard summary."
          )
        );
      }

      if (results[1].status === "fulfilled") {
        setInventory(results[1].value);
      }

      if (results[2].status === "fulfilled") {
        setFreshness(results[2].value);
      }

      if (results[3].status === "fulfilled") {
        setStorage(results[3].value);
      }

      if (results[4].status === "fulfilled") {
        setModelStatus(results[4].value);
      }

      // Platform analytics is intentionally requested separately.
      // The backend restricts this endpoint to administrators.
      if (user?.role === "administrator") {
        try {
          const platformData = await getPlatformAnalytics();
          setPlatform(platformData);
        } catch {
          // Do not show an error if administrator platform analytics
          // are temporarily unavailable.
        }
      }
    }

    loadDashboard();
  }, [user?.role]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /*
   * Inventory category data
   */
  const categoryCounts =
    inventory?.category_counts ||
    summary?.category_summary ||
    {};

  const categoryData = Object.entries(categoryCounts).map(
    ([name, value]) => ({
      name: CATEGORY_LABELS[name] || name,
      value: Number(value || 0),
    })
  );

  /*
   * Freshness data
   */
  const freshnessCategories =
    freshness?.reports_by_category || {};

  const freshnessData = Object.entries(freshnessCategories).map(
    ([name, value]) => ({
      name,
      value: Number(value || 0),
      fill:
        FRESHNESS_COLORS[name] ||
        "#64748b",
    })
  );

  const freshnessNonZero = freshnessData.filter(
    (item) => item.value > 0
  );

  /*
   * Storage compliance data
   */
  const totalStorageReadings =
    Number(storage?.readings_last_7_days || 0);

  const nonCompliantReadings =
    Number(storage?.non_compliant_last_7_days || 0);

  const compliantReadings = Math.max(
    totalStorageReadings - nonCompliantReadings,
    0
  );

  const storageComplianceData = [
    {
      name: "Compliant",
      value: compliantReadings,
    },
    {
      name: "Non-Compliant",
      value: nonCompliantReadings,
    },
  ].filter((item) => item.value > 0);

  const modelInfo = friendlyModelStatus(modelStatus);

  const averageFreshness =
    freshness?.average_freshness_score;

  const averageTemperature =
    storage?.average_temperature_c;

  const averageHumidity =
    storage?.average_humidity_pct;

  const expiringSoon =
    inventory?.expiring_soon_batches ??
    summary?.near_expiry_count ??
    0;

  const expired =
    inventory?.expired_batches ??
    summary?.expired_count ??
    0;

  const lowStock =
    inventory?.low_stock_batches ??
    summary?.low_stock_count ??
    0;

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {greeting()},{" "}
            {user?.full_name?.split(" ")[0] ||
              user?.username}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Executive overview of food freshness, inventory,
            storage and waste-risk information.
          </p>
        </div>

        <p className="text-sm text-slate-400">
          {today}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Executive KPI Cards */}
      {(summary || inventory || freshness || storage) && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            to="/inventory"
            icon={Package}
            label="Total Food Items"
            value={
              inventory?.total_food_items ??
              summary?.total_food_items
            }
            tone="brand"
          />

          <SummaryCard
            to="/batches"
            icon={Layers}
            label="Total Batches"
            value={
              inventory?.total_batches ??
              summary?.total_batches
            }
            tone="brand"
          />

          <SummaryCard
            to="/batches?status=low_stock"
            icon={AlertTriangle}
            label="Low Stock"
            value={lowStock}
            tone="warn"
          />

          <SummaryCard
            to="/waste-reduction"
            icon={Clock}
            label="Near Expiry"
            value={expiringSoon}
            tone="warn"
          />

          <SummaryCard
            to="/waste-reduction"
            icon={XCircle}
            label="Expired"
            value={expired}
            tone="danger"
          />

          <SummaryCard
            to="/reports"
            icon={BarChart3}
            label="Freshness Reports"
            value={freshness?.total_reports ?? 0}
            tone="success"
          />
        </div>
      )}

      {/* Freshness + Inventory */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Inventory by Category */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Inventory by Category"
            link="/inventory-quality-reports"
          />

          {!inventory && !summary ? (
            <p className="text-sm text-slate-400">
              Loading...
            </p>
          ) : categoryData.length === 0 ||
            categoryData.every((item) => item.value === 0) ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No food items yet.
            </p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={categoryData}
                  margin={{ left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-20}
                    textAnchor="end"
                    height={55}
                    interval={0}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="value"
                    fill="#16a34a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Freshness Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Freshness Distribution"
            link="/reports"
          />

          {!freshness ? (
            <p className="text-sm text-slate-400">
              Loading...
            </p>
          ) : freshnessNonZero.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No freshness reports yet.
            </p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={freshnessNonZero}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {freshnessNonZero.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.fill}
                      />
                    ))}
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {averageFreshness !== null &&
            averageFreshness !== undefined && (
              <div className="mt-2 text-center">
                <span className="text-xs text-slate-400">
                  Average Freshness Score
                </span>

                <p className="text-lg font-bold text-slate-800">
                  {averageFreshness}
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Storage + Risk Analytics */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Storage Compliance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Storage Compliance"
            link="/storage-compliance-reports"
          />

          {!storage ? (
            <p className="text-sm text-slate-400">
              Loading...
            </p>
          ) : storageComplianceData.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No storage readings in the last 7 days.
            </p>
          ) : (
            <>
              <div style={{ width: "100%", height: 190 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={storageComplianceData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      <Cell
                        fill="#16a34a"
                      />
                      <Cell
                        fill="#dc2626"
                      />
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-400">
                    Last 7 Days
                  </p>
                  <p className="font-bold text-slate-800">
                    {storage.readings_last_7_days}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Non-Compliant
                  </p>
                  <p className="font-bold text-red-600">
                    {storage.non_compliant_last_7_days}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Temperature / Humidity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Storage Conditions"
            link="/storage-compliance-reports"
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <Thermometer size={18} />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Average Temperature
                  </p>

                  <p className="text-lg font-bold text-slate-800">
                    {averageTemperature !== null &&
                    averageTemperature !== undefined
                      ? `${averageTemperature} °C`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Droplets size={18} />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Average Humidity
                  </p>

                  <p className="text-lg font-bold text-slate-800">
                    {averageHumidity !== null &&
                    averageHumidity !== undefined
                      ? `${averageHumidity}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expiry / Waste Risk */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Expiry & Waste Risk"
            link="/waste-reduction-reports"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3">
              <span className="text-sm text-amber-800">
                Near Expiry
              </span>

              <span className="font-bold text-amber-700">
                {expiringSoon}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
              <span className="text-sm text-red-800">
                Expired
              </span>

              <span className="font-bold text-red-700">
                {expired}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">
                Low Stock
              </span>

              <span className="font-bold text-slate-800">
                {lowStock}
              </span>
            </div>
          </div>

          <Link
            to="/waste-reduction-reports"
            className="mt-4 block text-center text-xs font-medium text-brand-700 hover:underline"
          >
            Open Waste Reduction Report →
          </Link>
        </div>
      </div>

      {/* Administrator Platform Analytics */}
      {user?.role === "administrator" && platform && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Platform Overview" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={Users}
              label="Total Users"
              value={platform.total_users}
              tone="blue"
            />

            <SummaryCard
              icon={ShieldCheck}
              label="Storage Readings"
              value={platform.storage?.total_readings ?? 0}
              tone="success"
            />

            <SummaryCard
              icon={BarChart3}
              label="Freshness Reports"
              value={platform.freshness?.total_reports ?? 0}
              tone="brand"
            />
          </div>
        </div>
      )}

      {/* AI + Image Analysis */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Sparkles size={18} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                AI Freshness Prediction
              </p>

              <p className="text-xs text-slate-500">
                {modelInfo.message}
              </p>
            </div>
          </div>
        </div>

        {CAN_ANALYZE_IMAGES.includes(user?.role) && (
          <Link
            to="/upload"
            className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-sm hover:bg-brand-100"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600">
                <Camera size={18} />
              </div>

              <div>
                <p className="text-sm font-semibold text-brand-800">
                  Analyze a food image
                </p>

                <p className="text-xs text-brand-600">
                  Upload a photo to run freshness analysis
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
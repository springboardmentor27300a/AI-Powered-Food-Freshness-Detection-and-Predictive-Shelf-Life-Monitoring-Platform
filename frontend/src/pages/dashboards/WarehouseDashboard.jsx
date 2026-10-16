import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getStorageConditionHistory } from "../../api/storage.js";
import useDashboardData from "../../components/dashboard/useDashboardData.js";
import ReportDownloads from "../../components/dashboard/ReportDownloads.jsx";
import { Donut, Legend, LineChart } from "../../components/dashboard/charts.jsx";
import {
  Card, StatCard, Pill, EmptyState, ErrorBanner, Note, TableSkeleton, PageHeading, Th, Td, inputCls,
} from "../../components/dashboard/ui.jsx";
import { COMPLIANCE_PILL, PILL, RISK_PILL, formatDate, healthBucket } from "../../components/dashboard/status.js";
import { ProfileTable } from "./ConsumerDashboard.jsx";

const GREEN = "#16a34a";
const ORANGE = "#f97316";
const RED = "#dc2626";

export default function WarehouseDashboard() {
  const { user } = useAuth();
  const { items, rows, alerts, loading, analysesLoading, error } = useDashboardData();
  const busy = loading || analysesLoading;

  const [showAllBatches, setShowAllBatches] = useState(false);
  const [showAllCompliance, setShowAllCompliance] = useState(false);
  const [envItemId, setEnvItemId] = useState("");
  const [metric, setMetric] = useState("temperature");
  const [history, setHistory] = useState(null); // null = not loaded
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const counts = useMemo(() => {
    const c = { healthy: 0, near: 0, high: 0 };
    rows.forEach((r) => {
      c[healthBucket(r.item, r.analysis)] += 1;
    });
    return c;
  }, [rows]);

  const withReadings = rows.filter((r) => r.analysis?.latest_storage_condition);
  const noReadings = rows.filter((r) => r.analysis && !r.analysis.latest_storage_condition);
  const suitable = withReadings.filter((r) => r.analysis.latest_storage_condition.compliance_status === "suitable").length;
  const compliancePct = withReadings.length ? Math.round((suitable / withReadings.length) * 100) : null;
  const healthScores = rows.filter((r) => r.health !== null).map((r) => r.health);
  const avgHealth = healthScores.length ? Math.round(healthScores.reduce((s, v) => s + v, 0) / healthScores.length) : null;
  const storageAlerts = alerts.filter((a) => a.type === "storage");

  // Keep the chart's item valid when the item list changes.
  useEffect(() => {
    if (withReadings.length === 0) {
      setEnvItemId("");
    } else if (!withReadings.some((r) => r.item.id === envItemId)) {
      setEnvItemId(withReadings[0].item.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Real reading history for the selected batch (cleared when switching, stale replies ignored).
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setHistoryError("");
    if (!envItemId) return undefined;
    setHistoryLoading(true);
    getStorageConditionHistory(envItemId)
      .then((data) => !cancelled && setHistory([...data].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))))
      .catch(() => !cancelled && setHistoryError("Could not load the reading history for this batch."))
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [envItemId]);

  const envRow = rows.find((r) => r.item.id === envItemId);
  const guidance = envRow?.analysis?.storage_guidance;
  const band = metric === "temperature" ? guidance?.temperature_range_c : guidance?.humidity_range_percent;
  const dayLabels = (history || []).map((h) => new Date(h.recorded_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" }));
  const sameDay = new Set(dayLabels).size < dayLabels.length; // several readings on one day: show times instead
  const points = (history || []).map((h, i) => ({
    label: sameDay ? new Date(h.recorded_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : dayLabels[i],
    value: metric === "temperature" ? h.temperature_celsius : h.humidity_percent,
  }));

  const donutParts = [
    { label: "Healthy", value: counts.healthy, color: GREEN },
    { label: "Near expiry", value: counts.near, color: ORANGE },
    { label: "High risk", value: counts.high, color: RED },
  ];

  const complianceRows = showAllCompliance ? rows : rows.slice(0, 6);
  const batchRows = showAllBatches ? rows : rows.slice(0, 8);

  return (
    <DashboardLayout title="Warehouse Dashboard">
      <PageHeading
        name={user?.full_name?.split(" ")[0]}
        text="Storage compliance, inventory health and batch freshness reports."
      />
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total batches" value={items.length} icon="list" tone="blue" loading={loading} />
        <StatCard label="Healthy" value={counts.healthy} icon="check" tone="green" loading={busy} />
        <StatCard label="Near expiry" value={counts.near} icon="alert" tone="orange" loading={busy} />
        <StatCard label="High-risk" value={counts.high} icon="alert" tone="red" loading={busy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 mb-4">
        <Card id="compliance" title="Storage Compliance Monitoring" subtitle="Recommended vs actual, from manually entered readings">
          {busy ? (
            <TableSkeleton rows={4} cols={4} />
          ) : rows.length === 0 ? (
            <EmptyState title="No batches yet">Batches appear here once food items are in your inventory.</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr><Th>Batch / food</Th><Th>Recommended</Th><Th>Actual (latest)</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {complianceRows.map(({ item, analysis }) => {
                      const g = analysis?.storage_guidance;
                      const s = analysis?.latest_storage_condition;
                      return (
                        <tr key={item.id}>
                          <Td>
                            <b className="text-gray-900">{item.food_name}</b>
                            <span className="block text-xs text-gray-500">{item.batch_number} · {item.storage_location || "Location not set"}</span>
                          </Td>
                          <Td>
                            {g?.temperature_range_c ? `${g.temperature_range_c[0]}–${g.temperature_range_c[1]} °C` : <span className="text-gray-400">No guidance</span>}
                          </Td>
                          <Td>
                            {s ? <b>{s.temperature_celsius} °C · {s.humidity_percent}%</b> : <span className="text-gray-400">Not recorded</span>}
                          </Td>
                          <Td>
                            {s ? <Pill cls={COMPLIANCE_PILL[s.compliance_status].cls}>{COMPLIANCE_PILL[s.compliance_status].label}</Pill> : <Pill cls={PILL.gray}>No reading</Pill>}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 6 && (
                <button type="button" onClick={() => setShowAllCompliance((v) => !v)} className="mt-2 text-xs font-bold text-green-700 hover:underline">
                  {showAllCompliance ? "Show fewer" : `Show all ${rows.length} batches →`}
                </button>
              )}
            </>
          )}
          <Note>
            <b>No automatic sensors are connected.</b> Readings are entered by hand. Where none exist, the status shows
            “No reading” instead of a guess. Record readings on the{" "}
            <Link to="/freshness-analysis" className="font-semibold text-green-700 hover:underline">Freshness Analysis</Link> page.
          </Note>
        </Card>

        <Card title="Inventory Health" subtitle="Share of batches by health">
          {busy ? (
            <TableSkeleton rows={3} cols={2} />
          ) : items.length === 0 ? (
            <EmptyState title="No batches yet" />
          ) : (
            <>
              <div className="flex items-center gap-5">
                <Donut parts={donutParts} label="batches" size={150} />
                <Legend parts={donutParts} vertical />
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Average food health score</span><b>{avgHealth !== null ? `${avgHealth}/100` : "—"}</b></div>
                <div className="flex justify-between"><span className="text-gray-500">Storage compliance (recorded batches)</span><b>{compliancePct !== null ? `${compliancePct}%` : "No readings"}</b></div>
                <div className="flex justify-between"><span className="text-gray-500">Batches without a reading</span><b>{noReadings.length}</b></div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card
          id="environment"
          title="Environmental Analytics"
          subtitle={
            envRow && history
              ? `${envRow.item.food_name} (${envRow.item.batch_number}) · ${history.length} manual reading${history.length === 1 ? "" : "s"}`
              : "Temperature and humidity trends from recorded readings"
          }
          right={
            withReadings.length > 0 && (
              <div className="flex gap-2">
                <select aria-label="Select batch" value={envItemId} onChange={(e) => setEnvItemId(e.target.value)} className={`${inputCls} max-w-[150px]`}>
                  {withReadings.map((r) => <option key={r.item.id} value={r.item.id}>{r.item.food_name}</option>)}
                </select>
                <select aria-label="Select measurement" value={metric} onChange={(e) => setMetric(e.target.value)} className={inputCls}>
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                </select>
              </div>
            )
          }
        >
          {busy || historyLoading ? (
            <TableSkeleton rows={4} cols={1} />
          ) : historyError ? (
            <ErrorBanner>{historyError}</ErrorBanner>
          ) : withReadings.length === 0 ? (
            <EmptyState title="No storage readings recorded yet">
              Environmental trends appear once temperature and humidity readings are entered for a batch. No sensor data is shown or assumed.
            </EmptyState>
          ) : !history || history.length < 2 ? (
            <EmptyState title="Only one reading so far">
              A trend needs at least two readings.
              {history?.[0] && ` Latest: ${history[0].temperature_celsius} °C, ${history[0].humidity_percent}% humidity.`}
            </EmptyState>
          ) : (
            <>
              <LineChart points={points} unit={metric === "temperature" ? "°C" : "%"} band={band} color={metric === "temperature" ? RED : "#2563eb"} />
              <p className="mt-1 text-xs text-gray-500">
                {metric === "temperature" ? "Temperature (°C)" : "Humidity (%)"}
                {band ? ` · green band = recommended ${band[0]}–${band[1]}${metric === "temperature" ? " °C" : " %"}` : " · no recommended range defined for this food"}
              </p>
            </>
          )}
        </Card>

        <Card title="Storage Warnings" subtitle="From your recorded readings">
          {busy ? (
            <TableSkeleton rows={3} cols={1} />
          ) : (
            <>
              {storageAlerts.length === 0 ? (
                <EmptyState title="No storage warnings">{withReadings.length ? "All recorded readings are within range." : "No readings recorded yet."}</EmptyState>
              ) : (
                storageAlerts.map((a, i) => (
                  <div key={i} className={`mb-2 flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${a.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === "critical" ? "bg-red-600" : "bg-amber-500"}`} />
                    <span className="font-semibold text-gray-900">{a.message}</span>
                  </div>
                ))
              )}
              {noReadings.length > 0 && (
                <div className="mt-2">
                  <EmptyState title={`${noReadings.length} batch${noReadings.length === 1 ? "" : "es"} without readings`}>
                    Add a reading to enable compliance checks.
                  </EmptyState>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Card id="batches" title="Batch Freshness Reports" subtitle="Batch-level freshness, recorded expiry and estimated remaining shelf life" className="mb-4">
        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : items.length === 0 ? (
          <EmptyState title="No batches yet">Add food items to see batch freshness reports.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr><Th>Batch</Th><Th>Food / category</Th><Th>Qty</Th><Th>Score</Th><Th>Recorded expiry</Th><Th>Est. remaining</Th><Th>Risk</Th></tr>
                </thead>
                <tbody>
                  {batchRows.map(({ item, score, remaining, expired, risk }) => (
                    <tr key={item.id}>
                      <Td className="font-bold text-gray-900">{item.batch_number}</Td>
                      <Td>{item.food_name}<span className="block text-xs text-gray-500">{item.category}</span></Td>
                      <Td>{item.quantity}</Td>
                      <Td className="font-bold">{score ?? "—"}</Td>
                      <Td>{formatDate(item.expiry_date, false)}</Td>
                      <Td>{expired ? "Expired" : remaining === null ? "—" : `${remaining} day${remaining === 1 ? "" : "s"}`}</Td>
                      <Td><Pill cls={RISK_PILL[risk]}>{risk}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && (
              <button type="button" onClick={() => setShowAllBatches((v) => !v)} className="mt-2 text-xs font-bold text-green-700 hover:underline">
                {showAllBatches ? "Show fewer" : `Show all ${rows.length} batches →`}
              </button>
            )}
          </>
        )}
      </Card>

      <ReportDownloads isEmpty={!loading && items.length === 0} />

      <Card id="account" title="Account details">
        <ProfileTable user={user} />
      </Card>
    </DashboardLayout>
  );
}

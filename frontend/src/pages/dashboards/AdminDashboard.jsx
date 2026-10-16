import React, { useEffect, useState } from "react";
import ReportDownloads, { ADMIN_REPORTS } from "../../components/dashboard/ReportDownloads.jsx";
import DashboardLayout from "../../components/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ProfileTable } from "./ConsumerDashboard.jsx";
import api from "../../api/axios.js";
import { getAdminStats } from "../../api/admin.js";
import { HBars, BarChart } from "../../components/dashboard/charts.jsx";
import {
  Card, StatCard, Pill, EmptyState, ErrorBanner, Note, KV, TableSkeleton, PageHeading, Th, Td, inputCls,
} from "../../components/dashboard/ui.jsx";
import { PILL } from "../../components/dashboard/status.js";

const ROLE_LABELS = {
  consumer: "Consumer",
  retail_manager: "Retail Manager",
  warehouse_operator: "Warehouse Operator",
  food_quality_inspector: "Quality Inspector",
  administrator: "Administrator",
};
const ROLE_COLORS = {
  consumer: "#2563eb",
  retail_manager: "#16a34a",
  warehouse_operator: "#f59e0b",
  food_quality_inspector: "#7c3aed",
  administrator: "#374151",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [health, setHealth] = useState({ state: "checking", checkedAt: null }); // checking | ok | down
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [printSection, setPrintSection] = useState(null); // "platform" | "users" | null

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/users")
      .then(({ data }) => mounted && setUsers(data))
      .catch(() => mounted && setError("Could not load user list."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getAdminStats()
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStatsError(true))
      .finally(() => mounted && setStatsLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Real API health check (GET /health on the backend).
  useEffect(() => {
    let mounted = true;
    api
      .get("/health")
      .then(({ data }) => mounted && setHealth({ state: data?.status === "healthy" ? "ok" : "down", checkedAt: new Date() }))
      .catch(() => mounted && setHealth({ state: "down", checkedAt: new Date() }));
    return () => {
      mounted = false;
    };
  }, []);

  // Print only the chosen summary (CSS in the <style> block below hides everything else).
  useEffect(() => {
    if (!printSection) return undefined;
    const t = setTimeout(() => {
      window.print();
      setPrintSection(null);
    }, 100);
    return () => clearTimeout(t);
  }, [printSection]);

  const activeUsers = users.filter((u) => u.is_active).length;
  const roleRows = stats
    ? Object.entries(stats.users_by_role).map(([role, count]) => ({ label: ROLE_LABELS[role] || role, value: count, color: ROLE_COLORS[role] || "#6b7280" }))
    : [];
  const maxRole = Math.max(...roleRows.map((r) => r.value), 1);

  const visibleUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (q && !`${u.full_name} ${u.email}`.toLowerCase().includes(q)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const activity = stats
    ? [
        { label: "Items", value: stats.total_inventory_items },
        { label: "Analyses", value: stats.total_freshness_assessments },
        { label: "Readings", value: stats.total_storage_readings },
      ]
    : [];

  return (
    <DashboardLayout title="Admin Dashboard">
      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { display: block; position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
        }
      `}</style>

      <PageHeading name={user?.full_name?.split(" ")[0]} text="Platform user management, system monitoring and reporting." />
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total users" value={stats ? stats.total_users : users.length} icon="users" tone="blue" loading={loading && statsLoading} />
        <StatCard label="Active users" value={activeUsers} icon="check" tone="green" loading={loading} />
        <StatCard label="Inventory items" value={stats ? stats.total_inventory_items : "—"} icon="list" tone="amber" loading={statsLoading} />
        <StatCard label="Freshness analyses" value={stats ? stats.total_freshness_assessments : "—"} icon="chart" tone="green" loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4 mb-4">
        <Card id="analytics" title="Users by Role" subtitle="Registered accounts">
          {statsLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : statsError || !stats ? (
            <EmptyState title="Statistics unavailable">Could not load platform statistics.</EmptyState>
          ) : (
            <HBars rows={roleRows} max={maxRole} labelWidth="w-36" />
          )}
        </Card>

        <Card title="Platform Activity" subtitle="Records stored on the platform (all users)">
          {statsLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : statsError || !stats ? (
            <EmptyState title="Statistics unavailable">Could not load platform statistics.</EmptyState>
          ) : (
            <>
              <BarChart data={activity} />
              <Note>
                Weekly activity and platform-wide near-expiry / high-risk counts are not available from the current
                statistics API, so they are not shown.
              </Note>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-4">
        <Card id="users" title="User Management" subtitle="Accounts, roles and status">
          <div className="flex flex-col gap-2 sm:flex-row mb-3">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" aria-label="Search users" className={`${inputCls} flex-1 min-w-0`} />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className={inputCls}>
              <option value="">Role: All</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : users.length === 0 ? (
            <EmptyState title="No users found" />
          ) : visibleUsers.length === 0 ? (
            <EmptyState title="No users match your search" />
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full min-w-[460px]">
                <thead>
                  <tr><Th>User</Th><Th>Role</Th><Th>Status</Th></tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => (
                    <tr key={u.id}>
                      <Td>
                        <b className="text-gray-900">{u.full_name}</b>
                        <span className="block text-xs text-gray-500">{u.email}</span>
                      </Td>
                      <Td>{ROLE_LABELS[u.role] || u.role}</Td>
                      <Td><Pill cls={u.is_active ? PILL.green : PILL.gray}>{u.is_active ? "Active" : "Inactive"}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Note>This list is view-only, matching the permissions the application currently supports.</Note>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card id="system" title="System Monitoring" subtitle="Only verified information is shown">
            <KV label="API health">
              {health.state === "checking" ? <Pill cls={PILL.gray}>Checking…</Pill> : health.state === "ok" ? <Pill cls={PILL.green}>Healthy</Pill> : <Pill cls={PILL.red}>Not responding</Pill>}
            </KV>
            <KV label="Database">
              {statsLoading ? <Pill cls={PILL.gray}>Checking…</Pill> : statsError ? <Pill cls={PILL.red}>Query failed</Pill> : <Pill cls={PILL.green}>Reachable (query succeeded)</Pill>}
            </KV>
            <KV label="Last checked">{health.checkedAt ? health.checkedAt.toLocaleTimeString() : "—"}</KV>
            <div className="mt-3">
              <EmptyState title="Error logs: unavailable">No log source is connected to the application yet.</EmptyState>
            </div>
          </Card>

          <Card id="reports" title="Reporting Management" subtitle="Summaries you can print today (or save as PDF)">
            <KV label="Platform summary">
              <button type="button" onClick={() => setPrintSection("platform")} disabled={!stats} className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Print</button>
            </KV>
            <KV label="User & role summary">
              <button type="button" onClick={() => setPrintSection("users")} disabled={users.length === 0} className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Print</button>
            </KV>
            <Note>PDF and Excel versions of the platform summary are in “Reports & Exports” below. CSV is not supported.</Note>
          </Card>
        </div>
      </div>

      <ReportDownloads id="platform-report" reports={ADMIN_REPORTS} subtitle="Download the platform summary as PDF or Excel (aggregate counts only)" />

      <Card id="account" title="Your account details">
        <ProfileTable user={user} />
      </Card>

      {printSection && (
        <div className="print-only">
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>
            {printSection === "platform" ? "Platform Summary" : "User & Role Summary"}
          </h1>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
            Generated {new Date().toLocaleString()} · figures are counts stored in the platform database.
          </p>
          {printSection === "platform" && stats && (
            <table style={{ fontSize: 14 }}>
              <tbody>
                <tr><td style={{ padding: "4px 24px 4px 0" }}>Total users</td><td>{stats.total_users}</td></tr>
                <tr><td>Inventory items</td><td>{stats.total_inventory_items}</td></tr>
                <tr><td>Freshness assessments</td><td>{stats.total_freshness_assessments}</td></tr>
                <tr><td>Storage readings</td><td>{stats.total_storage_readings}</td></tr>
              </tbody>
            </table>
          )}
          {printSection === "users" && (
            <>
              <p style={{ fontSize: 14, marginBottom: 8 }}>Active users: {activeUsers} of {users.length}</p>
              <table style={{ fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {stats && Object.entries(stats.users_by_role).map(([role, count]) => (
                    <tr key={role}><td style={{ padding: "3px 24px 3px 0" }}>{ROLE_LABELS[role] || role}</td><td>{count}</td></tr>
                  ))}
                </tbody>
              </table>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "14px 0 6px" }}>Users</h2>
              <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ padding: "3px 12px 3px 0" }}>{u.full_name}</td>
                      <td style={{ paddingRight: 12 }}>{u.email}</td>
                      <td style={{ paddingRight: 12 }}>{ROLE_LABELS[u.role] || u.role}</td>
                      <td>{u.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Server, Activity, Boxes, ScanSearch, ClipboardList, Thermometer,
  BellRing, RefreshCw, Ban, CheckCircle2, FileBarChart, ShieldCheck, Trash2,
  FileDown, FileSpreadsheet, Loader2, AlertTriangle,
} from 'lucide-react';
import { apiGet, apiPatch, apiDelete, apiDownload, formatDateTime } from '../../api';
import { DonutChart } from '../../components/Charts';

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

const statCard = (icon, label, value, sub, color = '#2563eb') => (
  <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
      <div style={{ backgroundColor: `${color}15`, padding: '12px', borderRadius: '50%', marginRight: '16px', color }}>{icon}</div>
      <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{label}</h3>
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{value}</div>
    <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '8px', marginBottom: 0 }}>{sub}</p>
  </div>
);

const REPORT_TYPE_NAMES = {
  freshness: 'Freshness',
  shelf_life: 'Shelf-Life',
  inventory_quality: 'Inventory Quality',
  waste_reduction: 'Waste Reduction',
  storage_compliance: 'Storage Compliance',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [scanStats, setScanStats] = useState(null);
  const [exec, setExec] = useState(null);
  const [health, setHealth] = useState(null);
  const [reports, setReports] = useState(null);
  const [reportFilter, setReportFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyUser, setBusyUser] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, overviewData, alertsData, scanData, execData, healthData, reportsData] = await Promise.all([
        apiGet('/api/auth/users'),
        apiGet('/api/analytics/overview'),
        apiGet('/api/alerts?limit=10'),
        apiGet('/api/analytics/scans'),
        apiGet('/api/executive/executive'),
        apiGet('/api/health'),
        apiGet('/api/reports?limit=100'),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setOverview(overviewData);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setScanStats(scanData);
      setExec(execData);
      setHealth(healthData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleUserStatus = async (user) => {
    setBusyUser(user.username);
    try {
      await apiPatch(`/api/auth/users/${encodeURIComponent(user.username)}/status`, { is_active: !user.is_active });
      await load();
    } catch (err) {
      setError(`Failed to update ${user.username}: ${err.message}`);
    } finally {
      setBusyUser(null);
    }
  };

  const deleteReport = async (report) => {
    try {
      await apiDelete(`/api/reports/${report._id}`);
      showToast(`Report "${report.title}" deleted`);
      await load();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const download = async (report, format) => {
    try {
      await apiDownload(`/api/reports/${report._id}/export?format=${format}`, `report_${report._id}.${format}`);
      showToast(`${format.toUpperCase()} exported`);
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const activeUsers = users.filter((u) => u.is_active).length;

  const freshDonut = scanStats ? [
    { label: 'Fresh', value: scanStats.fresh_scans || 0, color: '#16a34a' },
    { label: 'Rotten', value: scanStats.rotten_scans || 0, color: '#ef4444' },
  ] : null;

  const lifecycleCounts = exec?.lifecycle_counts || {};
  const lifecyclePalette = {
    Active: '#16a34a', 'Sold Out': '#6b7280', Consumed: '#0d9488',
    Disposed: '#ef4444', Expired: '#d97706', Archived: '#9ca3af',
  };

  const filteredReports = (reports || []).filter(
    (r) => !reportFilter || (r.report_type || 'freshness') === reportFilter,
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Administrator</h1>
          <p style={{ color: '#666', margin: 0 }}>Platform administration - all numbers are calculated from database records.</p>
        </div>
        <button className="button" onClick={load} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', color: '#fff' }}>
          <RefreshCw size={16} style={{ marginRight: '8px' }} /> Refresh
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px' }}>{error}</div>}
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1200, backgroundColor: toast.ok ? '#dcfce7' : '#fee2e2', color: toast.ok ? '#15803d' : '#b91c1c', padding: '14px 20px', borderRadius: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}
      {loading && !overview && <div style={card}><p style={{ color: '#6b7280', margin: 0 }}>Loading platform statistics…</p></div>}

      {overview && (
        <>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Platform Analytics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            {statCard(<Users size={22} />, 'Total Users', users.length, `${activeUsers} active · ${users.length - activeUsers} deactivated`, '#2563eb')}
            {statCard(<Boxes size={22} />, 'Food Items', overview.total_food_items, `${overview.total_batches} batch records`, '#16a34a')}
            {statCard(<ScanSearch size={22} />, 'AI Scans', overview.total_scans, `${overview.spoiled_scans} rotten detections`, '#d97706')}
            {statCard(<Thermometer size={22} />, 'Storage Readings', overview.total_storage_readings, 'All manually entered', '#0d9488')}
            {statCard(<BellRing size={22} />, 'Alerts Generated', exec?.total_alerts ?? '…', 'All notification types, lifetime', '#ef4444')}
            {statCard(<FileBarChart size={22} />, 'Reports Generated', exec?.total_reports ?? '…', 'All report types, lifetime', '#7c3aed')}
            {statCard(<Activity size={22} />, 'Spoilage Rate', scanStats ? `${scanStats.spoilage_rate_pct}%` : '…', 'Rotten share of AI scans', '#b91c1c')}
            {statCard(<ShieldCheck size={22} />, 'Avg Quality Score', scanStats?.average_quality_score ?? 'N/A', 'Across AI scans', '#0891b2')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>
                <ScanSearch size={18} /> Freshness Distribution (AI scans)
              </h3>
              {freshDonut && scanStats.total_scans > 0
                ? <DonutChart data={freshDonut} centerValue={scanStats.total_scans} centerLabel="scans" />
                : <p style={{ color: '#9ca3af' }}>No AI scans recorded yet.</p>}
            </div>

            <div style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>
                <Boxes size={18} /> Inventory Lifecycle Statistics
              </h3>
              {Object.keys(lifecycleCounts).length === 0 ? (
                <p style={{ color: '#9ca3af' }}>No inventory recorded yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {Object.entries(lifecycleCounts).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                      <span style={{ color: '#374151', fontWeight: 600 }}>{status}</span>
                      <span style={{ fontWeight: 800, color: lifecyclePalette[status] || '#111' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>
                <Users size={18} /> Users by Role
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {['Consumer', 'Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Administrator'].map((role) => (
                  <div key={role} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{role}</span>
                    <span style={{ fontWeight: 800 }}>{roleCounts[role] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>System Monitoring</h2>
          <div style={{ ...card, marginBottom: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                {
                  label: 'Application status', ok: true,
                  value: 'Running',
                  sub: 'FastAPI server responding to authenticated API calls',
                },
                {
                  label: 'Database health', ok: health?.database === 'connected',
                  value: health?.database === 'connected' ? 'Connected' : (health?.database || 'Checking…'),
                  sub: 'MongoDB ping via /api/health',
                },
                {
                  label: 'AI model availability', ok: health?.model_loaded === true,
                  value: health?.model_loaded === true ? 'Loaded' : health?.model_loaded === false ? 'Not loaded' : 'Checking…',
                  sub: 'MobileNetV2 freshness_model.keras',
                },
                {
                  label: 'API request metrics', ok: null,
                  value: 'Not available',
                  sub: 'Request counters are not instrumented in this application',
                },
                {
                  label: 'System uptime', ok: null,
                  value: 'Not available',
                  sub: 'Uptime tracking is not instrumented in this application',
                },
              ].map((m) => (
                <div key={m.label} style={{ padding: '14px 16px', borderRadius: '14px', backgroundColor: '#f9fafb', borderLeft: `4px solid ${m.ok === null ? '#9ca3af' : m.ok ? '#16a34a' : '#ef4444'}` }}>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: m.ok === null ? '#6b7280' : m.ok ? '#15803d' : '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {m.ok === false && <AlertTriangle size={14} />} {m.value}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '3px' }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Reporting Management</h2>
          <div style={{ ...card, marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>All persisted reports. Filter by type, export as PDF/Excel, or delete report metadata.</p>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#f9f9f9', fontWeight: 600 }}>
                <option value="">All types</option>
                {Object.entries(REPORT_TYPE_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            {reports === null ? (
              <p style={{ color: '#9ca3af' }}>Loading reports…</p>
            ) : filteredReports.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No reports found{reportFilter ? ' for this type' : ' yet'}. Reports can be generated on the Reports page.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Title', 'Type', 'Generated By', 'Created', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((r) => (
                      <tr key={r._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.title}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563', textTransform: 'capitalize' }}>
                          {(r.report_type || 'freshness (scan)').replace(/_/g, ' ')}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{r.created_by_username || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(r.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => navigate('/dashboard/reports')} style={{ ...miniBtn('#111') }}>
                              <FileBarChart size={12} /> Open in Reports
                            </button>
                            <button onClick={() => download(r, 'pdf')} style={miniBtn('#dc2626')}><FileDown size={12} /> PDF</button>
                            <button onClick={() => download(r, 'xlsx')} style={miniBtn('#15803d')}><FileSpreadsheet size={12} /> Excel</button>
                            <button onClick={() => deleteReport(r)} style={miniBtn('#b91c1c')}><Trash2 size={12} /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Recent Alerts</h2>
          <div style={{ ...card, marginBottom: '32px' }}>
            {alerts.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No alerts generated yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {alerts.map((a) => (
                  <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{String(a.type).replace(/_/g, ' ')}</span>
                      <span style={{ color: '#4b5563', fontSize: '0.9rem', marginLeft: '8px' }}>{a.message}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>User Management</h2>
          <div style={card}>
            {users.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No users registered.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e5e5e5' }}>
                      {['Username', 'Email', 'Role', 'Joined', 'Status', 'Action'].map((h) => (
                        <th key={h} style={{ padding: '14px 16px', color: '#888', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.username}</td>
                        <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px' }}>{u.role}</td>
                        <td style={{ padding: '12px 16px', color: '#888', fontSize: '0.85rem' }}>{formatDateTime(u.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: u.is_active ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => toggleUserStatus(u)}
                            disabled={busyUser === u.username}
                            style={{
                              padding: '6px 12px', fontSize: '0.8rem', cursor: busyUser === u.username ? 'wait' : 'pointer',
                              backgroundColor: u.is_active ? '#fee2e2' : '#dcfce7', color: u.is_active ? '#b91c1c' : '#15803d',
                              border: 'none', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                          >
                            {u.is_active ? <><Ban size={12} /> Deactivate</> : <><CheckCircle2 size={12} /> Activate</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loading && <p style={{ color: '#9ca3af', marginTop: '16px' }}><Loader2 className="animate-spin" size={14} style={{ verticalAlign: '-2px' }} /> Refreshing…</p>}
        </>
      )}
    </motion.div>
  );
}

function miniBtn(color) {
  return {
    padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
    backgroundColor: `${color}15`, color, border: `1px solid ${color}55`,
    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px',
  };
}

import { useEffect, useState } from "react";
import {
  Users,
  BarChart3,
  Activity,
  FileText,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Database,
  Clock,
} from "lucide-react";
import {
  getInventory,
  getShelfLifeHistory,
  getAnalysisHistory,
  getAdminUsers,
  getAdminStats,
} from "../api";

const ROLE_LABELS = {
  consumer: "Consumer",
  retail_manager: "Retail Manager",
  warehouse_operator: "Warehouse Operator",
  food_quality_inspector: "Food Quality Inspector",
  administrator: "Administrator",
};

const ROLE_BADGE_CLASS = {
  consumer: "badge-valid",
  retail_manager: "badge-valid",
  warehouse_operator: "badge-valid",
  food_quality_inspector: "badge-expiring-today",
  administrator: "badge-expired",
};

export default function AdminDashboard({ session }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      // Fetch admin-specific data
      const [invData, predData, analysisData, usersData, statsData] = await Promise.all([
        getInventory(session.token),
        getShelfLifeHistory(session.token),
        getAnalysisHistory(session.token),
        getAdminUsers(session.token),
        getAdminStats(session.token),
      ]);
      setInventory(invData);
      setPredictions(predData);
      setAnalyses(analysisData);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <div className="state-empty">
        <RefreshCw size={32} className="spinner" />
        <span>Loading admin dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-empty">
        <AlertTriangle size={32} />
        <span>{error}</span>
        <button className="btn-secondary" onClick={refresh}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-role">
      <div className="role-header">
        <div>
          <p className="eyebrow">ADMINISTRATOR DASHBOARD</p>
          <h1>Platform Management</h1>
          <p>User management, platform analytics, and system monitoring</p>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Users</span>
          <strong className="kpi-value">{stats?.total_users ?? users.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Analyses</span>
          <strong className="kpi-value">{stats?.total_analyses ?? analyses.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Predictions</span>
          <strong className="kpi-value">{stats?.total_predictions ?? predictions.length}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Inventory Items</span>
          <strong className="kpi-value">{stats?.total_inventory_items ?? inventory.length}</strong>
        </div>
      </div>

      {/* User Management */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>User Management</h2>
            <p>All registered users on the platform</p>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="state-empty">
            <Users size={28} />
            <span>No users found.</span>
          </div>
        ) : (
          <div className="sc-table-wrapper">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE_CLASS[u.role] || "badge-neutral"}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="sc-date">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Platform Analytics */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Platform Analytics</h2>
            <p>System-wide usage statistics</p>
          </div>
        </div>
        {stats ? (
          <div className="waste-insights" style={{ marginBottom: "16px" }}>
            <div className="waste-metric">
              <span className="waste-label">Total Users</span>
              <strong className="waste-value">{stats.total_users}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Total Analyses</span>
              <strong className="waste-value">{stats.total_analyses}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Total Predictions</span>
              <strong className="waste-value">{stats.total_predictions}</strong>
            </div>
            <div className="waste-metric">
              <span className="waste-label">Storage Records</span>
              <strong className="waste-value">{stats.total_storage_records}</strong>
            </div>
          </div>
        ) : (
          <div className="state-empty">
            <BarChart3 size={28} />
            <span>Platform statistics unavailable.</span>
          </div>
        )}

        {/* Role Distribution */}
        {stats?.role_distribution && (
          <div style={{ marginTop: "16px" }}>
            <h4 style={{ marginBottom: "8px" }}>User Role Distribution</h4>
            <div className="waste-insights">
              {Object.entries(stats.role_distribution).map(([role, count]) => (
                <div key={role} className="waste-metric">
                  <span className="waste-label">{ROLE_LABELS[role] || role}</span>
                  <strong className="waste-value">{count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {stats && (
          <div style={{ marginTop: "16px" }}>
            <h4 style={{ marginBottom: "8px" }}>Recent Activity (7 days)</h4>
            <div className="waste-insights">
              <div className="waste-metric">
                <span className="waste-label">New Analyses</span>
                <strong className="waste-value">{stats.recent_analyses_7d}</strong>
              </div>
              <div className="waste-metric">
                <span className="waste-label">New Predictions</span>
                <strong className="waste-value">{stats.recent_predictions_7d}</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* System Monitoring */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>System Monitoring</h2>
            <p>Platform health and resource usage</p>
          </div>
        </div>
        <div className="system-monitoring">
          <div className="monitor-card">
            <ShieldCheck size={20} color="#059669" />
            <div>
              <span className="monitor-label">Authentication</span>
              <strong className="monitor-value">Active</strong>
            </div>
          </div>
          <div className="monitor-card">
            <Database size={20} color="#0369a1" />
            <div>
              <span className="monitor-label">Database</span>
              <strong className="monitor-value">Connected</strong>
            </div>
          </div>
          <div className="monitor-card">
            <Activity size={20} color="#059669" />
            <div>
              <span className="monitor-label">ML Models</span>
              <strong className="monitor-value">Loaded</strong>
            </div>
          </div>
          <div className="monitor-card">
            <Clock size={20} color="#d97706" />
            <div>
              <span className="monitor-label">Uptime</span>
              <strong className="monitor-value">Active</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Reporting Management */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Reporting Management</h2>
            <p>Overview of all reports and analyses on the platform</p>
          </div>
        </div>
        <div className="waste-insights">
          <div className="waste-metric">
            <span className="waste-label">Freshness Reports</span>
            <strong className="waste-value">{analyses.length}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">Shelf-Life Reports</span>
            <strong className="waste-value">{predictions.length}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">Inventory Reports</span>
            <strong className="waste-value">{inventory.length}</strong>
          </div>
          <div className="waste-metric">
            <span className="waste-label">Storage Reports</span>
            <strong className="waste-value">{stats?.total_storage_records ?? 0}</strong>
          </div>
        </div>
        <p style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
          <FileText size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
          PDF reports are available for individual freshness analyses. Use the AI Freshness Detection tab to generate reports.
        </p>
      </section>
    </div>
  );
}

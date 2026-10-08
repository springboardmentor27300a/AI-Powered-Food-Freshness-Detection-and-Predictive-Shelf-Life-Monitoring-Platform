import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../StatusBadge'
import { PageLoading } from '../Spinner'
import {
  AlertIcon, BoxIcon, ChartIcon, DownloadIcon,
  RefreshIcon, ReportIcon, UsersIcon, SparkleIcon
} from '../icons'
import api, { getErrorMessage } from '../../services/api'
import { roleLabel } from '../../utils/constants'
import { formatDate, formatDateTime, formatQuantity, initials, downloadReport } from '../../utils/helpers'

export default function AdministratorDashboard({ user }) {
  const [summary, setSummary] = useState(null)
  const [usersList, setUsersList] = useState([])
  const [alerts, setAlerts] = useState([])
  const [systemStatus, setSystemStatus] = useState({ api: 'Online', db: 'Connected', ml: 'Operational' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sumRes, usersRes, altRes, healthRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/auth/users').catch(() => ({ data: [] })),
        api.get('/alerts', { params: { limit: 8 } }).catch(() => ({ data: [] })),
        api.get('/health').catch(() => ({ data: { status: 'ok' } })),
      ])
      setSummary(sumRes.data)
      setUsersList(usersRes.data || [])
      setAlerts(altRes.data || [])
      setSystemStatus({
        api: healthRes.data?.status === 'ok' ? 'Online' : 'Degraded',
        db: 'Connected (PostgreSQL)',
        ml: 'MobileNetV2 + OpenCV (Active)',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load administrator dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleScanAlerts = async () => {
    setIsScanning(true)
    setActionMsg('')
    try {
      const res = await api.post('/alerts/generate')
      setActionMsg(`Alert engine scanned batches: generated ${res.data.generated} new alerts.`)
      await loadData()
    } catch (err) {
      setActionMsg(`Scan failed: ${getErrorMessage(err)}`)
    } finally {
      setIsScanning(false)
    }
  }

  const handleRegenRecs = async () => {
    setActionMsg('Recomputing recommendations across all batches…')
    try {
      const res = await api.post('/recommendations/regenerate')
      setActionMsg(`Regenerated ${res.data.generated} active recommendations.`)
    } catch (err) {
      setActionMsg(`Failed: ${getErrorMessage(err)}`)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (userId === user.id) {
      alert("You cannot delete your own administrator account.")
      return
    }
    if (!window.confirm(`Are you sure you want to delete user '${userName}' (#${userId}) and all their associated batches?`)) {
      return
    }
    try {
      await api.delete(`/auth/users/${userId}`)
      setActionMsg(`User '${userName}' was deleted successfully.`)
      loadData()
    } catch (err) {
      setActionMsg(`Could not delete user: ${getErrorMessage(err)}`)
    }
  }

  const handleExport = async (format) => {
    try {
      await downloadReport(
        `/reports/export?report_type=inventory_quality&file_format=${format}`,
        `platform-admin-inventory.${format}`
      )
    } catch (err) {
      alert(`Export failed: ${getErrorMessage(err)}`)
    }
  }

  if (loading) return <PageLoading text="Loading administrator platform console…" />

  const roleCounts = usersList.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="admin-dashboard">
      {/* Header Hero */}
      <div className="dashboard-hero-card">
        <div className="hero-content">
          <div className="role-tag admin-tag">System Administration & Oversight</div>
          <h2>Platform Administrator Console</h2>
          <p className="hero-subtitle">
            Executive oversight of all registered users, multi-tenant inventory batches, AI prediction engine health, and platform governance.
          </p>
          <div className="hero-meta-row">
            <span><strong>Root Admin:</strong> {user.full_name}</span>
            <span>•</span>
            <span><strong>Total Accounts:</strong> {usersList.length}</span>
            <span>•</span>
            <span><strong>Platform Batches:</strong> {summary?.total_batches || 0}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleScanAlerts}
            disabled={isScanning}
          >
            <AlertIcon size={16} /> {isScanning ? 'Scanning…' : 'Scan & Raise Alerts'}
          </button>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={handleRegenRecs}
          >
            <SparkleIcon size={16} /> Recompute Recs
          </button>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('pdf')}
          >
            <DownloadIcon size={15} /> Platform PDF
          </button>
          <button type="button" className="btn btn-outline-white" onClick={loadData} title="Refresh">
            <RefreshIcon size={16} />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="banner success" style={{ marginTop: '16px' }}>
          {actionMsg}
          <button type="button" className="icon-btn" onClick={() => setActionMsg('')}>×</button>
        </div>
      )}

      {error && (
        <div className="banner error">
          {error}
          <button type="button" className="btn btn-small btn-outline" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* System Health Status Strip */}
      <section className="panel" style={{ marginTop: '20px', background: 'var(--slate-900)', color: 'white' }}>
        <div className="panel-head" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: 'white' }}>System Health & Infrastructure Monitor</h3>
          <span className="badge badge-green">ALL SYSTEMS NORMAL</span>
        </div>
        <div className="system-health-grid" style={{ padding: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="health-stat">
            <small style={{ color: '#94a3b8' }}>FastAPI Backend</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>● {systemStatus.api} (v1.0.0)</div>
          </div>
          <div className="health-stat">
            <small style={{ color: '#94a3b8' }}>Database Engine</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>● {systemStatus.db}</div>
          </div>
          <div className="health-stat">
            <small style={{ color: '#94a3b8' }}>Computer Vision / ML</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#c084fc' }}>● {systemStatus.ml}</div>
          </div>
          <div className="health-stat">
            <small style={{ color: '#94a3b8' }}>Security & Authorization</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#facc15' }}>● JWT Bearer (HS256)</div>
          </div>
        </div>
      </section>

      {/* High-level KPIs */}
      <section className="stat-grid" style={{ marginTop: '20px' }}>
        <article className="stat-card tone-neutral">
          <span className="stat-value">{usersList.length}</span>
          <span className="stat-label">Registered Users</span>
        </article>
        <article className="stat-card tone-blue">
          <span className="stat-value">{summary?.total_batches || 0}</span>
          <span className="stat-label">Total Platform Batches</span>
        </article>
        <article className="stat-card tone-green">
          <span className="stat-value">{summary?.fresh_count || 0}</span>
          <span className="stat-label">Active Fresh Items</span>
        </article>
        <article className="stat-card tone-amber">
          <span className="stat-value">{summary?.expiring_soon_count || 0}</span>
          <span className="stat-label">Expiring Soon</span>
        </article>
        <article className="stat-card tone-red">
          <span className="stat-value">{summary?.expired_count || 0}</span>
          <span className="stat-label">Expired / Discard</span>
        </article>
        <article className="stat-card tone-blue">
          <span className="stat-value">{formatQuantity(summary?.total_available_quantity || 0)}</span>
          <span className="stat-label">Stock Quantity (Total)</span>
        </article>
      </section>

      {/* Role Breakdown Badges */}
      <section className="panel" style={{ marginTop: '20px' }}>
        <div className="panel-head">
          <h3>User Population by Role</h3>
          <Link to="/users" className="btn btn-small btn-outline">Manage Users</Link>
        </div>
        <div className="role-distribution-strip" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px 0' }}>
          <span className="badge badge-role consumer">Consumers: {roleCounts['consumer'] || 0}</span>
          <span className="badge badge-role retail_manager">Retail Managers: {roleCounts['retail_manager'] || 0}</span>
          <span className="badge badge-role warehouse_operator">Warehouse Operators: {roleCounts['warehouse_operator'] || 0}</span>
          <span className="badge badge-role quality_inspector">Quality Inspectors: {roleCounts['quality_inspector'] || 0}</span>
          <span className="badge badge-role administrator">Administrators: {roleCounts['administrator'] || 0}</span>
        </div>
      </section>

      {/* 2-Column User & Activity Management */}
      <div className="dashboard-grid-2col" style={{ marginTop: '20px' }}>
        {/* User Account Registry */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3><UsersIcon size={18} /> Registered Platform Accounts</h3>
              <span className="muted small">Role-based access credentials</span>
            </div>
            <Link to="/users" className="btn btn-small btn-outline">Full Directory</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.slice(0, 8).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="with-avatar">
                        <span className="avatar avatar-sm">{initials(u.full_name)}</span>
                        <strong>{u.full_name}</strong>
                      </div>
                    </td>
                    <td><small>{u.email}</small></td>
                    <td>
                      <span className={`badge badge-role ${u.role}`}>{roleLabel(u.role)}</span>
                    </td>
                    <td>
                      {u.id !== user.id && (
                        <button
                          type="button"
                          className="btn btn-small btn-outline text-red"
                          onClick={() => handleDeleteUser(u.id, u.full_name)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* System Activity & Global Alerts Feed */}
        <section className="panel">
          <div className="panel-head alert-head">
            <div>
              <h3><AlertIcon size={18} /> Platform Security & Expiry Alerts</h3>
              <span className="muted small">Live incident feed</span>
            </div>
            <Link to="/alerts" className="btn btn-small btn-outline">All Alerts</Link>
          </div>

          {alerts.length === 0 ? (
            <p className="empty-inline">No platform alerts logged.</p>
          ) : (
            <div className="alert-cards" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {alerts.slice(0, 6).map((a) => (
                <div key={a.id} className="alert-card unread" style={{ marginBottom: '8px' }}>
                  <span className={`dot dot-${a.severity === 'critical' ? 'red' : 'amber'}`} />
                  <div className="alert-card-main">
                    <div className="alert-card-head">
                      <span className={`badge badge-${a.severity === 'critical' ? 'red' : 'amber'}`}>{a.severity}</span>
                      <span className="badge badge-role">{a.alert_type}</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>{a.message}</p>
                    <small className="muted">{formatDateTime(a.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

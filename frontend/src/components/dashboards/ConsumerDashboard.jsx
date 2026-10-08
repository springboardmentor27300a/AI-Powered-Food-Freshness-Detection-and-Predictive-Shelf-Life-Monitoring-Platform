import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../StatusBadge'
import { PageLoading } from '../Spinner'
import { AlertIcon, CameraIcon, PlusCircleIcon, RefreshIcon, SparkleIcon, PulseIcon, ReportIcon, UserIcon } from '../icons'
import api, { getErrorMessage } from '../../services/api'
import { formatDate, describeExpiry, formatQuantity, formatScore } from '../../utils/helpers'

export default function ConsumerDashboard({ user }) {
  const [summary, setSummary] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [alerts, setAlerts] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sumRes, anaRes, altRes, recRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/analysis/history', { params: { limit: 5 } }).catch(() => ({ data: [] })),
        api.get('/alerts', { params: { limit: 5, unread_only: false } }).catch(() => ({ data: [] })),
        api.get('/recommendations', { params: { limit: 5 } }).catch(() => ({ data: [] })),
      ])
      setSummary(sumRes.data)
      setAnalyses(anaRes.data || [])
      setAlerts(altRes.data || [])
      setRecommendations(recRes.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load consumer dashboard data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) return <PageLoading text="Loading your fresh food dashboard…" />

  const cards = summary && [
    { label: 'My Food Items', value: summary.total_batches, tone: 'neutral' },
    { label: 'Fresh & Good', value: summary.fresh_count, tone: 'green' },
    { label: 'Expiring Soon', value: summary.expiring_soon_count, tone: 'amber' },
    { label: 'Expired / Spoilage Warning', value: summary.expired_count, tone: 'red' },
    { label: 'Total Quantity', value: `${formatQuantity(summary.total_available_quantity)} units`, tone: 'blue' },
  ]

  return (
    <div className="consumer-dashboard">
      {/* Consumer Welcome Banner */}
      <div className="dashboard-hero-card">
        <div className="hero-content">
          <div className="role-tag consumer-tag">Consumer Kitchen Dashboard</div>
          <h2>Hello, {user.full_name}! 👋</h2>
          <p className="hero-subtitle">
            Track household food freshness, inspect expiry horizons, and reduce kitchen waste with AI assistance.
          </p>
          <div className="hero-meta-row">
            <span><strong>Email:</strong> {user.email}</span>
            <span>•</span>
            <span><strong>Total Items Tracked:</strong> {summary?.total_batches || 0}</span>
          </div>
        </div>
        <div className="hero-actions">
          <Link to="/add-food-item" className="btn btn-primary">
            <PlusCircleIcon size={16} /> Register Food
          </Link>
          <Link to="/freshness-analysis" className="btn btn-outline-white">
            <CameraIcon size={16} /> Analyze Food Image
          </Link>
          <button type="button" className="btn btn-outline-white" onClick={loadData} title="Refresh">
            <RefreshIcon size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="banner error">
          {error}
          <button type="button" className="btn btn-small btn-outline" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {cards && (
        <section className="stat-grid" style={{ marginTop: '20px' }}>
          {cards.map((c) => (
            <article key={c.label} className={`stat-card tone-${c.tone}`}>
              <span className="stat-value">{c.value}</span>
              <span className="stat-label">{c.label}</span>
            </article>
          ))}
        </section>
      )}

      {/* Main 2-column layout */}
      <div className="dashboard-grid-2col" style={{ marginTop: '24px' }}>
        {/* Left Column: My Food Items & Expiry */}
        <div className="col-stack">
          {/* Registered Food Items */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>My Food Items</h3>
                <span className="muted small">Your active pantry & refrigerator stock</span>
              </div>
              <div className="btn-row">
                <Link to="/inventory" className="btn btn-small btn-outline">View Inventory</Link>
                <Link to="/add-food-item" className="btn btn-small btn-primary">+ Add Item</Link>
              </div>
            </div>

            {(!summary?.recent_batches || summary.recent_batches.length === 0) ? (
              <div className="empty-state">
                <p>No food registered in your pantry yet.</p>
                <Link to="/add-food-item" className="btn btn-small btn-primary">Register your first item</Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Food Name</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_batches.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.food_name}</strong>
                          <div className="muted small"><code>{b.batch_id}</code></div>
                        </td>
                        <td>{b.category}</td>
                        <td>{formatQuantity(b.available_quantity)} {b.unit}</td>
                        <td>
                          <div>{formatDate(b.expiry_date)}</div>
                          <small className="muted">{describeExpiry(b.expiry_date)}</small>
                        </td>
                        <td><StatusBadge status={b.freshness_status} /></td>
                        <td>
                          <Link to={`/freshness-analysis/${b.batch_id}`} className="btn btn-small btn-outline" title="Analyze Freshness">
                            <CameraIcon size={14} /> Scan
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Expiry Alerts & Spoilage Warnings */}
          <section className="panel">
            <div className="panel-head alert-head">
              <h3><AlertIcon size={18} /> Spoilage Warnings & Expiry Alerts</h3>
              <span className="muted small">Items needing immediate consumption</span>
            </div>
            {(!summary?.expiring_alerts || summary.expiring_alerts.length === 0) ? (
              <p className="empty-inline">🎉 Great job! No items are at risk of spoiling soon.</p>
            ) : (
              <ul className="alert-list">
                {summary.expiring_alerts.map((b) => (
                  <li key={b.batch_id} className="alert-row">
                    <span className={`dot ${b.freshness_status === 'Expired' ? 'dot-red' : 'dot-amber'}`} />
                    <div className="alert-main">
                      <strong>{b.food_name}</strong>
                      <small>{b.batch_id} • Location: {b.storage_location}</small>
                    </div>
                    <span className="alert-expiry">{describeExpiry(b.expiry_date)}</span>
                    <StatusBadge status={b.freshness_status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column: Recommendations, Recent Analyses, Quick Actions */}
        <div className="col-stack">
          {/* Storage & Consumption Recommendations */}
          <section className="panel">
            <div className="panel-head">
              <h3><SparkleIcon size={18} /> Storage & Consumption Recommendations</h3>
              <Link to="/recommendations" className="btn btn-small btn-outline">All Tips</Link>
            </div>
            {recommendations.length === 0 ? (
              <div className="empty-inline">
                <p>No active recommendations right now.</p>
                <small className="muted">Record storage conditions or analyze food images to get smart advice.</small>
              </div>
            ) : (
              <div className="rec-card-list">
                {recommendations.slice(0, 4).map((r) => (
                  <div key={r.id} className={`rec-chip-item priority-${r.priority}`}>
                    <div className="rec-header-row">
                      <span className="badge badge-role">{r.category?.toUpperCase() || 'RECOMMENDATION'}</span>
                      <span className={`badge badge-${r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'green'}`}>
                        {r.priority}
                      </span>
                    </div>
                    <p className="rec-text">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent AI Freshness Inspections */}
          <section className="panel">
            <div className="panel-head">
              <h3><CameraIcon size={18} /> Recent Freshness Analyses</h3>
              <Link to="/reports" className="btn btn-small btn-outline">Reports</Link>
            </div>
            {analyses.length === 0 ? (
              <div className="empty-state">
                <p>No food images scanned yet.</p>
                <Link to="/freshness-analysis" className="btn btn-small btn-primary">Take/Upload Photo</Link>
              </div>
            ) : (
              <div className="recent-analyses-list">
                {analyses.map((a) => (
                  <div key={a.id} className="analysis-summary-row">
                    <div className="analysis-food-badge">
                      <strong>{a.food_name}</strong>
                      <small className="muted">{a.food_category || 'General'}</small>
                    </div>
                    <div className="analysis-scores">
                      <span className={`badge ${a.classification === 'Fresh' ? 'badge-green' : a.classification === 'Good' ? 'badge-blue' : 'badge-amber'}`}>
                        {a.classification}
                      </span>
                      <span className="score-number">{formatScore(a.freshness_score)}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Consumer Quick Actions Nav Card */}
          <section className="panel quick-actions-panel">
            <div className="panel-head">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <Link to="/freshness-analysis" className="action-tile">
                <CameraIcon size={20} />
                <span>AI Scan</span>
              </Link>
              <Link to="/shelf-life" className="action-tile">
                <PulseIcon size={20} />
                <span>Shelf-Life</span>
              </Link>
              <Link to="/reports" className="action-tile">
                <ReportIcon size={20} />
                <span>Reports</span>
              </Link>
              <Link to="/profile" className="action-tile">
                <UserIcon size={20} />
                <span>My Profile</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

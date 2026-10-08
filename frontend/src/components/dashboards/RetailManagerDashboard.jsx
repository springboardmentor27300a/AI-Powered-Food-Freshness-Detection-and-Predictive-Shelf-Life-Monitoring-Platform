import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../StatusBadge'
import { PageLoading } from '../Spinner'
import { BarChart, StatusPill } from '../Charts'
import {
  AlertIcon, BoxIcon, CameraIcon, ChartIcon, DownloadIcon,
  PlusCircleIcon, RefreshIcon, ReportIcon, SparkleIcon
} from '../icons'
import api, { getErrorMessage } from '../../services/api'
import { formatDate, describeExpiry, formatQuantity, formatScore, riskBadge, downloadReport } from '../../utils/helpers'

export default function RetailManagerDashboard({ user }) {
  const [summary, setSummary] = useState(null)
  const [insights, setInsights] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sumRes, insRes, altRes, recRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/insights/inventory'),
        api.get('/alerts', { params: { limit: 6 } }).catch(() => ({ data: [] })),
        api.get('/recommendations', { params: { limit: 6 } }).catch(() => ({ data: [] })),
      ])
      setSummary(sumRes.data)
      setInsights(insRes.data)
      setAlerts(altRes.data || [])
      setRecommendations(recRes.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load retail manager dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExport = async (type, format) => {
    setDownloading(`${type}-${format}`)
    try {
      await downloadReport(
        `/reports/export?report_type=${type}&file_format=${format}`,
        `retail-${type}-report.${format}`
      )
    } catch (err) {
      alert(`Export failed: ${getErrorMessage(err)}`)
    } finally {
      setDownloading('')
    }
  }

  if (loading) return <PageLoading text="Loading retail operations dashboard…" />

  const kpis = insights && [
    { label: 'Total Inventory Items', value: insights.total_products, tone: 'neutral' },
    { label: 'Fresh Stock', value: insights.fresh_count, tone: 'green' },
    { label: 'Acceptable / Good', value: insights.acceptable_count, tone: 'blue' },
    { label: 'Near Spoilage / Attention', value: insights.needs_attention_count, tone: 'amber' },
    { label: 'Spoiled / Discard', value: insights.spoiled_count, tone: 'red' },
    { label: 'Waste Risk Items', value: insights.at_risk_count, tone: 'red' },
    { label: 'Expiring ≤ 7 Days', value: insights.expiring_within_7_count, tone: 'amber' },
    { label: 'Avg Freshness Score', value: `${formatScore(insights.average_freshness_score)}/100`, tone: 'blue' },
  ]

  const byCat = (insights && insights.by_category) || {}
  const catItems = Object.entries(byCat).map(([label, value]) => ({ label, value }))

  return (
    <div className="retail-dashboard">
      {/* Header Banner */}
      <div className="dashboard-hero-card">
        <div className="hero-content">
          <div className="role-tag manager-tag">Retail Operations & Store Management</div>
          <h2>Retail Store Inventory Overview</h2>
          <p className="hero-subtitle">
            Monitor product freshness, prevent perishable waste with FIFO/FEFO rotation, and trigger markdowns before spoilage.
          </p>
          <div className="hero-meta-row">
            <span><strong>Store Manager:</strong> {user.full_name}</span>
            <span>•</span>
            <span><strong>Total Monitored Quantity:</strong> {formatQuantity(summary?.total_available_quantity || 0)} units</span>
          </div>
        </div>
        <div className="hero-actions">
          <Link to="/add-food-item" className="btn btn-primary">
            <PlusCircleIcon size={16} /> Add Food Product
          </Link>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('inventory_quality', 'pdf')}
            disabled={!!downloading}
          >
            <DownloadIcon size={15} /> Quality PDF
          </button>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('waste_reduction', 'xlsx')}
            disabled={!!downloading}
          >
            <DownloadIcon size={15} /> Waste XLSX
          </button>
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

      {/* KPI Cards Grid */}
      {kpis && (
        <section className="stat-grid" style={{ marginTop: '20px' }}>
          {kpis.map((k) => (
            <article key={k.label} className={`stat-card tone-${k.tone}`}>
              <span className="stat-value">{k.value}</span>
              <span className="stat-label">{k.label}</span>
            </article>
          ))}
        </section>
      )}

      {/* 2-Column Operational Grid */}
      <div className="dashboard-grid-2col" style={{ marginTop: '24px' }}>
        {/* Left Column: Waste Risk Items & FIFO Rotation */}
        <div className="col-stack">
          {/* Waste-Risk Products Requiring Action */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3><AlertIcon size={18} /> Waste-Risk Products & Markdowns</h3>
                <span className="muted small">High/Critical spoilage probability items</span>
              </div>
              <Link to="/reports" className="btn btn-small btn-outline">Reports</Link>
            </div>

            {(!insights?.waste_risk_items || insights.waste_risk_items.length === 0) ? (
              <p className="empty-inline">✅ No high-risk items detected in active stock.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Risk</th>
                      <th>Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.waste_risk_items.map((it) => (
                      <tr key={it.batch_id}>
                        <td>
                          <strong>{it.food_name}</strong>
                          <div className="muted small"><code>{it.batch_id}</code></div>
                        </td>
                        <td>{it.category}</td>
                        <td>
                          <span className={it.remaining_days <= 1 ? 'text-red strong' : 'text-amber'}>
                            {it.remaining_days} day{it.remaining_days === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td><StatusPill status={it.freshness_status} /></td>
                        <td><span className={`badge ${riskBadge(it.spoilage_risk?.toLowerCase())}`}>{it.spoilage_risk}</span></td>
                        <td>
                          <span className="small strong">
                            {it.remaining_days <= 0 ? 'Isolate & Dispose' : it.remaining_days <= 1 ? '50% Immediate Markdown' : 'Front-Display Promotion'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* FIFO Inventory Rotation Recommendations */}
          <section className="panel">
            <div className="panel-head">
              <h3><SparkleIcon size={18} /> Inventory Rotation & Storage Alerts</h3>
              <Link to="/recommendations" className="btn btn-small btn-outline">All Insights</Link>
            </div>
            {recommendations.length === 0 ? (
              <p className="empty-inline">All inventory rotation rules are satisfied.</p>
            ) : (
              <div className="rec-card-list">
                {recommendations.map((r) => (
                  <div key={r.id} className={`rec-chip-item priority-${r.priority}`}>
                    <div className="rec-header-row">
                      <span className="badge badge-role">{r.category?.toUpperCase()}</span>
                      <span className={`badge badge-${r.priority === 'high' ? 'red' : 'green'}`}>{r.priority}</span>
                      {r.batch_id_ref && <span className="muted small">Batch: <code>{r.batch_id_ref}</code></span>}
                    </div>
                    <p className="rec-text">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Category Distribution, Recent Batches & Quick Ops */}
        <div className="col-stack">
          {/* Inventory by Category Chart */}
          {catItems.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h3>Stock by Category</h3>
                <span className="muted small">Batch count</span>
              </div>
              <BarChart items={catItems} />
            </section>
          )}

          {/* Quick Operations Bar */}
          <section className="panel">
            <div className="panel-head">
              <h3>Retail Manager Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <Link to="/inventory" className="action-tile">
                <BoxIcon size={20} />
                <span>Inventory</span>
              </Link>
              <Link to="/freshness-analysis" className="action-tile">
                <CameraIcon size={20} />
                <span>AI Freshness</span>
              </Link>
              <Link to="/analytics" className="action-tile">
                <ChartIcon size={20} />
                <span>Analytics</span>
              </Link>
              <Link to="/reports" className="action-tile">
                <ReportIcon size={20} />
                <span>Reports</span>
              </Link>
            </div>
          </section>

          {/* Recent Store Batches */}
          <section className="panel">
            <div className="panel-head">
              <h3>Recent Food Batches</h3>
              <Link to="/inventory" className="btn btn-small btn-outline">View All</Link>
            </div>
            {(!summary?.recent_batches || summary.recent_batches.length === 0) ? (
              <p className="empty-inline">No batches registered.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Food</th>
                      <th>Qty</th>
                      <th>Expiry</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_batches.slice(0, 5).map((b) => (
                      <tr key={b.id}>
                        <td><code>{b.batch_id}</code></td>
                        <td><strong>{b.food_name}</strong></td>
                        <td>{formatQuantity(b.available_quantity)} {b.unit}</td>
                        <td>{formatDate(b.expiry_date)}</td>
                        <td><StatusBadge status={b.freshness_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

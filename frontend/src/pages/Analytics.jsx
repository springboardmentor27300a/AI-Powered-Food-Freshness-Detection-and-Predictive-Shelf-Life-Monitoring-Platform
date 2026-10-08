/**
 * Analytics Dashboard (Milestone 3).
 *
 * Global view of the inventory: freshness / risk / expiry distributions,
 * storage parameter compliance, and freshness & shelf-life trend lines drawn
 * from the persisted prediction history.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { BarChart, DonutChart, LineChart, StatusPill } from '../components/Charts'
import { PageLoading } from '../components/Spinner'
import { RefreshIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { formatDate, formatScore, riskBadge } from '../utils/helpers'

const DONUT_COLORS = {
  Fresh: 'var(--green-500)',
  Acceptable: '#0ea5e9',
  'Needs Attention': 'var(--amber-600)',
  Spoiled: 'var(--red-500)',
}
const RISK_COLORS = {
  low: 'var(--green-500)',
  moderate: 'var(--amber-600)',
  high: 'var(--red-500)',
  critical: '#7f1d1d',
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const res = await api.get('/analytics/dashboard')
      setData(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLoading text="Building dashboard…" />
  if (!data) return null

  const iv = data.inventory || {}
  const freshness = data.freshness || {}
  const shelf = data.shelf_life || {}
  const storage = data.storage || {}
  const risk = data.risk || {}
  const trends = data.trends || {}
  const series = data.series || []

  const freshnessItems = Object.keys(DONUT_COLORS)
    .filter((k) => freshness[k] > 0)
    .map((k) => ({ label: k, value: freshness[k], color: DONUT_COLORS[k] }))

  const riskItems = Object.keys(RISK_COLORS)
    .filter((k) => risk[k] > 0)
    .map((k) => ({ label: k, value: risk[k], color: RISK_COLORS[k] }))

  const shelfItems = [
    { label: 'Expired', value: shelf.expired || 0 },
    { label: '≤ 1 day', value: shelf.expiring_in_1_day || 0 },
    { label: '≤ 3 days', value: shelf.expiring_in_3_days || 0 },
    { label: '≤ 7 days', value: shelf.expiring_in_7_days || 0 },
    { label: 'Healthy >7d', value: shelf.healthy || 0 },
  ]

  const storageParams = ['temperature', 'humidity', 'air_circulation', 'light_exposure', 'duration', 'packaging', 'storage_environment']
  const storageItems = storageParams.map((p) => {
    const d = (storage.by_parameter || {})[p] || {}
    const good = d.good || 0
    return { label: p.replace('_', ' '), value: good, hint: `${good}/${storage.total_batches || 0} good` }
  })

  const freshnessLine = (trends.freshness_trend || []).length > 0
    ? [{ name: 'Freshness score', color: 'var(--green-600)', points: trends.freshness_trend }]
    : []
  const shelfLine = (trends.shelf_life_trend || []).length > 0
    ? [{ name: 'Remaining days', color: 'var(--blue-600)', points: trends.shelf_life_trend }]
    : []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Analytics Dashboard</h2>
          <p className="muted">Aggregated metrics as of {formatDate(data.as_of)} · scoped to your visible inventory.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={load}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      {banner && <div className={`banner ${banner.type}`}>{banner.text}</div>}

      <div className="stat-grid">
        <div className="stat-card tone-neutral">
          <div className="stat-value">{iv.total_products || 0}</div>
          <div className="stat-label">Inventory size</div>
        </div>
        <div className="stat-card tone-blue">
          <div className="stat-value">{formatScore(iv.average_freshness_score)}</div>
          <div className="stat-label">Avg freshness score</div>
        </div>
        <div className="stat-card tone-blue">
          <div className="stat-value">{formatScore(iv.average_shelf_life_days)}d</div>
          <div className="stat-label">Avg remaining shelf life</div>
        </div>
        <div className="stat-card tone-blue">
          <div className="stat-value">{formatScore(iv.average_storage_compliance)}</div>
          <div className="stat-label">Avg storage compliance</div>
        </div>
        <div className="stat-card tone-red">
          <div className="stat-value">{iv.at_risk_count || 0}</div>
          <div className="stat-label">At-risk batches</div>
        </div>
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><h3>Freshness Distribution</h3></div>
          {freshnessItems.length ? <DonutChart items={freshnessItems} centerLabel="batches" /> : <p className="empty-inline">No batches.</p>}
        </section>

        <section className="panel chart-panel">
          <div className="panel-head"><h3>Spoilage Risk</h3></div>
          {riskItems.length ? <DonutChart items={riskItems} centerLabel="batches" /> : <p className="empty-inline">No batches.</p>}
        </section>

        <section className="panel chart-panel">
          <div className="panel-head"><h3>Shelf-Life Outlook</h3></div>
          <BarChart items={shelfItems} />
        </section>

        <section className="panel chart-panel">
          <div className="panel-head"><h3>Storage Compliance by Parameter</h3></div>
          <BarChart items={storageItems} />
        </section>
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><h3>Freshness Trend</h3></div>
          {freshnessLine.length
            ? <LineChart series={freshnessLine} height={170} valueTicks={4} />
            : <p className="empty-inline">{trends.note || 'No trend data yet.'}</p>}
        </section>

        <section className="panel chart-panel">
          <div className="panel-head"><h3>Shelf-Life Trend</h3></div>
          {shelfLine.length
            ? <LineChart series={shelfLine} height={170} valueTicks={4} />
            : <p className="empty-inline">{trends.note || 'No trend data yet.'}</p>}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Inventory Snapshot</h3></div>
        {series.length === 0 ? (
          <p className="empty-inline">No batches in scope.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Batch</th><th>Category</th><th>Remaining</th><th>Registered Expiry</th><th>Risk</th><th>Status</th><th>Score</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.batch_id}>
                    <td>
                      <Link to={`/shelf-life/${s.batch_id}`} className="strong">{s.food_name}</Link>
                      <div className="table-sub muted small"><code>{s.batch_id}</code></div>
                    </td>
                    <td>{s.category}</td>
                    <td>{s.remaining_days} day{s.remaining_days === 1 ? '' : 's'}</td>
                    <td>{formatDate(s.expiry_date)}</td>
                    <td><span className={`badge ${riskBadge(s.risk?.toLowerCase())}`}>{s.risk}</span></td>
                    <td><StatusPill status={s.freshness_status} /></td>
                    <td className="strong">{formatScore(s.overall_score)}</td>
                    <td className="actions-col">
                      <Link to={`/shelf-life/${s.batch_id}`} className="btn btn-small btn-outline">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
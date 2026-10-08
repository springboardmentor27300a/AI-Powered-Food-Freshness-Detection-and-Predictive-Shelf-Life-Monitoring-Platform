/**
 * Shelf-Life Prediction (Milestone 3).
 *
 * List view  : every visible batch with its predicted remaining shelf life,
 *              expected expiry and spoilage risk, ranked soonest-first.
 * Detail view: full prediction breakdown, explainable factors, persisted
 *              freshness/shelf-life trend chart and PDF/Excel batch exports.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { LineChart, ScoreRing, StatusPill } from '../components/Charts'
import { PageLoading } from '../components/Spinner'
import { DownloadIcon, RefreshIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES } from '../utils/constants'
import { downloadReport, formatDate, formatQuantity, formatScore, riskBadge } from '../utils/helpers'

const RISK_OPTIONS = ['Low', 'Moderate', 'High', 'Critical']

function RiskBadge({ risk }) {
  return <span className={`badge ${riskBadge(String(risk).toLowerCase())}`}>{risk}</span>
}

export default function ShelfLife() {
  const { batchId } = useParams()
  return batchId ? <ShelfLifeDetail batchId={batchId} /> : <ShelfLifeList />
}

function ShelfLifeList() {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [risk, setRisk] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const params = {}
      if (debounced.trim()) params.q = debounced.trim()
      if (category) params.category = category
      if (risk) params.risk = risk
      const res = await api.get('/shelf-life', { params })
      setItems(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [debounced, category, risk])

  useEffect(() => { load() }, [load])

  const clearFilters = () => { setSearch(''); setCategory(''); setRisk('') }
  const hasFilters = Boolean(search || category || risk)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Shelf-Life Prediction</h2>
          <p className="muted">Rule-based estimate of remaining shelf life for every batch, ranked soonest-first.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      {banner && (
        <div className={`banner ${banner.type}`}>
          {banner.text}
          <button type="button" className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <input type="search" placeholder="Search by food name or batch ID…" value={search}
                 onChange={(e) => setSearch(e.target.value)} aria-label="Search batches" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All Categories</option>
          {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filter by risk">
          <option value="">All Risk Levels</option>
          {RISK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {hasFilters && <button type="button" className="btn btn-small btn-outline" onClick={clearFilters}>Clear</button>}
      </div>

      {loading ? (
        <PageLoading text="Computing predictions…" />
      ) : items && items.length === 0 ? (
        <div className="empty-state tall">
          <h3>{hasFilters ? 'No batches match your filters' : 'No batches to predict yet'}</h3>
          <p>{hasFilters ? 'Try adjusting the filters.' : 'Add a food batch to generate shelf-life predictions.'}</p>
        </div>
      ) : items && (
        <div className="table-wrap panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Remaining</th>
                <th>Expected Expiry</th>
                <th>Freshness Score</th>
                <th>Overall Status</th>
                <th>Risk</th>
                <th>Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.batch_id}>
                  <td>
                    <Link to={`/shelf-life/${it.batch_id}`} className="strong">{it.food_name}</Link>
                    <div className="table-sub muted small"><code>{it.batch_id}</code> · {it.category}</div>
                  </td>
                  <td>
                    <strong className={`text-${remainingTone(it.estimated_remaining_days)}`}>
                      {it.estimated_remaining_days} day{it.estimated_remaining_days === 1 ? '' : 's'}
                    </strong>
                  </td>
                  <td>
                    {formatDate(it.expected_expiry_date)}
                    <div className="table-sub muted small">calendar: {it.calendar_remaining_days}d</div>
                  </td>
                  <td>{it.freshness_score != null ? formatScore(it.freshness_score) : '—'}</td>
                  <td><StatusPill status={it.freshness_status} /></td>
                  <td><RiskBadge risk={it.spoilage_risk} /></td>
                  <td className="muted">{formatQuantity(it.available_quantity)} {it.unit}</td>
                  <td className="actions-col">
                    <Link to={`/shelf-life/${it.batch_id}`} className="btn btn-small btn-outline">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function remainingTone(days) {
  if (days <= 0) return 'red'
  if (days <= 3) return 'amber'
  if (days <= 7) return 'blue'
  return 'green'
}

function ShelfLifeDetail({ batchId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [downloading, setDownloading] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const res = await api.get(`/shelf-life/${batchId}`)
      setData(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => { load() }, [load])

  const download = async (reportType, format) => {
    setDownloading(`${reportType}-${format}`)
    try {
      await downloadReport(
        `/reports/export/${batchId}?report_type=${reportType}&file_format=${format}`,
        `${reportType}-${batchId}.${format}`
      )
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Export failed.') })
    } finally {
      setDownloading('')
    }
  }

  const series = data
    ? [
        {
          name: 'Freshness score',
          color: 'var(--green-600)',
          points: (data.history || []).filter((h) => h.freshness_score != null).map((h) => ({ date: h.predicted_on, value: h.freshness_score })),
        },
        {
          name: 'Remaining days',
          color: 'var(--blue-600)',
          points: (data.history || []).map((h) => ({ date: h.predicted_on, value: h.estimated_remaining_days })),
        },
      ].filter((s) => s.points.length > 0)
    : []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button type="button" className="btn btn-small btn-outline" onClick={() => navigate('/shelf-life')}>← Back</button>
          <h2 style={{ marginTop: 8 }}>Shelf Life · {data?.food_name || batchId}</h2>
          <p className="muted"><code>{batchId}</code> · {data?.category}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      {banner && <div className={`banner ${banner.type}`}>{banner.text}</div>}
      {loading ? <PageLoading text="Computing prediction…" /> : data && (
        <div className="grid-2col">
          <section className="panel">
            <div className="panel-head"><h3>Prediction Overview</h3></div>
            <div className="overview-row">
              <ScoreRing value={data.freshness_score ?? 0} label="Freshness" sub={`risk ${Math.round(data.risk_score ?? 0)}`} />
              <div className="overview-stats">
                <div className="overview-stat">
                  <span className="stat-value">{data.estimated_remaining_days}</span>
                  <span className="stat-label">estimated remaining days</span>
                </div>
                <div className="overview-stat">
                  <span className="stat-value">{formatDate(data.expected_expiry_date)}</span>
                  <span className="stat-label">expected expiry</span>
                </div>
                <div className="overview-stat">
                  <span className="stat-value blue">{data.calendar_remaining_days}d</span>
                  <span className="stat-label">registered expiry remaining</span>
                </div>
                <div className="overview-stat">
                  <span className="stat-value amber">{data.storage_delta_days >= 0 ? '+' : ''}{data.storage_delta_days}d</span>
                  <span className="stat-label">storage adjustment</span>
                </div>
              </div>
            </div>
            <div className="detail-list">
              <div><span>Shelf-life score</span><b>{formatScore(data.shelf_life_score)}</b></div>
              <div><span>Storage-condition score</span><b>{formatScore(data.storage_condition_score)}</b></div>
              <div><span>Base shelf life (category)</span><b>{data.base_shelf_life_days} days</b></div>
              <div><span>Spoilage risk</span><RiskBadge risk={data.spoilage_risk} /></div>
              <div><span>Risk score</span><b>{formatScore(data.risk_score)}/100</b></div>
              <div><span>Predicted on</span><b>{formatDate(data.predicted_on)}</b></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Why this estimate?</h3></div>
            <ul className="bullet-list">
              {(data.factors || []).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <div className="panel-head" style={{ marginTop: 16 }}><h3>Export</h3></div>
            <div className="btn-row">
              {[
                ['freshness', 'Freshness'],
                ['shelf_life', 'Shelf Life'],
                ['storage_compliance', 'Storage'],
              ].map(([type, label]) => (
                <button key={type} type="button" className="btn btn-small btn-outline"
                        disabled={!!downloading}
                        onClick={() => download(type, 'pdf')}>
                  <DownloadIcon /> {label} PDF
                </button>
              ))}
              <button type="button" className="btn btn-small btn-outline"
                      disabled={!!downloading}
                      onClick={() => download('freshness', 'xlsx')}>
                <DownloadIcon /> XLSX
              </button>
            </div>
          </section>
        </div>
      )}

      {data && series.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h3>Trend History</h3>
            <span className="muted small">Real persisted daily snapshots{user?.role === 'consumer' ? ' for this batch' : ''}</span>
          </div>
          <LineChart series={series} height={210} />
        </section>
      )}
      {data && series.length === 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>Trend History</h3></div>
          <p className="empty-inline">
            No daily snapshots recorded yet. Each visit to this page saves one prediction per day, so the trend builds up over time.
          </p>
        </section>
      )}

      {data && data.history && data.history.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>Saved Snapshots</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Remaining days</th><th>Expected expiry</th><th>Freshness score</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {[...data.history].reverse().map((h, i) => (
                  <tr key={i}>
                    <td>{formatDate(h.predicted_on)}</td>
                    <td>{h.estimated_remaining_days}</td>
                    <td>{formatDate(h.expected_expiry_date)}</td>
                    <td>{h.freshness_score != null ? formatScore(h.freshness_score) : '—'}</td>
                    <td><RiskBadge risk={h.spoilage_risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
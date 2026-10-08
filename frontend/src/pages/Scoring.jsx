/**
 * Freshness Scoring (Milestone 3).
 *
 * Weighted freshness score per batch across four pillars:
 *   Visual 40%  +  Storage 25%  +  Shelf-Life 20%  +  Product Age 15%.
 * Expand a row to see the pillar breakdown, weights and rule notes.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ScoreRing, StatusPill } from '../components/Charts'
import { PageLoading, Spinner } from '../components/Spinner'
import { RefreshIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES, SCORING_PILLARS } from '../utils/constants'
import { formatScore, getFreshnessTone, riskBadge } from '../utils/helpers'

const STATUS_OPTIONS = ['Fresh', 'Acceptable', 'Needs Attention', 'Spoiled']
const PILLAR_HINTS = {
  visual_condition_score: 'Visual quality of the batch',
  storage_condition_score: 'Live sensor compliance',
  shelf_life_score: 'Rule-based shelf-life prediction',
  product_age_score: 'Registered expiry headroom',
}

export default function Scoring() {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    setOpen({})
    try {
      const params = {}
      if (search.trim()) params.q = search.trim()
      if (category) params.category = category
      const res = await api.get('/shelf-life', { params })
      let rows = res.data
      if (status) rows = rows.filter((r) => r.freshness_status === status)
      setItems(rows)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, category, status])

  useEffect(() => { load() }, [load])

  const clearFilters = () => { setSearch(''); setCategory(''); setStatus('') }
  const hasFilters = Boolean(search || category || status)

  const toggle = async (batchId) => {
    setOpen((prev) => ({ ...prev, [batchId]: !prev[batchId] }))
  }

  const totals = items || []
  const avg = totals.length
    ? (totals.reduce((s, i) => s + Number(i.overall_score || 0), 0) / totals.length).toFixed(1)
    : '—'
  const counts = (status) => totals.filter((i) => i.freshness_status === status).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Freshness Scoring</h2>
          <p className="muted">Weighted overall-freshness score: Visual 40% · Storage 25% · Shelf-Life 20% · Product Age 15%.</p>
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

      {!loading && items && (
        <>
          <div className="stat-grid">
            <div className="stat-card tone-neutral">
              <div className="stat-value">{totals.length}</div>
              <div className="stat-label">Batches scored</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{avg}</div>
              <div className="stat-label">Average freshness score</div>
            </div>
            <div className="stat-card tone-green">
              <div className="stat-value">{counts('Fresh')}</div>
              <div className="stat-label">Fresh</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{counts('Needs Attention')}</div>
              <div className="stat-label">Need attention</div>
            </div>
            <div className="stat-card tone-red">
              <div className="stat-value">{counts('Spoiled')}</div>
              <div className="stat-label">Spoiled</div>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <div className="search-box">
              <input type="search" placeholder="Search by food name or batch ID…" value={search}
                     onChange={(e) => setSearch(e.target.value)} aria-label="Search batches" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="">All Categories</option>
              {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {hasFilters && <button type="button" className="btn btn-small btn-outline" onClick={clearFilters}>Clear</button>}
          </div>

          {totals.length === 0 ? (
            <div className="empty-state tall">
              <h3>{hasFilters ? 'No batches match your filters' : 'No batches to score yet'}</h3>
              <p>Add a food batch to compute overall freshness scores.</p>
            </div>
          ) : (
            <div className="score-list" style={{ marginTop: 16 }}>
              {totals.map((it) => (
                <ScoringRow key={it.batch_id} item={it}
                            expanded={!!open[it.batch_id]} onToggle={() => toggle(it.batch_id)} />
              ))}
            </div>
          )}
        </>
      )}
      {loading && <PageLoading text="Scoring batches…" />}
    </div>
  )
}

function ScoringRow({ item, expanded, onToggle }) {
  const [breakdown, setBreakdown] = useState(null)
  const [fetching, setFetching] = useState(false)

  const ensureLoaded = async () => {
    if (breakdown || fetching) return
    if (!expanded) return
    setFetching(true)
    try {
      const res = await api.get(`/insights/batch/${item.batch_id}`)
      setBreakdown(res.data.score)
    } catch {
      setBreakdown(null)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => { ensureLoaded() }, [expanded, breakdown, fetching, item.batch_id])

  const score = Number(item.overall_score) || 0
  const tone = getFreshnessTone(item.freshness_status)

  return (
    <div className={`score-row ${expanded ? 'open' : ''}`}>
      <div className="score-head" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
        <ScoreRing value={score} size={64} stroke={7} />
        <div className="score-info">
          <Link to={`/shelf-life/${item.batch_id}`} onClick={(e) => e.stopPropagation()} className="strong">{item.food_name}</Link>
          <div className="table-sub muted small"><code>{item.batch_id}</code> · {item.category}</div>
          <div className="score-chips">
            <StatusPill status={item.freshness_status} />
            <span className={`badge ${riskBadge(item.spoilage_risk?.toLowerCase())}`}>{item.spoilage_risk}</span>
            {item.estimated_remaining_days <= 0 && <span className="badge badge-red">expired</span>}
          </div>
        </div>
        <div className="score-quick">
          <span className="stat-value">{formatScore(score)}</span>
          <span className="stat-label muted">/100 · {item.available_quantity} {item.unit}</span>
        </div>
      </div>

      {expanded && (
        <div className="score-body">
          {fetching && <Spinner size={18} />}
          {!fetching && !breakdown && <p className="empty-inline">Pillar breakdown unavailable.</p>}
          {breakdown && (
            <>
              {SCORING_PILLARS.map((p) => (
                <div className="pillar" key={p.key}>
                  <div className="pillar-meta">
                    <span className="pillar-name">{p.label}</span>
                    <span className="pillar-weight muted small">{p.weight}%</span>
                    <span className={`pillar-score text-${breakdown[p.key] > 75 ? 'green' : breakdown[p.key] > 50 ? 'blue' : breakdown[p.key] > 35 ? 'amber' : 'red'}`}>
                      {formatScore(breakdown[p.key])}
                    </span>
                  </div>
                  <div className="pillar-track">
                    <div className="pillar-fill"
                         style={{ width: `${Math.max(0, Math.min(100, breakdown[p.key]))}%`,
                                  background: pillarColor(breakdown[p.key]) }} />
                  </div>
                  <small className="muted">{PILLAR_HINTS[p.key]}</small>
                </div>
              ))}
              {(breakdown.notes || []).length > 0 && (
                <ul className="bullet-list">
                  {breakdown.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function pillarColor(v) {
  if (v >= 75) return 'var(--green-500)'
  if (v >= 50) return '#0ea5e9'
  if (v >= 35) return 'var(--amber-600)'
  return 'var(--red-500)'
}
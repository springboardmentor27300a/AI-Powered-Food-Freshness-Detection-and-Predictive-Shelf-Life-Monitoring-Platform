/**
 * Recommendations (Milestone 3).
 *
 * Rule-engine recommendations for the visible inventory: consumption order,
 * storage corrections, rotation, waste reduction, quality improvements.
 * "Regenerate" recomputes and persists a fresh set from the current state.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageLoading } from '../components/Spinner'
import { RefreshIcon, SparkleIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { RECOMMENDATION_CATEGORIES } from '../utils/constants'
import { formatDateTime } from '../utils/helpers'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_TONE = { high: 'red', medium: 'amber', low: 'blue' }

export default function Recommendations() {
  const [recs, setRecs] = useState(null)
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const params = {}
      if (category) params.category = category
      if (priority) params.priority = priority
      const [r, batches] = await Promise.all([
        api.get('/recommendations', { params }),
        api.get('/shelf-life').catch(() => ({ data: [] })),
      ])
      const map = {}
      for (const b of batches.data) map[b.batch_id] = b.food_name
      setNameMap(map)
      setRecs(r.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setRecs([])
    } finally {
      setLoading(false)
    }
  }, [category, priority])

  useEffect(() => { load() }, [load])

  const regenerate = async () => {
    setBusy(true)
    setBanner(null)
    try {
      const res = await api.post('/recommendations/regenerate')
      setBanner({ type: 'success', text: `Generated ${res.data.generated} recommendations across your inventory.` })
      await load()
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Could not regenerate recommendations.') })
    } finally {
      setBusy(false)
    }
  }

  const sorted = [...(recs || [])].sort((a, b) => {
    const p = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    if (p !== 0) return p
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const count = (p) => (recs || []).filter((r) => r.priority === p).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Recommendations</h2>
          <p className="muted">Data-driven actions to cut waste and improve freshness — regenerated from the rule engine when batch state changes.</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshIcon /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={regenerate} disabled={busy || loading}>
            <SparkleIcon /> Regenerate {busy ? '…' : ''}
          </button>
        </div>
      </div>

      {banner && (
        <div className={`banner ${banner.type}`}>
          {banner.text}
          <button type="button" className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {!loading && recs && (
        <>
          <div className="stat-grid">
            <div className="stat-card tone-neutral">
              <div className="stat-value">{recs.length}</div>
              <div className="stat-label">Active recommendations</div>
            </div>
            <div className="stat-card tone-red">
              <div className="stat-value">{count('high')}</div>
              <div className="stat-label">High priority</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{count('medium')}</div>
              <div className="stat-label">Medium priority</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{count('low')}</div>
              <div className="stat-label">Low priority</div>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="">All Categories</option>
              {RECOMMENDATION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
              <option value="">All Priorities</option>
              {Object.keys(PRIORITY_ORDER).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {(category || priority) && (
              <button type="button" className="btn btn-small btn-outline"
                      onClick={() => { setCategory(''); setPriority('') }}>Clear</button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state tall">
              <h3>No active recommendations</h3>
              <p>Click <strong>Regenerate</strong> to compute recommendations from the current batch state.</p>
            </div>
          ) : (
            <div className="rec-grid" style={{ marginTop: 16 }}>
              {sorted.map((r) => (
                <div className="rec-card" key={r.id}>
                  <div className="rec-top">
                    <span className={`badge badge-${PRIORITY_TONE[r.priority] || 'blue'}`}>
                      {r.priority} priority
                    </span>
                    <span className="rec-date muted small">{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className="rec-message">{r.message}</p>
                  <div className="rec-bottom">
                    <span className="rec-cat small">{r.category}</span>
                    {r.batch_id_ref ? (
                      <Link to={`/shelf-life/${r.batch_id_ref}`} className="small">
                        {nameMap[r.batch_id_ref] || r.batch_id_ref}
                      </Link>
                    ) : <span className="muted small">all batches</span>}
                    <span className="muted small">{r.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {loading && <PageLoading text="Loading recommendations…" />}
    </div>
  )
}
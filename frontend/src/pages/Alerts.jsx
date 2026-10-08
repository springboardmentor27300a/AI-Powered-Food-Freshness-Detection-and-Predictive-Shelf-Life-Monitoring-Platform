/**
 * Alerts / notifications (Milestone 3).
 *
 * Rule-generated alerts from real batch state: shelf-life warnings, spoilage
 * risk, storage deviations, freshness status and priority consumption.
 * Consumers only see alerts for their own batches; staff see the full
 * inventory but alerts are owned by the batch owner.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageLoading } from '../components/Spinner'
import { BellIcon, RefreshIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { ALERT_TYPES } from '../utils/constants'
import { formatDateTime } from '../utils/helpers'

const SEVERITIES = ['critical', 'warning', 'info']
const SEVERITY_TONE = { critical: 'red', warning: 'amber', info: 'green' }

export default function Alerts() {
  const [alerts, setAlerts] = useState(null)
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [type, setType] = useState('')
  const [severity, setSeverity] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const params = { unread_only: unreadOnly }
      if (type) params.alert_type = type
      if (severity) params.severity = severity
      const [a, batches] = await Promise.all([
        api.get('/alerts', { params }).catch(() => ({ data: [] })),
        api.get('/shelf-life').catch(() => ({ data: [] })),
      ])
      const map = {}
      for (const b of batches.data) map[b.batch_id] = b.food_name
      setNameMap(map)
      setAlerts(a.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [type, severity, unreadOnly])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setBusy(true)
    setBanner(null)
    try {
      const res = await api.post('/alerts/generate')
      setBanner({ type: 'success', text: `Generated ${res.data.generated} new alert${res.data.generated === 1 ? '' : 's'}.` })
      await load()
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Could not generate alerts.') })
    } finally {
      setBusy(false)
    }
  }

  const markRead = async (id) => {
    try {
      await api.post(`/alerts/${id}/read`)
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)))
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Could not update alert.') })
    }
  }

  const markAllRead = async () => {
    setBusy(true)
    try {
      const res = await api.post('/alerts/read-all')
      setBanner({ type: 'success', text: `Marked ${res.data.marked_read} alert${res.data.marked_read === 1 ? '' : 's'} as read.` })
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })))
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Could not update alerts.') })
    } finally {
      setBusy(false)
    }
  }

  const unread = (alerts || []).filter((a) => !a.is_read)
  const critical = (alerts || []).filter((a) => a.severity === 'critical')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Alerts</h2>
          <p className="muted">Automated freshness, spoilage, storage and inventory alerts.</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshIcon /> Refresh
          </button>
          <button type="button" className="btn btn-outline" onClick={markAllRead} disabled={busy || loading}>
            Mark all read
          </button>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy || loading}>
            <BellIcon /> Generate {busy ? '…' : ''}
          </button>
        </div>
      </div>

      {banner && (
        <div className={`banner ${banner.type}`}>
          {banner.text}
          <button type="button" className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {!loading && alerts && (
        <>
          <div className="stat-grid">
            <div className="stat-card tone-neutral">
              <div className="stat-value">{alerts.length}</div>
              <div className="stat-label">Alerts visible</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{unread.length}</div>
              <div className="stat-label">Unread</div>
            </div>
            <div className="stat-card tone-red">
              <div className="stat-value">{critical.length}</div>
              <div className="stat-label">Critical severity</div>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
              <option value="">All Types</option>
              {ALERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter by severity">
              <option value="">All Severities</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button"
                    className={`btn btn-small ${unreadOnly ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setUnreadOnly((v) => !v)}>
              Unread only
            </button>
            {(type || severity || unreadOnly) && (
              <button type="button" className="btn btn-small btn-outline"
                      onClick={() => { setType(''); setSeverity(''); setUnreadOnly(false) }}>Clear</button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state tall">
              <h3>No alerts {unreadOnly ? 'unread' : ''}</h3>
              <p>Click <strong>Generate</strong> to scan the current batch state and raise new alerts.</p>
            </div>
          ) : (
            <div style={{ marginTop: 16 }} className="alert-cards">
              {alerts.map((a) => (
                <div key={a.id} className={`alert-card ${a.is_read ? 'read' : 'unread'}`}>
                  <span className={`dot dot-${SEVERITY_TONE[a.severity] || 'green'}`} />
                  <div className="alert-card-main">
                    <div className="alert-card-head">
                      <span className={`badge badge-${SEVERITY_TONE[a.severity] || 'green'}`}>{a.severity}</span>
                      <span className="badge badge-role">{a.alert_type}</span>
                      {!a.is_read && <span className="badge badge-amber">new</span>}
                    </div>
                    <p>{a.message}</p>
                    <div className="alert-card-meta">
                      {a.batch_id_ref ? (
                        <Link to={`/shelf-life/${a.batch_id_ref}`} className="small">
                          {nameMap[a.batch_id_ref] || a.batch_id_ref}
                        </Link>
                      ) : <span className="muted small">all batches</span>}
                      <span className="muted small">{formatDateTime(a.created_at)}</span>
                    </div>
                  </div>
                  {!a.is_read && (
                    <button type="button" className="btn btn-small btn-outline" onClick={() => markRead(a.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {loading && <PageLoading text="Loading alerts…" />}
    </div>
  )
}
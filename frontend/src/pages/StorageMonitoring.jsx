/**
 * Storage Condition Monitoring (Milestone 3).
 *
 * List view  : per-batch storage analysis (temperature, humidity, airflow,
 *              light, storage duration) with compliance score + delta days.
 * Detail view: parameter statuses, optimization recommendations, a form to
 *              record a new sensor reading, and readings history.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { HBar } from '../components/Charts'
import Modal from '../components/Modal'
import { PageLoading } from '../components/Spinner'
import { RefreshIcon, ThermometerIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES, STORAGE_OPTIONS } from '../utils/constants'
import { formatDate, formatDateTime, formatQuantity, storageStatusTone } from '../utils/helpers'

export default function StorageMonitoring() {
  const { batchId } = useParams()
  return batchId ? <StorageDetail batchId={batchId} /> : <StorageList />
}

function StorageList() {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const params = {}
      if (search.trim()) params.q = search.trim()
      if (category) params.category = category
      const res = await api.get('/storage', { params })
      setItems(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => { load() }, [load])

  const monitored = items ? items.filter((i) => {
    const current = i.current_conditions || {}
    return [current.temperature_c, current.humidity_pct, current.air_circulation, current.light_exposure]
      .some((value) => value !== null && value !== undefined && value !== '')
  }) : []
  const avgCompliance = monitored.length
    ? (monitored.reduce((s, i) => s + Number(i.compliance_score || 0), 0) / monitored.length).toFixed(1)
    : '—'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Storage Condition Monitoring</h2>
          <p className="muted">Live sensor conditions vs. ideal storage rules, per batch.</p>
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
              <div className="stat-value">{items.length}</div>
              <div className="stat-label">Batches in scope</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{monitored.length}</div>
              <div className="stat-label">Monitoring sensor data</div>
            </div>
            <div className="stat-card tone-green">
              <div className="stat-value">{monitored.length ? Math.round((monitored.length / items.length) * 100) : 0}%</div>
              <div className="stat-label">Monitoring coverage</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{avgCompliance}</div>
              <div className="stat-label">Avg compliance score</div>
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
            {(search || category) && (
              <button type="button" className="btn btn-small btn-outline"
                      onClick={() => { setSearch(''); setCategory('') }}>Clear</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="empty-state tall">
              <h3>No batches with storage monitoring data</h3>
              <p>Add temperature / humidity / airflow / light exposure to a batch, or record a reading.</p>
            </div>
          ) : (
            <div className="table-wrap panel" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Temp</th>
                    <th>Humidity</th>
                    <th>Air</th>
                    <th>Light</th>
                    <th>Compliance</th>
                    <th>Condition</th>
                    <th>Shelf-Life Δ</th>
                    <th>Storage Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.batch_id}>
                      <td>
                        <Link to={`/storage/${it.batch_id}`} className="strong">{it.food_name}</Link>
                        <div className="table-sub muted small"><code>{it.batch_id}</code> · {it.category}</div>
                      </td>
                      <td>{paramCell(it.temperature, '°C')}</td>
                      <td>{paramCell(it.humidity, '%')}</td>
                      <td>{paramCell(it.air_circulation, '')}</td>
                      <td>{paramCell(it.light_exposure, '')}</td>
                      <td>
                        <strong className={`text-${complianceTone(it.compliance_score)}`}>
                          {it.compliance_score != null ? Number(it.compliance_score).toFixed(0) : '—'}
                        </strong>
                      </td>
                      <td><span className={`badge badge-${conditionTone(it.condition_status)}`}>{it.condition_status}</span></td>
                      <td className={it.shelf_life_delta_days > 0 ? 'muted' : ''}>
                        {it.has_storage_data
                          ? <strong className={`text-${it.shelf_life_delta_days >= 0 ? 'green' : 'red'}`}>
                              {it.shelf_life_delta_days >= 0 ? '+' : ''}{it.shelf_life_delta_days}d
                            </strong>
                          : <span className="muted small">no sensor data</span>}
                      </td>
                      <td className="muted small">{it.storage_type || '—'}</td>
                      <td className="actions-col">
                        <Link to={`/storage/${it.batch_id}`} className="btn btn-small btn-outline">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {loading && <PageLoading text="Reading storage conditions…" />}
    </div>
  )
}

function paramCell(param, suffix) {
  const tone = storageStatusTone(param?.status)
  const label = suffix ? `${param?.value ?? '—'}${suffix}` : (param?.value ?? '—')
  return <span className={`badge badge-${tone}`}>{label}</span>
}

function formatRange(min, max, suffix) {
  if (min == null && max == null) return 'Not defined'
  if (min == null) return `Up to ${max}${suffix}`
  if (max == null) return `At least ${min}${suffix}`
  return `${min}–${max}${suffix}`
}

function conditionTone(status) {
  return { GOOD: 'green', WARNING: 'amber', UNSUITABLE: 'red', CRITICAL: 'red', UNKNOWN: 'neutral' }[status] || 'neutral'
}

function complianceTone(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return 'muted'
  if (n >= 80) return 'green'
  if (n >= 60) return 'blue'
  if (n >= 40) return 'amber'
  return 'red'
}

function StorageDetail({ batchId }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [a, h] = await Promise.all([
        api.get(`/storage/${batchId}`),
        api.get(`/storage/history/${batchId}`).catch(() => ({ data: [] })),
      ])
      setData(a.data)
      setHistory(h.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => { load() }, [load])

  const onSaved = (msg) => {
    setShowForm(false)
    setSaving(false)
    setBanner({ type: 'success', text: msg })
    load()
  }

  const params = data ? [
    { key: 'temperature', label: 'Temperature', suffix: '°C' },
    { key: 'humidity', label: 'Humidity', suffix: '%' },
    { key: 'air_circulation', label: 'Air Circulation', suffix: '' },
    { key: 'light_exposure', label: 'Light Exposure', suffix: '' },
    { key: 'duration', label: 'Storage Duration', suffix: '' },
    { key: 'packaging', label: 'Packaging', suffix: '' },
    { key: 'storage_environment', label: 'Storage Environment', suffix: '' },
  ] : []
  const lifecycleRecommendations = data?.recommendations?.filter((item) =>
    ['consumption', 'rotation', 'waste_reduction'].includes(item.category)
  ) || []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button type="button" className="btn btn-small btn-outline" onClick={() => navigate('/storage')}>← Back</button>
          <h2 style={{ marginTop: 8 }}>Storage · {data?.food_name || batchId}</h2>
          <p className="muted"><code>{batchId}</code> · {data?.category} · {data?.storage_type} storage</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshIcon /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <ThermometerIcon /> Record Reading
          </button>
        </div>
      </div>

      {banner && <div className={`banner ${banner.type}`}>{banner.text}</div>}
      {loading ? <PageLoading text="Analysing storage conditions…" /> : data && (
        <>
          <div className="grid-2col">
            <section className="panel">
              <div className="panel-head"><h3>Parameter Analysis</h3></div>
              {!data.has_storage_data && (
                <p className="empty-inline small">
                  No live sensor data captured yet — record a reading to enable storage scoring.
                </p>
              )}
              {params.map(({ key, label, suffix }) => {
                const p = data[key]
                const tone = storageStatusTone(p?.status)
                return (
                  <div className={`param-row param-${tone}`} key={key}>
                    <div>
                      <span className="param-label">{label}</span>
                      <span className="param-value">{p?.value != null ? `${p.value}${suffix}` : '—'}</span>
                    </div>
                    <span className={`badge badge-${tone}`}>{p?.status ?? 'unknown'}</span>
                    <small>{p?.explanation}</small>
                    {p?.impact && <small><strong>Impact:</strong> {p.impact}</small>}
                    {p?.recommendation && <small><strong>Action:</strong> {p.recommendation}</small>}
                  </div>
                )
              })}
            </section>

            <section className="panel">
              <div className="panel-head"><h3>Storage Compliance</h3></div>
              <p>
                <span className={`badge badge-${conditionTone(data.condition_status)}`}>{data.condition_status}</span>{' '}
                {data.condition_summary}
              </p>
              <div className="compliance-hero">
                <strong style={{ color: complianceColor(data.compliance_score) }}>
                  {data.compliance_score != null ? Number(data.compliance_score).toFixed(1) : '—'}
                </strong>
                <span>/100</span>
              </div>
              {data.sub_scores && (
                <div className="mb-12">
                  {Object.entries(data.sub_scores).map(([k, v]) => (
                    <HBar key={k} label={k.replace(/_/g, ' ')} value={v} />
                  ))}
                </div>
              )}
              <div className="detail-list">
                <div><span>Recommended temperature</span><b>{data.temperature?.recommended ?? '—'}</b></div>
                <div><span>Shelf-life adjustment</span>
                  <b className={data.shelf_life_delta_days >= 0 ? 'text-green' : 'text-red'}>
                    {data.shelf_life_delta_days >= 0 ? '+' : ''}{data.shelf_life_delta_days} days
                  </b>
                </div>
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h3>Matched Storage Requirements</h3></div>
            <div className="grid-2col">
              <div className="detail-list">
                <div><span>Matched rule</span><b>{data.requirements?.scope}: {data.requirements?.key}</b></div>
                <div><span>Temperature</span><b>{formatRange(data.requirements?.temperature_min_c, data.requirements?.temperature_max_c, '°C')}</b></div>
                <div><span>Recommended temperature</span><b>{data.requirements?.recommended_temperature_c != null ? `${data.requirements.recommended_temperature_c}°C` : '—'}</b></div>
                <div><span>Humidity</span><b>{formatRange(data.requirements?.humidity_min_pct, data.requirements?.humidity_max_pct, '%')}</b></div>
                <div><span>Air circulation</span><b>{data.requirements?.air_circulation}</b></div>
                <div><span>Light</span><b>{data.requirements?.light_requirement}</b></div>
                <div><span>Storage duration</span><b>{data.requirements?.recommended_duration_days} days suitable / {data.requirements?.maximum_duration_days} days maximum</b></div>
                <div><span>Packaging</span><b>{data.requirements?.packaging_requirement}</b></div>
                <div><span>Environment</span><b>{data.requirements?.storage_environment}</b></div>
                <div><span>Refrigeration</span><b>{data.requirements?.refrigeration_required ? 'Required' : 'Not required by this rule'}</b></div>
              </div>
              <div className="detail-list">
                <div><span>Current temperature</span><b>{data.current_conditions?.temperature_c != null ? `${data.current_conditions.temperature_c}°C` : 'Not recorded'}</b></div>
                <div><span>Current humidity</span><b>{data.current_conditions?.humidity_pct != null ? `${data.current_conditions.humidity_pct}%` : 'Not recorded'}</b></div>
                <div><span>Current air</span><b>{data.current_conditions?.air_circulation || 'Not recorded'}</b></div>
                <div><span>Current light</span><b>{data.current_conditions?.light_exposure || 'Not recorded'}</b></div>
                <div><span>Storage start</span><b>{formatDate(data.storage_start_date)}</b></div>
                <div><span>Days stored</span><b>{data.days_stored}</b></div>
                <div><span>Remaining maximum duration</span><b>{data.remaining_storage_duration_days} days</b></div>
                <div><span>Quantity at risk</span><b>{formatQuantity(data.available_quantity)} {data.unit}</b></div>
              </div>
            </div>
            <p className="muted small">{data.requirements?.notes} Values are configurable reference guidelines, not laboratory certification.</p>
          </section>

          {data.shelf_life && (
            <section className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head"><h3>Shelf-Life, Expiry & Priority</h3></div>
              <div className="grid-2col">
                <div className="detail-list">
                  <div><span>Estimated remaining shelf life</span><b>{data.shelf_life.estimated_remaining_days} days</b></div>
                  <div><span>Expected expiry</span><b>{formatDate(data.shelf_life.expected_expiry_date)}</b></div>
                  <div><span>Spoilage risk</span><b>{data.shelf_life.spoilage_risk} ({data.shelf_life.risk_score}/100)</b></div>
                  <div><span>Storage impact</span><b>{data.shelf_life.storage_impact}</b></div>
                  <div><span>Priority</span><b>{data.consumption_priority}</b></div>
                </div>
                <div>
                  {data.waste_reduction && <div className="banner warning">{data.waste_reduction}</div>}
                  {data.image_analysis_context && (
                    <p className="muted">
                      Latest image analysis: {data.image_analysis_context.classification}; freshness {data.image_analysis_context.freshness_score ?? '—'};
                      spoilage {data.image_analysis_context.spoilage_detected ? 'detected' : 'not detected'}. Storage compliance does not override observed quality risk.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {lifecycleRecommendations.length > 0 && (
            <section className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head"><h3>Consumption, Rotation & Waste Actions</h3></div>
              <ul className="bullet-list">
                {lifecycleRecommendations.map((item, index) => <li key={`${item.category}-${index}`}>{item.message}</li>)}
              </ul>
            </section>
          )}

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h3>Optimization Recommendations</h3></div>
            {data.optimization_recommendations && data.optimization_recommendations.length > 0 ? (
              <ul className="bullet-list">
                {data.optimization_recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            ) : (
              <p className="empty-inline">No optimization needed — conditions match the storage rule.</p>
            )}
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h3>Recent Readings</h3></div>
            {history && history.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Recorded</th><th>Temp</th><th>Humidity</th><th>Air</th><th>Light</th><th>Compliance</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.recorded_at)}</td>
                        <td>{r.temperature_c != null ? `${r.temperature_c}°C` : '—'}</td>
                        <td>{r.humidity_pct != null ? `${r.humidity_pct}%` : '—'}</td>
                        <td>{r.air_circulation ?? '—'}</td>
                        <td>{r.light_exposure ?? '—'}</td>
                        <td>{r.compliance_score != null ? Number(r.compliance_score).toFixed(0) : '—'}</td>
                        <td className="muted small">{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-inline">No readings recorded yet. Record one to build a history.</p>
            )}
          </section>
        </>
      )}

      {showForm && data && (
        <ReadingForm batchId={batchId} foodName={data.food_name} onCancel={() => setShowForm(false)}
                     onSave={onSaved} setSaving={setSaving} />
      )}
      {saving && <PageLoading text="Saving reading…" />}
    </div>
  )
}

function complianceColor(score) {
  const n = Number(score)
  if (n >= 80) return 'var(--green-600)'
  if (n >= 60) return '#0ea5e9'
  if (n >= 40) return 'var(--amber-600)'
  return 'var(--red-600)'
}

function ReadingForm({ batchId, foodName, onCancel, onSave, setSaving }) {
  const [form, setForm] = useState({ temperature_c: '', humidity_pct: '', air_circulation: '', light_exposure: '', notes: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    setSaving(true)
    const payload = {}
    if (form.temperature_c !== '') payload.temperature_c = Number(form.temperature_c)
    if (form.humidity_pct !== '') payload.humidity_pct = Number(form.humidity_pct)
    if (form.air_circulation) payload.air_circulation = form.air_circulation
    if (form.light_exposure) payload.light_exposure = form.light_exposure
    if (form.notes.trim()) payload.notes = form.notes.trim()
    if (Object.keys(payload).length === 0) {
      setError('Enter at least one sensor value.')
      setBusy(false)
      setSaving(false)
      return
    }
    try {
      await api.post(`/storage/${batchId}`, payload)
      onSave('Reading recorded successfully.')
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Record Storage Reading · ${foodName}`} onClose={onCancel} width={560}>
      <form onSubmit={submit} className="batch-form">
        {error && <div className="banner error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="f-temp">Temperature (°C)</label>
            <input id="f-temp" type="number" step="any" placeholder="e.g. 4" value={form.temperature_c}
                   onChange={set('temperature_c')} />
          </div>
          <div className="field">
            <label htmlFor="f-hum">Humidity (%)</label>
            <input id="f-hum" type="number" min="0" max="100" step="any" placeholder="e.g. 75" value={form.humidity_pct}
                   onChange={set('humidity_pct')} />
          </div>
          <div className="field">
            <label htmlFor="f-air">Air Circulation</label>
            <select id="f-air" value={form.air_circulation} onChange={set('air_circulation')}>
              <option value="">Select…</option>
              {STORAGE_OPTIONS.airCirculation.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-light">Light Exposure</label>
            <select id="f-light" value={form.light_exposure} onChange={set('light_exposure')}>
              <option value="">Select…</option>
              {STORAGE_OPTIONS.lightExposure.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field span-2">
            <label htmlFor="f-notes">Notes <small>(optional)</small></label>
            <textarea id="f-notes" rows={2} value={form.notes} onChange={set('notes')}
                      placeholder="Device, sensor or inspection notes…" />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Reading'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
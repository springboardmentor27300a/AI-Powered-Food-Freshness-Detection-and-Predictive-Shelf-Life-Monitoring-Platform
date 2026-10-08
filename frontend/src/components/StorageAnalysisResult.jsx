/**
 * "Storage Condition Analysis" result card (§12 of the demo spec).
 *
 * Shown right after a food item is registered/updated: compares the ACTUAL
 * entered values with the product/category-specific recommended storage
 * envelope and returns Current / Recommended / Status / Overall / Action.
 */
import { useEffect, useState } from 'react'

import { Spinner } from './Spinner'
import api, { getErrorMessage } from '../services/api'

const OVERALL = {
  GOOD: { text: '\u2713 Storage Conditions Suitable', cls: 'banner success' },
  WARNING: { text: '\u26a0 Storage Conditions Need Attention', cls: 'banner' },
  UNSUITABLE: { text: '\U0001F534 Unsafe / High Spoilage Risk', cls: 'banner error' },
  CRITICAL: { text: '\U0001F534 Unsafe / High Spoilage Risk', cls: 'banner error' },
  UNKNOWN: { text: 'Storage conditions not recorded yet', cls: 'banner' },
}

function statusBadge(param) {
  if (!param) return null
  const cls =
    param.status === 'good' ? 'badge badge-green'
      : param.status === 'warning' ? 'badge badge-amber'
        : param.status === 'critical' ? 'badge badge-red'
          : 'badge'
  return <span className={cls}>{param.assessment || (param.status || '').toUpperCase()}</span>
}

function ParamRow({ label, param, current, unit }) {
  return (
    <tr>
      <td className="strong">{label}</td>
      <td>{current ?? 'Not recorded'}{current != null && unit ? unit : ''}</td>
      <td>{param?.recommended || '-'}</td>
      <td>{statusBadge(param)}</td>
      <td className="small">{param?.recommendation || ''}</td>
    </tr>
  )
}

export default function StorageAnalysisResult({ batchId }) {
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!batchId) return
    api
      .get(`/storage/${batchId}`)
      .then((res) => setAnalysis(res.data))
      .catch((err) => setError(getErrorMessage(err)))
  }, [batchId])

  if (error) return <div className="banner error">{error}</div>
  if (!analysis) return <div className="empty-inline"><Spinner size={18} /> Analyzing storage conditions…</div>

  const overall = OVERALL[analysis.condition_status] || OVERALL.UNKNOWN
  const firstAction =
    analysis.optimization_recommendations?.[0] ||
    analysis.temperature?.recommendation ||
    analysis.condition_summary

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h3>Storage Condition Analysis</h3>
        <span className="muted small">{analysis.food_name} — {analysis.storage_type}</span>
      </div>

      <div className={overall.cls}>{overall.text}</div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Current</th>
              <th>Recommended</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <ParamRow
              label="Temperature"
              param={analysis.temperature}
              current={analysis.temperature?.value != null ? `${analysis.temperature.value}°C` : null}
            />
            <ParamRow
              label="Humidity"
              param={analysis.humidity}
              current={analysis.humidity?.value != null ? `${analysis.humidity.value}%` : null}
            />
            <ParamRow label="Air Circulation" param={analysis.air_circulation} current={analysis.current_conditions?.air_circulation} />
            <ParamRow label="Light Exposure" param={analysis.light_exposure} current={analysis.current_conditions?.light_exposure} />
            <ParamRow
              label="Storage Duration"
              param={analysis.duration}
              current={analysis.days_stored != null ? `${analysis.days_stored} days` : null}
            />
          </tbody>
        </table>
      </div>

      <p className="small" style={{ marginTop: 10 }}>
        <strong>Recommendation:</strong> {firstAction}
      </p>
      {analysis.condition_summary && (
        <p className="small muted" style={{ margin: 0 }}>{analysis.condition_summary}</p>
      )}
    </div>
  )
}

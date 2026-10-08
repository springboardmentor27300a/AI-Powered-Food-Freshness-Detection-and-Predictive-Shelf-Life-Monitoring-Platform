/**
 * FreshnessResult - Reusable component displaying the full analysis output
 * from the freshness analysis API (classification, quality scores, spoilage).
 * Shows scores on 0-100 scale with status labels and includes history trend.
 */
import { useState, useEffect } from 'react'
import api from '../services/api'
import { formatDateTime } from '../utils/helpers'

const CLASSIFICATION_STYLES = {
  Fresh: { bg: 'var(--green-100)', color: 'var(--green-900)', border: 'var(--green-500)' },
  Good: { bg: '#e0f2fe', color: '#0c4a6e', border: '#0ea5e9' },
  Acceptable: { bg: 'var(--amber-100)', color: 'var(--amber-700)', border: 'var(--amber-600)' },
  'Near Spoilage': { bg: '#fff1f2', color: '#9f1239', border: '#f43f5e' },
  Spoiled: { bg: 'var(--red-100)', color: 'var(--red-700)', border: 'var(--red-600)' },
}

const RISK_STYLES = {
  low: 'badge-green',
  moderate: 'badge-amber',
  high: 'badge-red',
  critical: 'badge-red',
}

const STATUS_COLORS = {
  Normal: 'var(--green-600)',
  'Slightly Degraded': 'var(--amber-600)',
  'Moderately Degraded': '#f97316',
  'Highly Degraded': 'var(--red-600)',
  'Slightly Changed': 'var(--amber-600)',
  'Moderately Changed': '#f97316',
  'Highly Changed': 'var(--red-600)',
  'Not Detected': 'var(--green-600)',
  'Low Suspicion': 'var(--amber-600)',
  'Moderate Suspicion': '#f97316',
  'High Suspicion': 'var(--red-600)',
  None: 'var(--green-600)',
  Minor: 'var(--amber-600)',
  Moderate: '#f97316',
  Severe: 'var(--red-600)',
}

function ScoreBar({ label, value, max = 100, invert = false }) {
  const displayVal = invert ? Math.max(0, max - value) : value
  const pct = Math.round(displayVal)
  const barColor = pct >= 70 ? 'var(--green-500)' : pct >= 40 ? 'var(--amber-600)' : 'var(--red-600)'

  return (
    <div className="score-bar-row">
      <div className="score-bar-label">
        <span>{label}</span>
        <span className="score-bar-value">{value.toFixed(0)}%</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function IndicatorRow({ indicator }) {
  return (
    <div className="indicator-row">
      <div className="indicator-main">
        <strong>{indicator.name}</strong>
        <span className="muted small">{indicator.description}</span>
      </div>
      <div className="indicator-meta">
        {indicator.detected && (
          <span className="badge" style={{
            background: (STATUS_COLORS[indicator.severity] || '#6b7280') + '22',
            color: STATUS_COLORS[indicator.severity] || '#6b7280'
          }}>
            {indicator.severity}
          </span>
        )}
        <span className="indicator-prob">{(indicator.probability * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

function HistoryTrend({ batchId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!batchId) { setLoading(false); return }
    api.get(`/analysis/batch/${batchId}`)
      .then(({ data }) => setHistory(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [batchId])

  if (!batchId || loading || history.length < 2) return null

  return (
    <div className="panel">
      <div className="panel-head"><h3>Freshness History Trend</h3></div>
      <div className="history-trend">
        {history.map((h, i) => {
          const score = h.freshness_score || Math.round(h.confidence_score * 100)
          const barColor = score >= 75 ? 'var(--green-500)' : score >= 50 ? 'var(--amber-600)' : 'var(--red-600)'
          return (
            <div key={h.id} className="trend-item">
              <span className="trend-date">{formatDateTime(h.created_at)}</span>
              <div className="trend-bar-wrap">
                <div className="trend-bar" style={{ width: `${score}%`, background: barColor }} />
              </div>
              <span className="trend-score" style={{ color: barColor }}>{score}</span>
              <span className={`badge ${h.classification === 'Fresh' ? 'badge-green' : h.classification === 'Spoiled' ? 'badge-red' : ''}`} style={{ fontSize: '0.75rem' }}>
                {h.classification}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FreshnessResult({ result, preview, batchId, imageFile }) {
  const [showDetails, setShowDetails] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const clsStyle = CLASSIFICATION_STYLES[result.classification] || CLASSIFICATION_STYLES['Acceptable']
  const spoilageIndicators = result.analysis_details?.spoilage_detection?.indicators || []
  const freshnessScore = result.freshness_score || Math.round(result.confidence_score * 100)
  const spoilageProbability = result.spoilage_probability != null
    ? result.spoilage_probability
    : Math.round((1 - result.confidence_score) * 100)

  const handleDownloadReport = async () => {
    setGeneratingReport(true)
    try {
      if (!imageFile) {
        alert('Original image is not available. Please go back and re-analyze with the image to download a report.')
        return
      }

      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('food_name', result.food_name || 'Unknown Food')
      if (result.food_category) formData.append('food_category', result.food_category)
      if (batchId) formData.append('batch_id', batchId)

      const { data: report } = await api.post('/reports/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const response = await api.get(`/reports/${report.report_id}/download`, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `freshness-report-${report.report_id}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to generate report.'
      alert(msg)
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div className="result-container">
      {/* Header Card */}
      <div className="result-header-card" style={{ borderColor: clsStyle.border }}>
        <div className="result-header-left">
          {preview && <img src={preview} alt="Analyzed food" className="result-thumbnail" />}
          <div>
            <h3 style={{ color: clsStyle.color }}>{result.classification}</h3>
            <p className="muted small">{result.food_name} {result.food_category ? `- ${result.food_category}` : ''}</p>
            {result.batch_id_ref && <p className="muted small">Batch: <code>{result.batch_id_ref}</code></p>}
          </div>
        </div>
        <div className="result-header-right">
          <div className="result-score-big" style={{ color: clsStyle.color }}>
            {freshnessScore}
          </div>
          <span className="muted small">Freshness Score</span>
        </div>
      </div>

      {/* Main Result Cards */}
      <div className="result-cards-grid">
        <div className="result-mini-card">
          <span className="mini-card-label">Freshness Score</span>
          <span className="mini-card-value" style={{ color: clsStyle.color }}>{freshnessScore}/100</span>
        </div>
        <div className="result-mini-card">
          <span className="mini-card-label">Quality</span>
          <span className="mini-card-value" style={{ color: clsStyle.color }}>{result.classification}</span>
        </div>
        <div className="result-mini-card">
          <span className="mini-card-label">Spoilage Probability</span>
          <span className="mini-card-value" style={{ color: spoilageProbability > 30 ? 'var(--red-600)' : 'var(--green-600)' }}>
            {typeof spoilageProbability === 'number' && spoilageProbability <= 1 ? `${Math.round(spoilageProbability * 100)}%` : `${Math.round(spoilageProbability)}%`}
          </span>
        </div>
      </div>

      {/* Quality Scores */}
      <div className="panel">
        <div className="panel-head"><h3>Quality Scores</h3></div>
        <div className="scores-grid">
          <ScoreBar label="Overall Quality" value={result.image_quality_score * 100} />
          <ScoreBar label="Color Health" value={(1 - result.color_score) * 100} />
          <ScoreBar label="Texture Integrity" value={(1 - result.texture_score) * 100} />
        </div>
        <div className="risk-badges-row">
          <div className="risk-item">
            <span className="risk-label">Mold Risk</span>
            <span className={`badge ${result.mold_risk > 0.3 ? 'badge-red' : result.mold_risk > 0.1 ? 'badge-amber' : 'badge-green'}`}>
              {(result.mold_risk * 100).toFixed(1)}%
            </span>
          </div>
          <div className="risk-item">
            <span className="risk-label">Bruise Risk</span>
            <span className={`badge ${result.bruise_risk > 0.3 ? 'badge-red' : result.bruise_risk > 0.1 ? 'badge-amber' : 'badge-green'}`}>
              {(result.bruise_risk * 100).toFixed(1)}%
            </span>
          </div>
          <div className="risk-item">
            <span className="risk-label">Damage Risk</span>
            <span className={`badge ${result.damage_risk > 0.3 ? 'badge-red' : result.damage_risk > 0.1 ? 'badge-amber' : 'badge-green'}`}>
              {(result.damage_risk * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Individual Analysis Cards */}
      <div className="analysis-cards-grid">
        <div className="analysis-card">
          <h4>Color Analysis</h4>
          <span className="analysis-status" style={{ color: STATUS_COLORS[result.color_status] || '#6b7280' }}>
            {result.color_status || 'Normal'}
          </span>
          <span className="analysis-score">Score: {((1 - result.color_score) * 100).toFixed(0)}%</span>
        </div>
        <div className="analysis-card">
          <h4>Texture Analysis</h4>
          <span className="analysis-status" style={{ color: STATUS_COLORS[result.texture_status] || '#6b7280' }}>
            {result.texture_status || 'Normal'}
          </span>
          <span className="analysis-score">Score: {((1 - result.texture_score) * 100).toFixed(0)}%</span>
        </div>
        <div className="analysis-card">
          <h4>Mold Detection</h4>
          <span className="analysis-status" style={{ color: STATUS_COLORS[result.mold_indicator] || '#6b7280' }}>
            {result.mold_indicator || 'Not Detected'}
          </span>
        </div>
        <div className="analysis-card">
          <h4>Bruising</h4>
          <span className="analysis-status" style={{ color: STATUS_COLORS[result.bruise_severity] || '#6b7280' }}>
            {result.bruise_severity || 'None'}
          </span>
        </div>
        <div className="analysis-card">
          <h4>Physical Damage</h4>
          <span className="analysis-status" style={{ color: STATUS_COLORS[result.damage_severity] || '#6b7280' }}>
            {result.damage_severity || 'None'}
          </span>
        </div>
      </div>

      {/* Spoilage Detection */}
      <div className="panel">
        <div className="panel-head">
          <h3>Spoilage Detection</h3>
          <span className={`badge ${result.spoilage_detected ? 'badge-red' : 'badge-green'}`}>
            {result.spoilage_detected ? 'Spoilage Detected' : 'No Spoilage'}
          </span>
        </div>
        <div className="spoilage-summary">
          <div className="spoilage-stat">
            <span className="muted small">Estimated Visual Spoilage Probability</span>
            <strong>
              {typeof spoilageProbability === 'number' && spoilageProbability <= 1
                ? `${(spoilageProbability * 100).toFixed(1)}%`
                : `${spoilageProbability.toFixed(1)}%`}
            </strong>
          </div>
          <div className="spoilage-stat">
            <span className="muted small">Risk Level</span>
            <span className={`badge ${RISK_STYLES[result.risk_level]}`}>{result.risk_level}</span>
          </div>
          {result.estimated_shelf_life_days != null && (
            <div className="spoilage-stat">
              <span className="muted small">Est. Shelf Life</span>
              <strong>{result.estimated_shelf_life_days} days</strong>
            </div>
          )}
        </div>

        {spoilageIndicators.length > 0 && (
          <div className="indicators-list">
            {spoilageIndicators.map((ind, i) => (
              <IndicatorRow key={i} indicator={ind} />
            ))}
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="panel">
        <div className="panel-head"><h3>Recommended Action</h3></div>
        <p style={{ lineHeight: 1.7 }}>{result.recommended_action}</p>
      </div>

      {/* Freshness History Trend */}
      <HistoryTrend batchId={batchId || result.batch_id_ref} />

      {/* Detailed Analysis Toggle */}
      <div className="panel">
        <button className="btn btn-outline btn-block" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide' : 'Show'} Detailed Analysis
        </button>
        {showDetails && result.analysis_details && (
          <div className="detail-sections" style={{ marginTop: 16 }}>
            {result.analysis_details.color_analysis && (
              <div className="detail-block">
                <h4>Color Analysis Details</h4>
                <p className="muted small">Degradation: {(result.analysis_details.color_analysis.degradation_score * 100).toFixed(1)}%</p>
                <p className="muted small">Status: {result.analysis_details.color_analysis.color_status || result.color_status}</p>
                {result.analysis_details.color_analysis.dominant_colors?.slice(0, 3).map((c, i) => (
                  <span key={i} className="color-chip" style={{ background: `rgb(${c.color_bgr[2]},${c.color_bgr[1]},${c.color_bgr[0]})` }} title={`${c.percentage}%`} />
                ))}
              </div>
            )}
            {result.analysis_details.texture_analysis && (
              <div className="detail-block">
                <h4>Texture Analysis Details</h4>
                <p className="muted small">Edge Density: {result.analysis_details.texture_analysis.edge_density} | Contrast: {result.analysis_details.texture_analysis.contrast}</p>
                <p className="muted small">Roughness: {result.analysis_details.texture_analysis.roughness} | Status: {result.analysis_details.texture_analysis.texture_status || result.texture_status}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Report */}
      <div className="panel" style={{ textAlign: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleDownloadReport}
          disabled={generatingReport}
        >
          {generatingReport ? (
            <><span className="spinner" /> Generating Report...</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Freshness Report</>
          )}
        </button>
        <p className="muted small" style={{ marginTop: 8 }}>
          Visual assessment only - not a laboratory food-safety test.
        </p>
      </div>
    </div>
  )
}

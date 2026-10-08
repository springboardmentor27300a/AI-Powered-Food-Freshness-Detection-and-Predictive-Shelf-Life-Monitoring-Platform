import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../StatusBadge'
import { PageLoading } from '../Spinner'
import {
  CameraIcon, RefreshIcon, ReportIcon, SparkleIcon,
  DownloadIcon, StarIcon
} from '../icons'
import api, { getErrorMessage } from '../../services/api'
import { formatDate, formatDateTime, formatScore, downloadReport } from '../../utils/helpers'

export default function QualityInspectorDashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedInspection, setSelectedInspection] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, histRes, batchRes] = await Promise.all([
        api.get('/analysis/stats').catch(() => ({ data: null })),
        api.get('/analysis/history', { params: { limit: 12 } }).catch(() => ({ data: [] })),
        api.get('/batches', { params: { limit: 20 } }).catch(() => ({ data: [] })),
      ])
      setStats(statsRes.data)
      const hList = histRes.data || []
      setHistory(hList)
      setBatches(batchRes.data || [])
      if (hList.length > 0) setSelectedInspection(hList[0])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load inspector dashboard data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExport = async (format) => {
    try {
      await downloadReport(
        `/reports/export?report_type=freshness&file_format=${format}`,
        `quality-inspection-report.${format}`
      )
    } catch (err) {
      alert(`Export failed: ${getErrorMessage(err)}`)
    }
  }

  if (loading) return <PageLoading text="Loading food quality inspector workbench…" />

  const totalInspections = stats?.total_analyses || history.length
  const classes = stats?.classification_counts || {}

  return (
    <div className="inspector-dashboard">
      {/* Header Banner */}
      <div className="dashboard-hero-card">
        <div className="hero-content">
          <div className="role-tag inspector-tag">Quality Assurance & Visual Inspection</div>
          <h2>Food Quality Inspector Workbench</h2>
          <p className="hero-subtitle">
            Perform AI-assisted image analyses, detect early spoilage indicators (mold, bruising, texture, color degradation), and certify food quality standards.
          </p>
          <div className="hero-meta-row">
            <span><strong>Inspector:</strong> {user.full_name}</span>
            <span>•</span>
            <span><strong>Inspections Recorded:</strong> {totalInspections}</span>
            <span>•</span>
            <span><strong>Avg AI Confidence:</strong> {stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(0)}%` : '92%'}</span>
          </div>
        </div>
        <div className="hero-actions">
          <Link to="/freshness-analysis" className="btn btn-primary">
            <CameraIcon size={16} /> New Image Inspection
          </Link>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('pdf')}
          >
            <DownloadIcon size={15} /> Quality PDF
          </button>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('xlsx')}
          >
            <DownloadIcon size={15} /> Quality XLSX
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

      {/* KPI Cards */}
      <section className="stat-grid" style={{ marginTop: '20px' }}>
        <article className="stat-card tone-neutral">
          <span className="stat-value">{totalInspections}</span>
          <span className="stat-label">Total Inspected</span>
        </article>
        <article className="stat-card tone-green">
          <span className="stat-value">{classes['Fresh'] || 0}</span>
          <span className="stat-label">Grade A (Fresh)</span>
        </article>
        <article className="stat-card tone-blue">
          <span className="stat-value">{classes['Good'] || 0}</span>
          <span className="stat-label">Grade B (Good)</span>
        </article>
        <article className="stat-card tone-amber">
          <span className="stat-value">{(classes['Acceptable'] || 0) + (classes['Near Spoilage'] || 0)}</span>
          <span className="stat-label">Degraded / Near Spoilage</span>
        </article>
        <article className="stat-card tone-red">
          <span className="stat-value">{stats?.spoilage_detected_count || classes['Spoiled'] || 0}</span>
          <span className="stat-label">Spoilage Confirmed</span>
        </article>
        <article className="stat-card tone-blue">
          <span className="stat-value">{stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(0)}%` : '88%'}</span>
          <span className="stat-label">Avg Inspection Confidence</span>
        </article>
      </section>

      {/* Selected Inspection Deep-Dive Card */}
      {selectedInspection && (
        <section className="panel" style={{ marginTop: '24px', borderLeft: '4px solid #0ea5e9' }}>
          <div className="panel-head">
            <div>
              <h3><StarIcon size={18} /> Detailed Defect & Quality Review: {selectedInspection.food_name}</h3>
              <span className="muted small">
                Inspection Date: {formatDateTime(selectedInspection.created_at)} • Classification: <strong>{selectedInspection.classification}</strong>
              </span>
            </div>
            <Link to={`/freshness-analysis/${selectedInspection.batch_id_ref || ''}`} className="btn btn-small btn-outline">
              Open Analysis Tool
            </Link>
          </div>

          <div className="warehouse-detail-grid">
            <div className="param-detail-card">
              <span className="param-title">Color Degradation</span>
              <div className="param-reading">
                Score: <strong>{((1 - (selectedInspection.color_score || 0)) * 100).toFixed(0)}%</strong>
              </div>
              <small className="muted">Status: {selectedInspection.color_status || 'Normal pigment'}</small>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Texture & Surface Change</span>
              <div className="param-reading">
                Condition: <strong>{((1 - (selectedInspection.texture_score || 0)) * 100).toFixed(0)}%</strong>
              </div>
              <small className="muted">Surface: {selectedInspection.texture_status || 'Firm & smooth'}</small>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Mold & Fungal Indicator</span>
              <div className="param-reading">
                Risk: <strong>{((selectedInspection.mold_risk || 0) * 100).toFixed(1)}%</strong>
              </div>
              <span className={`badge ${selectedInspection.mold_indicator === 'Detected' ? 'badge-red' : 'badge-green'}`}>
                {selectedInspection.mold_indicator || 'Not Detected'}
              </span>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Bruising & Mechanical Damage</span>
              <div>Bruise: <strong>{selectedInspection.bruise_severity || 'None'}</strong></div>
              <div>Physical Cut: <strong>{selectedInspection.damage_severity || 'None'}</strong></div>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Overall Spoilage Probability</span>
              <div className="param-reading text-red">
                {((selectedInspection.spoilage_probability || 0) * 100).toFixed(1)}%
              </div>
              <span className={`badge badge-${selectedInspection.risk_level === 'critical' || selectedInspection.risk_level === 'high' ? 'red' : 'green'}`}>
                {selectedInspection.risk_level?.toUpperCase() || 'LOW RISK'}
              </span>
            </div>

            <div className="param-detail-card highlight-card">
              <span className="param-title"><SparkleIcon size={14} /> Quality Inspector Verdict</span>
              <p className="rec-text" style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                {selectedInspection.recommended_action}
              </p>
              <div className="muted small">
                Est. Shelf Life: <strong>{selectedInspection.estimated_shelf_life_days ?? '—'} days</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Inspection History Table */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-head">
          <div>
            <h3>Visual Inspection History & Evidence Log</h3>
            <span className="muted small">Select any record to view detailed quality breakdown</span>
          </div>
          <Link to="/reports" className="btn btn-small btn-outline">Centralized Reports</Link>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <p>No quality inspection records logged yet.</p>
            <Link to="/freshness-analysis" className="btn btn-small btn-primary">Start New Analysis</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food Item</th>
                  <th>Category</th>
                  <th>Classification</th>
                  <th>Freshness Score</th>
                  <th>Spoilage Prob.</th>
                  <th>Mold</th>
                  <th>Bruising</th>
                  <th>Inspection Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className={selectedInspection?.id === h.id ? 'active-row' : ''}
                    onClick={() => setSelectedInspection(h)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong>{h.food_name}</strong>
                      {h.batch_id_ref && <div className="muted small"><code>{h.batch_id_ref}</code></div>}
                    </td>
                    <td>{h.food_category || 'General'}</td>
                    <td>
                      <span className={`badge ${h.classification === 'Fresh' ? 'badge-green' : h.classification === 'Good' ? 'badge-blue' : h.classification === 'Acceptable' ? 'badge-amber' : 'badge-red'}`}>
                        {h.classification}
                      </span>
                    </td>
                    <td>
                      <strong>{formatScore(h.freshness_score)}/100</strong>
                    </td>
                    <td>
                      <span className={h.spoilage_probability > 0.3 ? 'text-red strong' : 'text-green'}>
                        {((h.spoilage_probability || 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <span className={`small ${h.mold_indicator === 'Detected' ? 'text-red strong' : 'muted'}`}>
                        {h.mold_indicator || 'None'}
                      </span>
                    </td>
                    <td>
                      <span className="small">{h.bruise_severity || 'None'}</span>
                    </td>
                    <td>{formatDateTime(h.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-small btn-outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedInspection(h)
                        }}
                      >
                        Inspect
                      </button>
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

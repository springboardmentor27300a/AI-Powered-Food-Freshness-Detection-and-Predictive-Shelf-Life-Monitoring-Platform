import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../StatusBadge'
import { PageLoading } from '../Spinner'
import {
  AlertIcon, BoxIcon, PlusCircleIcon, RefreshIcon, ReportIcon,
  ThermometerIcon, SparkleIcon, DownloadIcon
} from '../icons'
import api, { getErrorMessage } from '../../services/api'
import { formatDate, formatQuantity, downloadReport } from '../../utils/helpers'

export default function WarehouseOperatorDashboard({ user }) {
  const [batches, setBatches] = useState([])
  const [storageData, setStorageData] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [updatingBatch, setUpdatingBatch] = useState(null)
  const [tempInput, setTempInput] = useState('')
  const [humInput, setHumInput] = useState('')
  const [airInput, setAirInput] = useState('good')
  const [lightInput, setLightInput] = useState('low')
  const [savingReading, setSavingReading] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, stRes, anaRes] = await Promise.all([
        api.get('/batches', { params: { limit: 50 } }),
        api.get('/storage'),
        api.get('/analytics/storage').catch(() => ({ data: null })),
      ])
      const batchList = bRes.data || []
      const stList = stRes.data || []
      setBatches(batchList)
      setStorageData(stList)
      setAnalytics(anaRes.data)

      // Select an apple batch or first batch by default for the detail showcase
      const appleBatch = stList.find((b) => b.food_name?.toLowerCase().includes('apple')) || stList[0]
      if (appleBatch) setSelectedBatch(appleBatch)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load warehouse data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openUpdateModal = (batch) => {
    setUpdatingBatch(batch)
    setTempInput(batch.current_conditions?.temperature_c ?? '')
    setHumInput(batch.current_conditions?.humidity_pct ?? '')
    setAirInput(batch.current_conditions?.air_circulation || 'good')
    setLightInput(batch.current_conditions?.light_exposure || 'low')
    setUpdateMsg('')
  }

  const handleSaveReading = async (e) => {
    e.preventDefault()
    if (!updatingBatch) return
    setSavingReading(true)
    setUpdateMsg('')
    try {
      await api.post(`/storage/${updatingBatch.batch_id}`, {
        temperature_c: tempInput !== '' ? parseFloat(tempInput) : null,
        humidity_pct: humInput !== '' ? parseFloat(humInput) : null,
        air_circulation: airInput,
        light_exposure: lightInput,
      })
      setUpdateMsg('Storage reading recorded successfully!')
      setTimeout(() => {
        setUpdatingBatch(null)
        loadData()
      }, 1000)
    } catch (err) {
      setUpdateMsg(`Error: ${getErrorMessage(err)}`)
    } finally {
      setSavingReading(false)
    }
  }

  const handleExport = async (format) => {
    try {
      await downloadReport(
        `/reports/export?report_type=storage_compliance&file_format=${format}`,
        `storage-compliance-report.${format}`
      )
    } catch (err) {
      alert(`Export failed: ${getErrorMessage(err)}`)
    }
  }

  if (loading) return <PageLoading text="Loading warehouse logistics & storage data…" />

  const compliantCount = storageData.filter((s) => s.compliance_score >= 80).length
  const warningCount = storageData.filter((s) => s.compliance_score >= 50 && s.compliance_score < 80).length
  const nonCompliantCount = storageData.filter((s) => s.compliance_score < 50).length

  return (
    <div className="warehouse-dashboard">
      {/* Header Banner */}
      <div className="dashboard-hero-card">
        <div className="hero-content">
          <div className="role-tag warehouse-tag">Cold Chain & Warehouse Operations</div>
          <h2>Warehouse Storage Monitoring Dashboard</h2>
          <p className="hero-subtitle">
            Live environmental sensor tracking: temperature, relative humidity, air circulation, and light exposure compliance.
          </p>
          <div className="hero-meta-row">
            <span><strong>Warehouse Operator:</strong> {user.full_name}</span>
            <span>•</span>
            <span><strong>Monitored Batches:</strong> {storageData.length}</span>
            <span>•</span>
            <span><strong>Compliance Rate:</strong> {analytics?.overall_compliance ? `${analytics.overall_compliance}%` : '85%'}</span>
          </div>
        </div>
        <div className="hero-actions">
          <Link to="/add-food-item" className="btn btn-primary">
            <PlusCircleIcon size={16} /> Register Batch
          </Link>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('pdf')}
          >
            <DownloadIcon size={15} /> Storage PDF
          </button>
          <button
            type="button"
            className="btn btn-outline-white"
            onClick={() => handleExport('xlsx')}
          >
            <DownloadIcon size={15} /> Storage XLSX
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
          <span className="stat-value">{batches.length}</span>
          <span className="stat-label">Total Warehouse Batches</span>
        </article>
        <article className="stat-card tone-green">
          <span className="stat-value">{compliantCount}</span>
          <span className="stat-label">Storage Compliant (≥80%)</span>
        </article>
        <article className="stat-card tone-amber">
          <span className="stat-value">{warningCount}</span>
          <span className="stat-label">Needs Environmental Tweak</span>
        </article>
        <article className="stat-card tone-red">
          <span className="stat-value">{nonCompliantCount}</span>
          <span className="stat-label">Non-Compliant / High Risk</span>
        </article>
        <article className="stat-card tone-blue">
          <span className="stat-value">{analytics?.overall_compliance || '85'}%</span>
          <span className="stat-label">Avg Storage Compliance</span>
        </article>
      </section>

      {/* Detailed Demonstration Case: Product Storage Analysis (e.g. Apples) */}
      {selectedBatch && (
        <section className="panel" style={{ marginTop: '24px', borderLeft: '4px solid var(--green-600)' }}>
          <div className="panel-head">
            <div>
              <h3><ThermometerIcon size={18} /> Detailed Product Storage Analysis: {selectedBatch.food_name}</h3>
              <span className="muted small">Batch: <code>{selectedBatch.batch_id}</code> • Category: {selectedBatch.category}</span>
            </div>
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={() => openUpdateModal(selectedBatch)}
            >
              Update Sensor Readings
            </button>
          </div>

          <div className="warehouse-detail-grid">
            <div className="param-detail-card">
              <span className="param-title">Recommended Storage Area</span>
              <strong>{selectedBatch.requirements?.storage_environment || 'Controlled Atmosphere Cold Store'}</strong>
              <small className="muted">{selectedBatch.requirements?.packaging_requirement || 'Ventilated Crates'}</small>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Temperature Suitability</span>
              <div className="param-reading">
                Current: <strong>{selectedBatch.temperature?.value ?? 'Not set'}°C</strong>
              </div>
              <div className="param-recommended">
                Target: {selectedBatch.temperature?.recommended}
              </div>
              <span className={`badge badge-${selectedBatch.temperature?.status === 'good' ? 'green' : 'amber'}`}>
                {selectedBatch.temperature?.status?.toUpperCase()}
              </span>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Humidity Suitability</span>
              <div className="param-reading">
                Current: <strong>{selectedBatch.humidity?.value ?? 'Not set'}%</strong>
              </div>
              <div className="param-recommended">
                Target: {selectedBatch.humidity?.recommended}
              </div>
              <span className={`badge badge-${selectedBatch.humidity?.status === 'good' ? 'green' : 'amber'}`}>
                {selectedBatch.humidity?.status?.toUpperCase()}
              </span>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Air Circulation & Light</span>
              <div>Air: <strong>{selectedBatch.air_circulation?.value || 'Good'}</strong> ({selectedBatch.air_circulation?.status})</div>
              <div>Light: <strong>{selectedBatch.light_exposure?.value || 'Low'}</strong> ({selectedBatch.light_exposure?.status})</div>
              <small className="muted">{selectedBatch.requirements?.light_requirement}</small>
            </div>

            <div className="param-detail-card">
              <span className="param-title">Storage Duration & Compliance</span>
              <div>Days Stored: <strong>{selectedBatch.days_stored} days</strong></div>
              <div>Max Duration: <strong>{selectedBatch.requirements?.maximum_duration_days} days</strong></div>
              <div className="strong" style={{ marginTop: '4px' }}>
                Score: <span className="text-green">{selectedBatch.compliance_score}%</span> ({selectedBatch.condition_status})
              </div>
            </div>

            <div className="param-detail-card highlight-card">
              <span className="param-title"><SparkleIcon size={14} /> Recommended Action</span>
              <p className="rec-text" style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                {selectedBatch.optimization_recommendations?.[0] || 'Maintain current temperature and airflow settings.'}
              </p>
              <div className="muted small">
                Consumption Priority: <strong>{selectedBatch.consumption_priority || 'NORMAL ROTATION'}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Warehouse Batches Environmental Status Table */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-head">
          <div>
            <h3>Warehouse Inventory Storage Compliance</h3>
            <span className="muted small">Click any batch to inspect environmental parameters</span>
          </div>
          <Link to="/storage" className="btn btn-small btn-outline">Full Storage Monitor</Link>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Food Item</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Air / Light</th>
                <th>Stored</th>
                <th>Compliance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {storageData.map((s) => (
                <tr
                  key={s.batch_id}
                  className={selectedBatch?.batch_id === s.batch_id ? 'active-row' : ''}
                  onClick={() => setSelectedBatch(s)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><code>{s.batch_id}</code></td>
                  <td><strong>{s.food_name}</strong></td>
                  <td>
                    {s.temperature?.value != null ? `${s.temperature.value}°C` : '—'}
                    <small className="muted" style={{ display: 'block' }}>{s.temperature?.status}</small>
                  </td>
                  <td>
                    {s.humidity?.value != null ? `${s.humidity.value}%` : '—'}
                    <small className="muted" style={{ display: 'block' }}>{s.humidity?.status}</small>
                  </td>
                  <td>
                    <small>{s.air_circulation?.value || '—'} / {s.light_exposure?.value || '—'}</small>
                  </td>
                  <td>{s.days_stored}d</td>
                  <td>
                    <span className={`badge ${s.compliance_score >= 80 ? 'badge-green' : s.compliance_score >= 50 ? 'badge-amber' : 'badge-red'}`}>
                      {s.compliance_score}%
                    </span>
                  </td>
                  <td>
                    <span className="small">{s.condition_status}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-small btn-outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        openUpdateModal(s)
                      }}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal for Updating Environmental Values */}
      {updatingBatch && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-head">
              <h3>Record Environmental Readings: {updatingBatch.food_name}</h3>
              <button type="button" className="modal-close" onClick={() => setUpdatingBatch(null)}>×</button>
            </div>
            <form onSubmit={handleSaveReading} className="modal-body">
              <p className="muted small">
                Batch: <code>{updatingBatch.batch_id}</code> • Location: {updatingBatch.requirements?.scope || 'Warehouse Cold Store'}
              </p>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  placeholder="e.g. 3.5"
                  required
                />
                <small className="muted">Recommended: {updatingBatch.temperature?.recommended}</small>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Relative Humidity (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={humInput}
                  onChange={(e) => setHumInput(e.target.value)}
                  placeholder="e.g. 90"
                  required
                />
                <small className="muted">Recommended: {updatingBatch.humidity?.recommended}</small>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Air Circulation</label>
                <select value={airInput} onChange={(e) => setAirInput(e.target.value)}>
                  <option value="good">Good (Active airflow / ventilation)</option>
                  <option value="moderate">Moderate</option>
                  <option value="poor">Poor (Stagnant)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Light Exposure</label>
                <select value={lightInput} onChange={(e) => setLightInput(e.target.value)}>
                  <option value="low">Low (Dark / UV-protected)</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High (Direct light)</option>
                  <option value="controlled">Controlled</option>
                </select>
              </div>

              {updateMsg && (
                <div className={`banner ${updateMsg.startsWith('Error') ? 'error' : 'success'}`} style={{ marginTop: '12px' }}>
                  {updateMsg}
                </div>
              )}

              <div className="btn-row" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setUpdatingBatch(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingReading}>
                  {savingReading ? 'Saving…' : 'Save Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

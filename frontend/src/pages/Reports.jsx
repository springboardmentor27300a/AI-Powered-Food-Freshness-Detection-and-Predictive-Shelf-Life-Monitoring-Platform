/**
 * Centralized Reports Page (Milestone 4).
 *
 * EXACTLY ONE centralized Reports page containing EXACTLY FIVE report types:
 *   1. Freshness Reports (freshness)
 *   2. Shelf-Life Reports (shelf_life)
 *   3. Inventory Quality Reports (inventory_quality)
 *   4. Waste Reduction Reports (waste_reduction)
 *   5. Storage Compliance Reports (storage_compliance)
 *
 * Backed by real server-side PDF and Excel export endpoints.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from '../components/StatusBadge'
import { PageLoading } from '../components/Spinner'
import { DownloadIcon, RefreshIcon, ReportIcon, SparkleIcon, CameraIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES } from '../utils/constants'
import { downloadReport, formatQuantity, formatScore, riskBadge } from '../utils/helpers'

const REPORT_TABS = [
  { id: 'freshness', label: '1. Freshness Reports', icon: '🍃' },
  { id: 'shelf_life', label: '2. Shelf-Life Reports', icon: '⏱️' },
  { id: 'inventory_quality', label: '3. Inventory Quality Reports', icon: '📦' },
  { id: 'waste_reduction', label: '4. Waste Reduction Reports', icon: '♻️' },
  { id: 'storage_compliance', label: '5. Storage Compliance Reports', icon: '🌡️' },
]

export default function Reports() {
  const [activeTab, setActiveTab] = useState('freshness')
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/reports/data', {
        params: { report_type: activeTab },
      })
      setReportData(res.data)
      setSelectedItem(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate report.'))
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExport = async (format) => {
    setDownloading(format)
    try {
      await downloadReport(
        `/reports/export?report_type=${activeTab}&file_format=${format}`,
        `${activeTab}-report.${format}`
      )
    } catch (err) {
      alert(`Export failed: ${getErrorMessage(err)}`)
    } finally {
      setDownloading('')
    }
  }

  // Filter items
  const items = reportData?.items || []
  const filteredItems = items.filter((it) => {
    const text = `${it.food_name || it.product || ''} ${it.batch_id || ''}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false
    if (categoryFilter && (it.category || '') !== categoryFilter) return false
    return true
  })

  return (
    <div className="page reports-page">
      {/* Header Banner */}
      <div className="page-head">
        <div>
          <h2>Centralized Food Quality & Freshness Reports</h2>
          <p className="muted">
            Official quality assurance reporting center with PDF and Excel export capabilities.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadReport}
            disabled={loading}
          >
            <RefreshIcon size={15} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleExport('pdf')}
            disabled={loading || !!downloading}
          >
            <DownloadIcon size={15} /> {downloading === 'pdf' ? 'Generating PDF…' : 'Export PDF'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleExport('xlsx')}
            disabled={loading || !!downloading}
          >
            <DownloadIcon size={15} /> {downloading === 'xlsx' ? 'Generating Excel…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="banner error">
          {error}
          <button type="button" className="btn btn-small btn-outline" onClick={loadReport}>Retry</button>
        </div>
      )}

      {/* Exactly FIVE Report Types Tab Navigation */}
      <div className="report-tabs-bar" style={{ margin: '16px 0 24px' }}>
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`report-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              setSearch('')
              setCategoryFilter('')
            }}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="toolbar" style={{ marginBottom: '16px' }}>
        <div className="search-box">
          <input
            type="search"
            placeholder="Search by food name or batch ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {FOOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(search || categoryFilter) && (
          <button
            type="button"
            className="btn btn-small btn-outline"
            onClick={() => { setSearch(''); setCategoryFilter('') }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <PageLoading text={`Generating ${activeTab.replace('_', ' ')} report…`} />
      ) : reportData && (
        <>
          {/* Executive Summary Cards */}
          {reportData.summary && (
            <section className="stat-grid" style={{ marginBottom: '20px' }}>
              {reportData.summary.map(([lbl, val], idx) => (
                <article key={idx} className="stat-card tone-neutral">
                  <span className="stat-value">{val}</span>
                  <span className="stat-label">{lbl}</span>
                </article>
              ))}
            </section>
          )}

          {/* Active Report Table Render */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>{reportData.title}</h3>
                <span className="muted small">
                  Generated On: {reportData.generated_on} • Showing {filteredItems.length} records
                </span>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <p>No records match your filters for this report type.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {reportData.table_header.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. FRESHNESS REPORT */}
                    {activeTab === 'freshness' && filteredItems.map((r, i) => (
                      <tr key={i} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer' }}>
                        <td><strong>{r.food_name}</strong></td>
                        <td>{r.category}</td>
                        <td><code>{r.batch_id}</code></td>
                        <td><strong>{r.freshness_score}/100</strong></td>
                        <td>
                          <span className={`badge ${r.freshness_category === 'Fresh' ? 'badge-green' : r.freshness_category === 'Good' ? 'badge-blue' : r.freshness_category === 'Acceptable' ? 'badge-amber' : 'badge-red'}`}>
                            {r.freshness_category}
                          </span>
                        </td>
                        <td>
                          <span className={parseFloat(r.spoilage_probability) > 30 ? 'text-red strong' : 'text-green'}>
                            {r.spoilage_probability}
                          </span>
                        </td>
                        <td>{r.analysis_date}</td>
                        <td>{r.confidence}</td>
                        <td><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}

                    {/* 2. SHELF-LIFE REPORT */}
                    {activeTab === 'shelf_life' && filteredItems.map((r, i) => (
                      <tr key={i} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer' }}>
                        <td><strong>{r.food_name}</strong></td>
                        <td><code>{r.batch_id}</code></td>
                        <td>{r.storage_duration}</td>
                        <td>
                          <span className={r.remaining_days <= 1 ? 'text-red strong' : r.remaining_days <= 3 ? 'text-amber strong' : 'text-green'}>
                            {r.remaining_days} days
                          </span>
                        </td>
                        <td>{r.expected_expiry_date}</td>
                        <td><span className={`badge ${riskBadge(r.spoilage_risk?.toLowerCase())}`}>{r.spoilage_risk}</span></td>
                        <td>{r.confidence}</td>
                      </tr>
                    ))}

                    {/* 3. INVENTORY QUALITY REPORT */}
                    {activeTab === 'inventory_quality' && filteredItems.map((r, i) => (
                      <tr key={i} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer' }}>
                        <td><code>{r.batch_id}</code></td>
                        <td><strong>{r.food_name}</strong></td>
                        <td>{r.category}</td>
                        <td>{formatQuantity(r.available_quantity)}</td>
                        <td>{r.unit}</td>
                        <td>{r.expiry_date}</td>
                        <td><StatusBadge status={r.freshness_status} /></td>
                        <td><strong>{formatScore(r.overall_score)}/100</strong></td>
                        <td><span className={`badge ${riskBadge(r.spoilage_risk?.toLowerCase())}`}>{r.spoilage_risk}</span></td>
                      </tr>
                    ))}

                    {/* 4. WASTE REDUCTION REPORT */}
                    {activeTab === 'waste_reduction' && filteredItems.map((r, i) => (
                      <tr key={i} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer' }}>
                        <td><code>{r.batch_id}</code></td>
                        <td><strong>{r.food_name}</strong></td>
                        <td>{r.category}</td>
                        <td>{r.available_quantity}</td>
                        <td>
                          <span className={r.remaining_days <= 1 ? 'text-red strong' : 'text-amber'}>
                            {r.remaining_days} days
                          </span>
                        </td>
                        <td><StatusBadge status={r.freshness_status} /></td>
                        <td><span className={`badge ${riskBadge(r.spoilage_risk?.toLowerCase())}`}>{r.spoilage_risk}</span></td>
                        <td><span className="small strong">{r.recommended_action}</span></td>
                        <td><span className="small muted">{r.rotation}</span></td>
                      </tr>
                    ))}

                    {/* 5. STORAGE COMPLIANCE REPORT */}
                    {activeTab === 'storage_compliance' && filteredItems.map((r, i) => (
                      <tr key={i} onClick={() => setSelectedItem(r)} style={{ cursor: 'pointer' }}>
                        <td><strong>{r.food_name}</strong></td>
                        <td><code>{r.batch_id}</code></td>
                        <td>{r.current_temp}</td>
                        <td><small className="muted">{r.recommended_temp}</small></td>
                        <td>{r.current_humidity}</td>
                        <td><small className="muted">{r.recommended_humidity}</small></td>
                        <td>{r.air_circulation}</td>
                        <td>{r.light_exposure}</td>
                        <td>
                          <span className={`badge ${parseInt(r.compliance) >= 80 ? 'badge-green' : parseInt(r.compliance) >= 50 ? 'badge-amber' : 'badge-red'}`}>
                            {r.compliance}
                          </span>
                        </td>
                        <td><span className={`badge ${riskBadge(r.risk_level?.toLowerCase())}`}>{r.risk_level}</span></td>
                        <td><small>{r.recommendation}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Record Inspection Detail Drawer / Modal */}
          {selectedItem && (
            <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h3>Record Details: {selectedItem.food_name || selectedItem.batch_id}</h3>
                  <button type="button" className="modal-close" onClick={() => setSelectedItem(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="table-wrap">
                    <table className="data-table">
                      <tbody>
                        {Object.entries(selectedItem).map(([k, v]) => (
                          <tr key={k}>
                            <td className="strong" style={{ width: '40%', textTransform: 'capitalize' }}>
                              {k.replace(/_/g, ' ')}
                            </td>
                            <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="btn-row" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={() => setSelectedItem(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

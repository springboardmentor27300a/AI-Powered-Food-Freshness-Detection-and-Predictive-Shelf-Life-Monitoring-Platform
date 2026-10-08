/**
 * Inventory Insights (Milestone 3).
 *
 * Aggregated insight cards (freshness counts, at-risk, expiring soon,
 * averages), category breakdown, waste-risk items and PDF/Excel exports of
 * the inventory-quality / waste-reduction reports.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { BarChart, StatusPill } from '../components/Charts'
import { PageLoading } from '../components/Spinner'
import { DownloadIcon, RefreshIcon } from '../components/icons'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES, FRESHNESS_STATUSES } from '../utils/constants'
import { downloadReport, formatQuantity, formatScore, riskBadge } from '../utils/helpers'

export default function Insights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [downloading, setDownloading] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [risk, setRisk] = useState('')
  const [expiringDays, setExpiringDays] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const params = {}
      if (category) params.category = category
      if (status) params.status = status
      if (risk) params.risk = risk
      if (expiringDays) params.expiring_within = Number(expiringDays)
      const res = await api.get('/insights/inventory', { params })
      setData(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [category, status, risk, expiringDays])

  useEffect(() => { load() }, [load])

  const exportReport = async (reportType, format) => {
    setDownloading(`${reportType}-${format}`)
    try {
      await downloadReport(
        `/reports/export-inventory?report_type=${reportType}&file_format=${format}`,
        `${reportType}-${format}.${format}`
      )
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err, 'Export failed.') })
    } finally {
      setDownloading('')
    }
  }

  const clearFilters = () => { setCategory(''); setStatus(''); setRisk(''); setExpiringDays('') }
  const hasFilters = Boolean(category || status || risk || expiringDays)

  const byCat = (data && data.by_category) || {}
  const catItems = Object.entries(byCat).map(([label, value]) => ({ label, value }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Inventory Insights</h2>
          <p className="muted">Rollup of freshness, shelf-life, storage and waste-risk metrics across your inventory.</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshIcon /> Refresh
          </button>
          <button type="button" className="btn btn-small btn-outline" disabled={!!downloading}
                  onClick={() => exportReport('inventory_quality', 'pdf')}>
            <DownloadIcon /> Quality PDF
          </button>
          <button type="button" className="btn btn-small btn-outline" disabled={!!downloading}
                  onClick={() => exportReport('inventory_quality', 'xlsx')}>
            <DownloadIcon /> Quality XLSX
          </button>
          <button type="button" className="btn btn-small btn-outline" disabled={!!downloading}
                  onClick={() => exportReport('waste_reduction', 'pdf')}>
            <DownloadIcon /> Waste PDF
          </button>
          <button type="button" className="btn btn-small btn-outline" disabled={!!downloading}
                  onClick={() => exportReport('waste_reduction', 'xlsx')}>
            <DownloadIcon /> Waste XLSX
          </button>
        </div>
      </div>

      {banner && (
        <div className={`banner ${banner.type}`}>
          {banner.text}
          <button type="button" className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {loading ? <PageLoading text="Computing insights…" /> : data && (
        <>
          <div className="stat-grid">
            <div className="stat-card tone-neutral">
              <div className="stat-value">{data.total_products}</div>
              <div className="stat-label">Total products</div>
            </div>
            <div className="stat-card tone-green">
              <div className="stat-value">{data.fresh_count}</div>
              <div className="stat-label">Fresh</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{data.acceptable_count}</div>
              <div className="stat-label">Acceptable</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{data.needs_attention_count}</div>
              <div className="stat-label">Need attention</div>
            </div>
            <div className="stat-card tone-red">
              <div className="stat-value">{data.spoiled_count}</div>
              <div className="stat-label">Spoiled</div>
            </div>
            <div className="stat-card tone-red">
              <div className="stat-value">{data.at_risk_count}</div>
              <div className="stat-label">At risk (high/critical)</div>
            </div>
            <div className="stat-card tone-amber">
              <div className="stat-value">{data.expiring_within_7_count}</div>
              <div className="stat-label">Expiring ≤ 7 days</div>
            </div>
            <div className="stat-card tone-neutral">
              <div className="stat-value">{data.expired_count}</div>
              <div className="stat-label">Expired</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{formatScore(data.average_freshness_score)}</div>
              <div className="stat-label">Avg freshness score</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{formatScore(data.average_shelf_life_days)}d</div>
              <div className="stat-label">Avg remaining shelf life</div>
            </div>
            <div className="stat-card tone-blue">
              <div className="stat-value">{formatScore(data.average_storage_compliance)}</div>
              <div className="stat-label">Avg storage compliance</div>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="">All Categories</option>
              {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All Statuses</option>
              {FRESHNESS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filter by risk">
              <option value="">All Risk Levels</option>
              {['Low', 'Moderate', 'High', 'Critical'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={expiringDays} onChange={(e) => setExpiringDays(e.target.value)} aria-label="Expiring within">
              <option value="">Any shelf life</option>
              {[3, 7, 14, 30].map((d) => <option key={d} value={d}>Expiring within {d} days</option>)}
            </select>
            {hasFilters && (
              <>
                <span className="muted small strong">{data.filtered_count} of {data.total_products} matched</span>
                <button type="button" className="btn btn-small btn-outline" onClick={clearFilters}>Clear</button>
              </>
            )}
          </div>

          {catItems.length > 0 && (
            <section className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head"><h3>Products by Category</h3></div>
              <BarChart items={catItems} />
            </section>
          )}

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h3>Waste-Risk Items</h3></div>
            {(data.waste_risk_items || []).length === 0 ? (
              <p className="empty-inline">No high/critical-risk items right now.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Item</th><th>Remaining</th><th>Expected Expiry</th><th>Freshness</th><th>Risk</th><th>Qty</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {data.waste_risk_items.map((it) => (
                      <tr key={it.batch_id}>
                        <td>
                          <Link to={`/shelf-life/${it.batch_id}`} className="strong">{it.food_name}</Link>
                          <div className="table-sub muted small"><code>{it.batch_id}</code> · {it.category}</div>
                        </td>
                        <td>{it.remaining_days} day{it.remaining_days === 1 ? '' : 's'}</td>
                        <td>{it.expected_expiry_date?.slice(0, 10)}</td>
                        <td><StatusPill status={it.freshness_status} /></td>
                        <td><span className={`badge ${riskBadge(it.spoilage_risk?.toLowerCase())}`}>{it.spoilage_risk}</span></td>
                        <td className="muted">{formatQuantity(it.available_quantity)} {it.unit}</td>
                        <td className="actions-col">
                          <Link to={`/shelf-life/${it.batch_id}`} className="btn btn-small btn-outline">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
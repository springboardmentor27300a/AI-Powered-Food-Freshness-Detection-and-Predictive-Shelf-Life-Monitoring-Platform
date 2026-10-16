import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileBarChart, Loader2, FileDown, FileSpreadsheet, Trash2, Eye, Filter, RefreshCw, X,
} from 'lucide-react';
import {
  apiGet, apiPost, apiDelete, apiDownload, formatDate, formatDateTime,
} from '../../api';

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const labelStyle = { color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry', 'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages'];
const STATUSES = ['all', 'Active', 'Sold Out', 'Consumed', 'Disposed', 'Expired', 'Archived'];

export default function ReportsDashboard({ role }) {
  const [types, setTypes] = useState([]);
  const [reportType, setReportType] = useState('freshness');
  const [filters, setFilters] = useState({ date_from: '', date_to: '', category: '', item_id: '', batch_number: '', status: 'all' });
  const [items, setItems] = useState([]);
  const [saved, setSaved] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSaved = useCallback(async () => {
    try {
      const data = await apiGet(`/api/reports?limit=100${reportType ? `&report_type=${reportType}` : ''}`);
      setSaved(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  }, [reportType]);

  useEffect(() => {
    (async () => {
      try {
        const [t, inventory] = await Promise.all([
          apiGet('/api/reports/types'),
          role === 'Consumer'
            ? apiGet('/api/inventory/?scope=mine')
            : apiGet('/api/inventory/'),
        ]);
        setTypes(Array.isArray(t) ? t : []);
        setItems(Array.isArray(inventory) ? inventory : []);
      } catch (err) {
        setError(`Failed to load report metadata: ${err.message}`);
      }
    })();
  }, [role]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const handleFilter = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const payload = {
        report_type: reportType,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'all')),
      };
      const doc = await apiPost('/api/reports/generate', payload);
      showToast(`${doc.title} generated (${(doc.summary || []).length} key figures)`);
      await loadSaved();
      setViewing(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const view = async (id) => {
    setViewLoading(true);
    try {
      const doc = await apiGet(`/api/reports/${id}`);
      setViewing(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setViewLoading(false);
    }
  };

  const download = async (report, format) => {
    setDownloading(`${report._id}-${format}`);
    try {
      await apiDownload(
        `/api/reports/${report._id}/export?format=${format}`,
        `${report.title.replace(/ /g, '_')}_${format}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
      );
      showToast(`${format.toUpperCase()} export downloaded`);
    } catch (err) {
      showToast(`Export failed: ${err.message}`, false);
    } finally {
      setDownloading(null);
    }
  };

  const remove = async (report) => {
    try {
      await apiDelete(`/api/reports/${report._id}`);
      showToast('Report deleted');
      await loadSaved();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Reports</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Generate, filter, view and export platform reports. Every figure is computed from persisted database records.
      </p>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px' }}>{error}</div>}
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1200, backgroundColor: toast.ok ? '#dcfce7' : '#fee2e2', color: toast.ok ? '#15803d' : '#b91c1c', padding: '14px 20px', borderRadius: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ ...card, marginBottom: '32px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><FileBarChart size={18} /> Generate a Report</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={inputStyle}>
              {(types.length ? types : Object.entries({
                freshness: 'Freshness Report', shelf_life: 'Shelf-Life Report',
                inventory_quality: 'Inventory Quality Report', waste_reduction: 'Waste Reduction Report',
                storage_compliance: 'Storage Compliance Report',
              }).map(([id, name]) => ({ id, name }))).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>From (date)</label>
            <input type="date" name="date_from" value={filters.date_from} onChange={handleFilter} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>To (date)</label>
            <input type="date" name="date_to" value={filters.date_to} onChange={handleFilter} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select name="category" value={filters.category} onChange={handleFilter} style={inputStyle}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {reportType === 'inventory_quality' && (
            <>
              <div>
                <label style={labelStyle}>Batch number</label>
                <input name="batch_number" value={filters.batch_number} onChange={handleFilter} placeholder="e.g. B-2024-001" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lifecycle status</label>
                <select name="status" value={filters.status} onChange={handleFilter} style={inputStyle}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>Product</label>
            <select name="item_id" value={filters.item_id} onChange={handleFilter} style={inputStyle}>
              <option value="">All products</option>
              {items.map((i) => (
                <option key={i._id} value={i._id}>{i.name} · {i.batch_number}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="button"
          style={{ marginTop: '20px', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center' }}
        >
          {generating ? <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> : <Filter size={16} style={{ marginRight: '8px' }} />}
          {generating ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Saved Reports</h2>
          <button onClick={loadSaved} className="button" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', color: '#111', border: '1px solid #e5e5e5' }}>
            <RefreshCw size={16} style={{ marginRight: '8px' }} /> Refresh
          </button>
        </div>
        {saved.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No reports saved yet. Generate one above - every generated report is persisted.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Title', 'Type', 'Filters', 'Generated By', 'Created', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saved.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.title}</td>
                    <td style={{ padding: '12px 16px', color: '#4b5563', textTransform: 'capitalize' }}>{(r.report_type || 'freshness (scan)').replace(/_/g, ' ')}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>
                      {Object.entries(r.filters || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'None'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4b5563' }}>{r.created_by_username || 'N/A'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(r.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button onClick={() => view(r._id)} style={btn('#111')}>
                          <Eye size={12} /> View
                        </button>
                        <button onClick={() => download(r, 'pdf')} disabled={downloading === `${r._id}-pdf`} style={btn('#dc2626')}>
                          {downloading === `${r._id}-pdf` ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} PDF
                        </button>
                        <button onClick={() => download(r, 'xlsx')} disabled={downloading === `${r._id}-xlsx`} style={btn('#15803d')}>
                          {downloading === `${r._id}-xlsx` ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Excel
                        </button>
                        {role === 'Administrator' && (
                          <button onClick={() => remove(r)} style={btn('#b91c1c')}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewing && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setViewing(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '900px', maxHeight: '88vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f3f4f6', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{viewing.title || 'Report'}</h2>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
                    Generated {formatDateTime(viewing.created_at)} by {viewing.created_by_username || 'N/A'}
                    {' '}· Filters: {Object.entries(viewing.filters || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'None'}
                  </p>
                </div>
                <button onClick={() => setViewing(null)} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center' }}><X size={14} /> Close</button>
              </div>

              {viewLoading && <p style={{ color: '#9ca3af' }}>Loading persisted report…</p>}

              {viewing.description && <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>{viewing.description}</p>}

              {(viewing.summary || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {viewing.summary.map((s, i) => (
                    <div key={i} style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '14px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '4px', wordBreak: 'break-word' }}>{String(s.value)}</div>
                    </div>
                  ))}
                </div>
              )}

              {(viewing.analysis || viewing.prediction) && (
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 8px' }}>Scan Report Details</h4>
                  <div style={{ fontSize: '0.9rem', display: 'grid', gap: '4px' }}>
                    <div><b>AI status:</b> {viewing.analysis?.ml_status || 'N/A'} · confidence {viewing.analysis?.confidence ?? 'N/A'}</div>
                    <div><b>Quality score:</b> {viewing.analysis?.quality_score ?? 'N/A'}/100</div>
                    <div><b>Shelf-life:</b> {viewing.prediction?.effective_remaining_days ?? 'N/A'} days remaining · risk {viewing.prediction?.risk_level || 'N/A'}</div>
                    {viewing.prediction?.estimate_disclaimer && (
                      <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{viewing.prediction.estimate_disclaimer}</div>
                    )}
                  </div>
                </div>
              )}

              {(viewing.tables || []).map((t, i) => (
                <div key={i} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>{t.name}</h3>
                  {(t.rows || []).length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No records in the selected period.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '600px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {t.columns.map((c) => <th key={c} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.slice(0, 50).map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              {row.map((v, ci) => <td key={ci} style={{ padding: '7px 10px' }}>{String(v ?? 'N/A')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {t.rows.length > 50 && <p style={{ color: '#9ca3af', fontSize: '0.78rem' }}>Showing first 50 of {t.rows.length} records - export for the full dataset.</p>}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => download(viewing, 'pdf')} style={btn('#dc2626')}><FileDown size={14} /> Export PDF</button>
                <button onClick={() => download(viewing, 'xlsx')} style={btn('#15803d')}><FileSpreadsheet size={14} /> Export Excel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function btn(color) {
  return {
    padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
    backgroundColor: `${color}15`, color, border: `1px solid ${color}55`,
    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px',
  };
}

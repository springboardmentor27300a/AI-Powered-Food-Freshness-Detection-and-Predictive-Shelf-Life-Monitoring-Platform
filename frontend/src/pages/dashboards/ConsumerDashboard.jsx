import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf, Clock, ShoppingBag, AlertTriangle, BellRing, Upload, Plus, Loader2,
  FileText, RefreshCw, Archive, X, CheckCircle2, Eye, FileDown, FileSpreadsheet, Timer, Lightbulb,
} from 'lucide-react';
import {
  apiGet, apiPost, apiUpload, apiDownload, imageUrl, riskColor, formatDays, formatDate, formatDateTime,
} from '../../api';

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const labelStyle = { color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry', 'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages'];
const PACKAGING = ['Vacuum Sealed', 'Modified Atmosphere', 'Sealed Container', 'Ventilated', 'Open', 'None'];

const emptyForm = {
  name: '', category: 'Fruits', quantity: 1, batch_number: '', expiry_date: '',
  storage_zone: '', temperature_c: '', humidity_pct: '', packaging_type: 'Ventilated',
};

export default function ConsumerDashboard() {
  const [items, setItems] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removeBusy, setRemoveBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [reportView, setReportView] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const load = useCallback(async (view = showArchived) => {
    setLoading(true);
    setError(null);
    try {
      const lc = view ? 'lifecycle=archived_view' : '';
      const [inventory, myAlerts, myScans, mySavedReports] = await Promise.all([
        apiGet(`/api/inventory/?scope=mine${view ? '&lifecycle=archived_view' : ''}`),
        apiGet('/api/alerts?limit=10'),
        apiGet('/api/ml/scans?limit=10'),
        apiGet('/api/reports?limit=20'),
      ]);
      setItems(Array.isArray(inventory) ? inventory : []);
      setAlerts(Array.isArray(myAlerts) ? myAlerts : []);
      setScans(Array.isArray(myScans) ? myScans : []);
      setMyReports(Array.isArray(mySavedReports) ? mySavedReports : []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: ['quantity', 'temperature_c', 'humidity_pct'].includes(name)
        ? (value === '' ? null : parseFloat(value)) : value,
    }));
  };

  const registerProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiPost('/api/inventory', {
        ...form,
        expiry_date: form.expiry_date || null,
        stored_at: new Date().toISOString(),
      });
      setForm(emptyForm);
      setShowRegister(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startScan = (itemId) => {
    setUploadingFor(itemId);
    uploadTargetRef.current = itemId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const onScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetRef.current) return;
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('item_id', uploadTargetRef.current);
      const result = await apiUpload('/api/ml/predict', formData);
      setToast({ ok: true, msg: `Scan complete: ${result.status} - quality ${result.freshness_score ?? 'N/A'}/100` });
      setTimeout(() => setToast(null), 4000);
      await load();
    } catch (err) {
      setError(`Scan failed: ${err.message}`);
    } finally {
      setUploadingFor(null);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    try {
      await apiPost(`/api/inventory/${removeTarget.item._id}/archive`, { reason: removeReason || 'removed by owner' });
      setRemoveTarget(null);
      setRemoveReason('');
      setToast({ ok: true, msg: `${removeTarget.item.name} removed from My Food - scan history preserved` });
      setTimeout(() => setToast(null), 4000);
      await load();
    } catch (err) {
      setToast({ ok: false, msg: err.message });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setRemoveBusy(false);
    }
  };

  const isExpired = (expiryDate) => expiryDate && new Date(expiryDate) < new Date();

  const openReport = async (scan) => {
    if (!scan.report_id) return;
    setReportLoading(true);
    try {
      const report = await apiGet(`/api/reports/${scan.report_id}`);
      setReportView(report);
    } catch (err) {
      setToast({ ok: false, msg: `Failed to load report: ${err.message}` });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading && items === null) {
    return <div style={card}><p style={{ color: '#6b7280', margin: 0 }}>Loading your food…</p></div>;
  }

  const available = (items || []).filter((i) => i.is_available && !isExpired(i.expiry_date));
  const expired = (items || []).filter((i) => isExpired(i.expiry_date));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>My Food</h1>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => { setShowArchived(!showArchived); load(!showArchived); }} className="button" style={{ display: 'flex', alignItems: 'center', backgroundColor: showArchived ? '#000' : '#fff', color: showArchived ? '#fff' : '#111', border: '1px solid #e5e5e5' }}>
            <Archive size={16} style={{ marginRight: '8px' }} /> {showArchived ? 'Viewing Removed' : 'Removed Items'}
          </button>
          <button onClick={() => load()} className="button" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', color: '#111', border: '1px solid #e5e5e5' }}>
            <RefreshCw size={16} style={{ marginRight: '8px' }} /> Refresh
          </button>
          {!showArchived && (
            <button onClick={() => setShowRegister(!showRegister)} className="button" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', color: '#fff' }}>
              <Plus size={16} style={{ marginRight: '8px' }} /> Register Food
            </button>
          )}
        </div>
      </div>
      <p style={{ color: '#666', marginBottom: '32px' }}>Personal freshness monitoring - your products, scans and alerts.</p>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px' }}>{error}</div>}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onScanFile} />

      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1200, backgroundColor: toast.ok ? '#dcfce7' : '#fee2e2', color: toast.ok ? '#15803d' : '#b91c1c', padding: '14px 20px', borderRadius: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}
      <AnimatePresence>
        {removeTarget && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setRemoveTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px' }}>
              <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}><Archive size={18} /> Remove from My Food</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 14px' }}>
                <b>{removeTarget.item.name}</b> (Batch {removeTarget.item.batch_number}) will be archived.
                Its scans, reports and shelf-life history are preserved and can be viewed under "Removed".
              </p>
              <label style={labelStyle}>Reason (optional)</label>
              <input value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="e.g. eaten, thrown away" style={inputStyle} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button onClick={() => setRemoveTarget(null)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmRemove} disabled={removeBusy} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 600, cursor: removeBusy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {removeBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} Archive Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRegister && (
          <motion.form
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={registerProduct}
            style={{ ...card, marginBottom: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', overflow: 'hidden' }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ margin: 0 }}>Register a Food Product</h3>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>Saved to your personal inventory with a batch record.</p>
            </div>
            <div><label style={labelStyle}>Product Name *</label><input name="name" value={form.name} onChange={handleChange} required style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Category</label>
              <select name="category" value={form.category} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Quantity *</label><input name="quantity" type="number" min="0" value={form.quantity ?? ''} onChange={handleChange} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Batch Number *</label><input name="batch_number" value={form.batch_number} onChange={handleChange} required placeholder="e.g. B-2024-001" style={inputStyle} /></div>
            <div><label style={labelStyle}>Expiry Date</label><input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} style={inputStyle} /></div>
            <div><label style={labelStyle}>Storage Zone</label><input name="storage_zone" value={form.storage_zone} onChange={handleChange} placeholder="e.g. Home Fridge" style={inputStyle} /></div>
            <div><label style={labelStyle}>Temperature (°C)</label><input name="temperature_c" type="number" step="0.5" value={form.temperature_c ?? ''} onChange={handleChange} style={inputStyle} /></div>
            <div><label style={labelStyle}>Humidity (%)</label><input name="humidity_pct" type="number" min="0" max="100" value={form.humidity_pct ?? ''} onChange={handleChange} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Packaging</label>
              <select name="packaging_type" value={form.packaging_type} onChange={handleChange} style={inputStyle}>
                {PACKAGING.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {formError && <p style={{ color: '#ef4444', fontSize: '0.85rem', gridColumn: '1 / -1', margin: 0 }}>{formError}</p>}
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={saving} className="button" style={{ backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center' }}>
                {saving ? <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> : null} Save Product
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#ecfccb', padding: '10px', borderRadius: '50%', color: '#65a30d' }}><Leaf size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Fresh Products</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{items ? available.length : '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Currently available</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '50%', color: '#dc2626' }}><AlertTriangle size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Expired</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626' }}>{items ? expired.length : '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Past label expiry</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#f0f4ff', padding: '10px', borderRadius: '50%', color: '#2563eb' }}><BellRing size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Active Alerts</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{alerts.filter((a) => !a.is_read).length}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>{alerts.length} recent</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fdf4ff', padding: '10px', borderRadius: '50%', color: '#c026d3' }}><Upload size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>My Scans</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{scans.length}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Recent AI inspections</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={{ ...card, marginBottom: '32px' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><BellRing size={18} /> Recent Alerts</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            {alerts.map((a) => (
              <div key={a._id} style={{
                padding: '10px 14px', borderRadius: '12px',
                backgroundColor: a.severity === 'critical' ? '#fee2e2' : a.severity === 'high' ? '#ffedd5' : '#f9fafb',
                opacity: a.is_read ? 0.6 : 1,
              }}>
                <b style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{String(a.type).replace(/_/g, ' ')}</b>
                <span style={{ marginLeft: '8px', color: '#374151' }}>{a.message}</span>
                <span style={{ float: 'right', color: '#9ca3af', fontSize: '0.75rem' }}>{formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px' }}>{showArchived ? 'Removed / Archived Items (history preserved)' : 'My Inventory'}</h2>
        {!items ? <p style={{ color: '#9ca3af' }}>Loading…</p> : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
            <ShoppingBag size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>
              {showArchived ? 'Nothing removed yet.' : 'No products registered yet.'}
            </h3>
            <p style={{ margin: 0 }}>
              {showArchived ? 'Items you remove will appear here with their full scan history.' : 'Use "Register Food" above to add your first product.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {items.map((item) => (
              <div key={item._id} style={{ border: '1px solid #f3f4f6', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <b style={{ fontSize: '1.05rem' }}>{item.name}</b>
                    <span style={{ color: '#6b7280', marginLeft: '8px' }}>Batch {item.batch_number} · {item.quantity} units · {item.category}</span>
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '4px' }}>
                      {item.storage_zone ? `${item.storage_zone} · ` : ''}stored {formatDateTime(item.stored_at || item.created_at)}
                      {item.expiry_date ? ` · label expiry ${formatDate(item.expiry_date)}` : ''}
                    </div>
                    {item.ml_status && (
                      <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '0.75rem',
                          backgroundColor: item.ml_status === 'Rotten' ? '#fee2e2' : '#dcfce7',
                          color: item.ml_status === 'Rotten' ? '#b91c1c' : '#15803d',
                        }}>
                          {item.ml_status}
                        </span>
                        {item.quality_score != null && <span style={{ marginLeft: '8px', color: '#6b7280' }}>quality {item.quality_score}/100</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {!showArchived && (
                      <button
                        onClick={() => startScan(item._id)}
                        disabled={uploadingFor === item._id}
                        style={{
                          padding: '10px 16px', backgroundColor: '#111', color: '#fff', border: 'none',
                          borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', height: 'fit-content',
                        }}
                      >
                        {uploadingFor === item._id ? <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} /> : <Upload size={14} style={{ marginRight: '6px' }} />}
                        {uploadingFor === item._id ? 'Analyzing…' : 'Scan Image'}
                      </button>
                    )}
                    {item.status === 'Archived' ? (
                      <span style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={13} /> Archived {item.archived_at ? formatDateTime(item.archived_at) : ''}
                      </span>
                    ) : (
                      <button
                        onClick={() => setRemoveTarget({ item })}
                        style={{
                          padding: '10px 16px', backgroundColor: '#fff', color: '#d97706', border: '1px solid #fcd34d',
                          borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', height: 'fit-content',
                        }}
                      >
                        <X size={14} style={{ marginRight: '6px' }} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {(() => {
                  const latest = scans.find((s) => s.item_id === item._id);
                  if (!latest) return null;
                  const days = latest.effective_remaining_days ?? latest.shelf_life?.effective_remaining_days;
                  return (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '12px', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {latest.image_url && <img src={imageUrl(latest.image_url)} alt="scan" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' }} />}
                        <span><b>Last scan:</b> {latest.ml_status} · quality {latest.quality_score ?? 'N/A'}/100 · {formatDateTime(latest.scanned_at)}</span>
                        {days != null && latest.shelf_life?.risk_level && (
                          <span style={{ fontWeight: 700, color: riskColor(latest.shelf_life.risk_level) }}>
                            <Clock size={13} style={{ verticalAlign: '-2px' }} /> est. {formatDays(days)} remaining
                          </span>
                        )}
                      </div>
                      {latest.shelf_life && (
                        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '8px 0 0' }}>
                          {latest.shelf_life.estimate_disclaimer}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {latest.report_id && (
                          <button onClick={() => openReport(latest)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <Eye size={13} /> View Report (analysis, shelf-life & storage advice)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px' }}><FileText size={20} style={{ verticalAlign: '-3px' }} /> My Reports</h2>
        {myReports.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No reports yet. Scan a product to generate your first freshness report.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {myReports.map((r) => (
              <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px', flexWrap: 'wrap' }}>
                <div>
                  <b>{r.title || 'Freshness Report'}</b>
                  <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '8px' }}>
                    {(r.report_type || 'freshness (scan)').replace(/_/g, ' ')} · {formatDateTime(r.created_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {r.report_type ? (
                    <>
                      <button onClick={() => setReportView(r)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => apiDownload(`/api/reports/${r._id}/export?format=pdf`, `report_${r._id}.pdf`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        <FileDown size={12} /> PDF
                      </button>
                      <button onClick={() => apiDownload(`/api/reports/${r._id}/export?format=xlsx`, `report_${r._id}.xlsx`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#dcfce7', color: '#15803d', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        <FileSpreadsheet size={12} /> Excel
                      </button>
                    </>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>View via the product's "View Report" button</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px' }}>Recently Analyzed Items</h2>
        {scans.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No scans yet. Use "Scan Image" on one of your products.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {scans.map((s) => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                {s.image_url
                  ? <img src={imageUrl(s.image_url)} alt="scan" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                  : <FileText size={20} color="#9ca3af" />}
                <div style={{ flex: 1 }}>
                  <b>{s.food_type}</b>
                  <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '8px' }}>
                    {s.ml_status} · quality {s.quality_score ?? 'N/A'} · {formatDateTime(s.scanned_at)}
                  </span>
                </div>
                {s.report_id && (
                  <button onClick={() => openReport(s)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#fff', color: '#111', border: '1px solid #e5e5e5', borderRadius: '10px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                    <Eye size={12} /> View Report
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {reportView && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setReportView(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{reportView.title || 'Freshness Report'}</h2>
              <button onClick={() => setReportView(null)} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, color: '#4b5563' }}>Close</button>
            </div>

            {reportView.analysis && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}><Leaf size={15} style={{ verticalAlign: '-2px' }} /> Freshness Assessment</h3>
                <div style={{ fontSize: '0.92rem', display: 'grid', gap: '4px' }}>
                  <div><b>AI status:</b> {reportView.analysis.ml_status} · confidence {reportView.analysis.confidence != null ? `${(reportView.analysis.confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                  <div><b>Quality score:</b> {reportView.analysis.quality_score ?? 'N/A'}/100</div>
                  {reportView.analysis?.quality_assessment?.disclaimer && <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{reportView.analysis.quality_assessment.disclaimer}</div>}
                </div>
              </div>
            )}

            {reportView.prediction && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}><Timer size={15} style={{ verticalAlign: '-2px' }} /> Shelf-Life Estimate</h3>
                <div style={{ fontSize: '0.92rem', display: 'grid', gap: '4px' }}>
                  <div style={{ fontWeight: 800, color: riskColor(reportView.prediction.risk_level) }}>
                    {formatDays(reportView.prediction.effective_remaining_days)} remaining · {reportView.prediction.risk_level} risk
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{reportView.prediction.estimate_disclaimer}</div>
                </div>
              </div>
            )}

            {reportView.recommendations && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}><Lightbulb size={15} style={{ verticalAlign: '-2px' }} /> Recommendations & Storage Advice</h3>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {reportView.recommendations.map((rec, i) => (
                    <div key={i} style={{ fontSize: '0.88rem', padding: '6px 0', borderBottom: i < reportView.recommendations.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <b>{rec.title}</b> <span style={{ color: '#4b5563' }}>{rec.message || rec.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(reportView.summary || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {reportView.summary.map((s, i) => (
                  <div key={i} style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', wordBreak: 'break-word' }}>{String(s.value)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => apiDownload(`/api/reports/${reportView._id}/export?format=pdf`, `report_${reportView._id}.pdf`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <FileDown size={13} /> Export PDF
              </button>
              <button onClick={() => apiDownload(`/api/reports/${reportView._id}/export?format=xlsx`, `report_${reportView._id}.xlsx`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', backgroundColor: '#dcfce7', color: '#15803d', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <FileSpreadsheet size={13} /> Export Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

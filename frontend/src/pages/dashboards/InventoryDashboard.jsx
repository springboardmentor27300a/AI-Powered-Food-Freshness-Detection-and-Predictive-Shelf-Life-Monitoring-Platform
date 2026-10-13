import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Package, Calendar, Tag, Search, AlertTriangle, CheckCircle2, Loader2,
  Eye, DollarSign, Edit3, Trash2, Archive, Wrench, History, CalendarX,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, formatDate, formatDateTime } from '../../api';

const STATUS_COLORS = {
  Active: '#16a34a', 'Sold Out': '#6b7280', Consumed: '#0d9488',
  Disposed: '#ef4444', Expired: '#d97706', Archived: '#9ca3af',
};

const InventoryDashboard = ({ role }) => {
  const [items, setItems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', category: 'Fruits', quantity: 0, batch_number: '', expiry_date: '',
    temperature_c: '', humidity_pct: '', packaging_type: 'Ventilated', storage_zone: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [lifecycleView, setLifecycleView] = useState('active'); // active | archived_view
  const [editingId, setEditingId] = useState(null);

  // modal state: {type, item} for sell/dispose/adjust/archive/delete/view
  const [modal, setModal] = useState(null);
  const [modalFields, setModalFields] = useState({});
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toast, setToast] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);

  const canAdd = ['Warehouse Operator', 'Administrator', 'Retail Manager', 'Consumer'].includes(role);
  const canSell = role === 'Retail Manager' || role === 'Administrator';
  const canDispose = role === 'Warehouse Operator' || role === 'Administrator';
  const canExpire = ['Retail Manager', 'Warehouse Operator', 'Administrator'].includes(role);
  const canEdit = ['Retail Manager', 'Warehouse Operator', 'Administrator'].includes(role);
  const canArchive = role !== 'Food Quality Inspector';
  const canAdminDelete = role === 'Administrator';

  const fetchItems = async (view = lifecycleView) => {
    setFetchError(null);
    try {
      const scope = role === 'Consumer' ? '?scope=mine' : '';
      const lc = view === 'archived_view' ? `${scope ? '&' : '?'}lifecycle=archived_view` : '';
      const data = await apiGet(`/api/inventory/${scope}${lc}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setFetchError(error.message);
      setItems([]);
    }
  };

  useEffect(() => { fetchItems(lifecycleView); }, [lifecycleView]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => setFormData({
    name: '', category: 'Fruits', quantity: 0, batch_number: '', expiry_date: '',
    temperature_c: '', humidity_pct: '', packaging_type: 'Ventilated', storage_zone: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const payload = {
      ...formData,
      quantity: parseInt(formData.quantity),
      expiry_date: formData.expiry_date || null,
      stored_at: formData.stored_at || new Date().toISOString(),
      temperature_c: formData.temperature_c === '' ? null : parseFloat(formData.temperature_c),
      humidity_pct: formData.humidity_pct === '' ? null : parseFloat(formData.humidity_pct),
      storage_zone: formData.storage_zone || null,
    };
    try {
      if (editingId) {
        await apiPatch(`/api/inventory/${editingId}`, payload);
      } else {
        await apiPost('/api/inventory/', payload);
      }
      setShowAddForm(false);
      setEditingId(null);
      fetchItems();
      resetForm();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setFormError(null);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity ?? 0,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : '',
      temperature_c: item.temperature_c ?? '',
      humidity_pct: item.humidity_pct ?? '',
      packaging_type: item.packaging_type || 'Ventilated',
      storage_zone: item.storage_zone || '',
      stored_at: item.stored_at || undefined,
    });
    setShowAddForm(true);
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const openModal = (type, item) => {
    setModal({ type, item });
    setModalError(null);
    setModalFields(type === 'adjust' ? { new_quantity: item.active_quantity ?? item.quantity } : {});
  };

  const closeModal = () => { setModal(null); setModalError(null); setModalFields({}); };

  const runAction = async () => {
    const { type, item } = modal;
    setModalBusy(true);
    setModalError(null);
    try {
      let msg = '';
      if (type === 'sell') {
        await apiPost(`/api/inventory/${item._id}/sell`, {
          quantity_sold: parseInt(modalFields.quantity_sold),
          sale_date: modalFields.sale_date || null,
          notes: modalFields.notes || null,
        });
        msg = `Sale recorded: ${modalFields.quantity_sold} unit(s) of ${item.name}`;
      } else if (type === 'dispose') {
        await apiPost(`/api/inventory/${item._id}/dispose`, {
          quantity_disposed: parseInt(modalFields.quantity_disposed),
          reason: modalFields.reason,
          notes: modalFields.notes || null,
        });
        msg = `Disposal recorded: ${modalFields.quantity_disposed} unit(s) of ${item.name} (${modalFields.reason})`;
      } else if (type === 'adjust') {
        await apiPost(`/api/inventory/${item._id}/adjust`, {
          new_quantity: parseInt(modalFields.new_quantity),
          reason: modalFields.reason,
          notes: modalFields.notes || null,
        });
        msg = `Quantity adjusted for ${item.name}`;
      } else if (type === 'expire') {
        await apiPost(`/api/inventory/${item._id}/mark-expired`, {});
        msg = `${item.name} marked Expired - ${available} unit(s) moved out of active stock`;
      } else if (type === 'archive') {
        await apiPost(`/api/inventory/${item._id}/archive`, { reason: modalFields.reason || null });
        msg = `${item.name} archived - history preserved`;
      } else if (type === 'delete') {
        await apiDelete(`/api/inventory/${item._id}?confirm=DELETE-PERMANENTLY`);
        msg = `${item.name} permanently deleted (administrative action)`;
      }
      closeModal();
      showToast(msg);
      await fetchItems();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalBusy(false);
    }
  };

  const openDetail = async (item) => {
    setModal(null);
    setItemDetail({ loading: true });
    try {
      const data = await apiGet(`/api/inventory/${item._id}`);
      setItemDetail(data);
    } catch (err) {
      setItemDetail({ error: err.message });
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusBadge = (status) => (
    <span style={{
      padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700,
      backgroundColor: `${STATUS_COLORS[status] || '#9ca3af'}20`,
      color: STATUS_COLORS[status] || '#9ca3af',
    }}>{status || 'Active'}</span>
  );

  const actionBtn = (label, icon, onClick, color = '#111') => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
        backgroundColor: color === '#111' ? '#111' : `${color}15`, color: color === '#111' ? '#fff' : color,
        border: `1px solid ${color === '#111' ? '#111' : `${color}55`}`, borderRadius: '8px',
        display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
      }}
    >{icon} {label}</button>
  );

  const renderActions = (item) => {
    const actions = [];
    actions.push(actionBtn('View', <Eye size={12} />, () => openDetail(item)));
    if (canSell && item.status === 'Active') {
      actions.push(actionBtn('Mark Sold', <DollarSign size={12} />, () => openModal('sell', item), '#16a34a'));
    }
    if (canEdit && item.status === 'Active') {
      actions.push(actionBtn('Edit', <Edit3 size={12} />, () => openEdit(item), '#2563eb'));
    }
    if (canExpire && item.status === 'Active') {
      actions.push(actionBtn('Mark Expired', <CalendarX size={12} />, () => openModal('expire', item), '#d97706'));
    }
    if (canDispose && item.status === 'Active') {
      actions.push(actionBtn('Adjust', <Wrench size={12} />, () => openModal('adjust', item), '#7c3aed'));
      actions.push(actionBtn('Damage/Dispose', <Trash2 size={12} />, () => openModal('dispose', item), '#ef4444'));
    }
    if (canArchive && item.status !== 'Archived') {
      const label = role === 'Consumer' ? 'Remove' : 'Archive';
      actions.push(actionBtn(label, <Archive size={12} />, () => openModal('archive', item), '#d97706'));
    }
    if (canAdminDelete) {
      actions.push(actionBtn('Delete', <Trash2 size={12} />, () => setModal({ type: 'delete', item }), '#b91c1c'));
    }
    return <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{actions}</div>;
  };

  const modalInput = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#f9f9f9', fontSize: '0.95rem', boxSizing: 'border-box' };

  const modalTitles = {
    sell: 'Mark as Sold', dispose: 'Record Damage / Disposal', adjust: 'Adjust Quantity',
    archive: 'Archive Item', delete: 'Administrative Permanent Delete',
    expire: 'Mark as Expired',
  };

  const modalNeedsFields = ['sell', 'dispose', 'adjust'].includes(modal?.type);
  const available = modal?.item ? (modal.item.active_quantity ?? modal.item.quantity) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Inventory</h1>
          <p style={{ color: '#666', margin: 0 }}>Full lifecycle management: register, monitor, sell, dispose, archive.</p>
        </div>

        {canAdd && (
          <button
            className="button"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', color: '#fff' }}
          >
            <Plus size={18} style={{ marginRight: '8px' }} /> Add Item
          </button>
        )}
      </div>

      {/* lifecycle view toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          ['active', 'Active Inventory'],
          ['archived_view', 'Sold Out / Disposed / Archived'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setLifecycleView(key)}
            style={{
              padding: '8px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              border: '1px solid', borderColor: lifecycleView === key ? '#000' : '#e5e5e5',
              backgroundColor: lifecycleView === key ? '#000' : '#fff', color: lifecycleView === key ? '#fff' : '#666',
            }}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showAddForm && canAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              backgroundColor: '#fff', padding: '32px', borderRadius: '24px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.08)', marginBottom: '32px', border: '1px solid #f0f0f0'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>{editingId ? 'Edit Food Item' : 'Register New Food Item'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Product Name</label>
                <input type="text" name="name" className="input-field" value={formData.name} onChange={handleChange} required style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Category</label>
                <select name="category" className="input-field" value={formData.category} onChange={handleChange} style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                  <option value="Fruits">Fruits</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Dairy Products">Dairy Products</option>
                  <option value="Meat & Poultry">Meat & Poultry</option>
                  <option value="Seafood">Seafood</option>
                  <option value="Bakery Products">Bakery Products</option>
                  <option value="Packaged Foods">Packaged Foods</option>
                  <option value="Beverages">Beverages</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Quantity</label>
                <input type="number" name="quantity" className="input-field" value={formData.quantity} onChange={handleChange} required style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Batch Number</label>
                <input type="text" name="batch_number" className="input-field" value={formData.batch_number} onChange={handleChange} required style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Expiry Date (optional)</label>
                <input type="date" name="expiry_date" className="input-field" value={formData.expiry_date} onChange={handleChange} style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Storage Zone / Location</label>
                <input type="text" name="storage_zone" className="input-field" value={formData.storage_zone} onChange={handleChange} placeholder="e.g. Cold Storage 1" style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Storage Temperature (°C, optional)</label>
                <input type="number" step="0.5" name="temperature_c" className="input-field" value={formData.temperature_c} onChange={handleChange} placeholder="e.g. 4" style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Storage Humidity (%, optional)</label>
                <input type="number" min="0" max="100" name="humidity_pct" className="input-field" value={formData.humidity_pct} onChange={handleChange} placeholder="e.g. 85" style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Packaging Type</label>
                <select name="packaging_type" className="input-field" value={formData.packaging_type} onChange={handleChange} style={{ backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                  <option value="Vacuum Sealed">Vacuum Sealed</option>
                  <option value="Modified Atmosphere">Modified Atmosphere</option>
                  <option value="Sealed Container">Sealed Container</option>
                  <option value="Ventilated">Ventilated</option>
                  <option value="Open">Open</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '16px', alignItems: 'center' }}>
                {formError && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginRight: '16px' }}>{formError}</span>}
                <button type="button" className="button button-outline" onClick={() => setShowAddForm(false)} style={{ marginRight: '16px' }}>Cancel</button>
                <button type="submit" className="button" style={{ backgroundColor: '#000', color: '#fff' }} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toast feedback */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 1200,
            backgroundColor: toast.ok ? '#dcfce7' : '#fee2e2', color: toast.ok ? '#15803d' : '#b91c1c',
            padding: '14px 20px', borderRadius: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.msg}
          </span>
        </motion.div>
      )}

      {/* action modal */}
      <AnimatePresence>
        {modal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }} onClick={closeModal}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>{modalTitles[modal.type]}</h3>
              <p style={{ color: '#666', margin: '0 0 18px', fontSize: '0.9rem' }}>
                {modal.item.name} · Batch {modal.item.batch_number} · {available} active unit(s)
              </p>

              {modal.type === 'delete' && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '0.9rem', color: '#b91c1c' }}>
                  <b>Administrative deletion.</b> This permanently removes the product and its batch records.
                  Historical analyses and reports remain in the database for audit. This cannot be undone.
                </div>
              )}
              {modal.type === 'expire' && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '0.9rem', color: '#92400e' }}>
                  <b>All {available} active unit(s)</b> will be marked as Expired and moved out of active stock.
                  The item and its full history (scans, reports, predictions) are preserved and remain viewable in the archive view.
                </div>
              )}
              {modal.type === 'archive' && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '0.9rem', color: '#92400e' }}>
                  The item is hidden from active inventory and monitoring, but all history (scans, reports, predictions) is preserved and viewable in the archive view.
                </div>
              )}

              {modalNeedsFields && (
                <div style={{ display: 'grid', gap: '12px', marginBottom: '6px' }}>
                  {modal.type === 'sell' && (
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Quantity Sold (max {available})</label>
                      <input type="number" min="1" max={available} value={modalFields.quantity_sold || ''} onChange={(e) => setModalFields({ ...modalFields, quantity_sold: e.target.value })} style={modalInput} />
                    </div>
                  )}
                  {modal.type === 'sell' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sale Date (optional)</label>
                        <input type="date" value={modalFields.sale_date || ''} onChange={(e) => setModalFields({ ...modalFields, sale_date: e.target.value })} style={modalInput} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Notes (optional)</label>
                        <input type="text" value={modalFields.notes || ''} onChange={(e) => setModalFields({ ...modalFields, notes: e.target.value })} style={modalInput} />
                      </div>
                    </>
                  )}
                  {modal.type === 'dispose' && (
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Quantity Disposed (max {available})</label>
                      <input type="number" min="1" max={available} value={modalFields.quantity_disposed || ''} onChange={(e) => setModalFields({ ...modalFields, quantity_disposed: e.target.value })} style={modalInput} />
                    </div>
                  )}
                  {modal.type === 'dispose' && (
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reason</label>
                      <select value={modalFields.reason || ''} onChange={(e) => setModalFields({ ...modalFields, reason: e.target.value })} style={modalInput}>
                        <option value="">Select reason…</option>
                        <option value="damaged">Damaged</option>
                        <option value="expired">Expired</option>
                        <option value="spoiled">Spoiled</option>
                        <option value="contaminated">Contaminated</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                  {modal.type === 'adjust' && (
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>New Quantity (current {available})</label>
                      <input type="number" min="0" value={modalFields.new_quantity ?? ''} onChange={(e) => setModalFields({ ...modalFields, new_quantity: e.target.value })} style={modalInput} />
                    </div>
                  )}
                  {modal.type === 'adjust' || modal.type === 'dispose' ? null : null}
                </div>
              )}

              {modalError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '10px 0 0' }}>{modalError}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button onClick={closeModal} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={runAction}
                  disabled={modalBusy || (modalNeedsFields && (modal.type === 'sell' || modal.type === 'dispose') && !modalFields.quantity_sold && !modalFields.quantity_disposed || (modal.type === 'dispose' && !modalFields.reason))}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', border: 'none', fontWeight: 600, cursor: modalBusy ? 'wait' : 'pointer',
                    backgroundColor: modal.type === 'delete' ? '#b91c1c' : (modal.type === 'dispose' || modal.type === 'expire') ? '#ef4444' : '#111', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {modalBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                  {modal.type === 'delete' ? 'Delete Permanently' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* item detail drawer with lifecycle history */}
      <AnimatePresence>
        {itemDetail && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setItemDetail(null)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto' }}>
              {itemDetail.loading ? (
                <p style={{ color: '#6b7280' }}>Loading…</p>
              ) : itemDetail.error ? (
                <p style={{ color: '#ef4444' }}>{itemDetail.error}</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1.4rem' }}>{itemDetail.name}</h3>
                      <span style={{ color: '#6b7280' }}>Batch {itemDetail.batch_number} · {itemDetail.category}</span>
                    </div>
                    {statusBadge(itemDetail.status)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    {[
                      ['Active units', itemDetail.active_quantity ?? itemDetail.quantity],
                      ['Sold', itemDetail.sold_quantity ?? 0],
                      ['Disposed', itemDetail.disposed_quantity ?? 0],
                      ['Zone', itemDetail.storage_zone || '—'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px' }}><History size={15} /> Lifecycle History</h4>
                  {(itemDetail.lifecycle_events || []).length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No lifecycle events recorded.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {itemDetail.lifecycle_events.map((ev) => (
                        <div key={ev._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '10px', fontSize: '0.85rem' }}>
                          <div>
                            <b style={{ textTransform: 'capitalize' }}>{ev.event_type}</b>
                            {ev.quantity_delta ? <span style={{ color: ev.quantity_delta < 0 ? '#ef4444' : '#16a34a', marginLeft: '6px' }}>{ev.quantity_delta > 0 ? '+' : ''}{ev.quantity_delta}</span> : null}
                            {ev.reason ? <span style={{ color: '#6b7280', marginLeft: '6px' }}>({ev.reason})</span> : null}
                            {ev.notes ? <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{ev.notes}</div> : null}
                          </div>
                          <div style={{ color: '#9ca3af', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                            {ev.performed_by_username} · {formatDateTime(ev.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button onClick={() => setItemDetail(null)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div style={{
        backgroundColor: '#fff',
        borderRadius: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        overflow: 'hidden'
      }}>
        {fetchError && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> Failed to load inventory: {fetchError}
          </div>
        )}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f9f9f9', padding: '8px 16px', borderRadius: '30px', border: '1px solid #e5e5e5', width: '300px' }}>
            <Search size={16} style={{ color: '#888', marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search by name, batch, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: '0.9rem', width: '100%' }}
            />
          </div>
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{filteredItems.length} item(s)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #eaeaea' }}>
              {['Product', 'Category', 'Batch & Quantity', 'Expiry', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '16px 24px', color: '#666', fontWeight: 600, fontSize: '0.9rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => (
              <tr key={item._id} style={{ borderBottom: index === filteredItems.length - 1 ? 'none' : '1px solid #f0f0f0', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <td style={{ padding: '16px 24px', fontWeight: 600, color: '#000' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '12px', marginRight: '16px' }}>
                      <Package size={18} style={{ color: '#555' }} />
                    </div>
                    {item.name}
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{
                    backgroundColor: '#f0f4ff',
                    color: '#2563eb',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {item.category}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
                    <Tag size={12} style={{ marginRight: '6px' }}/> {item.batch_number}
                  </div>
                  <div style={{ fontWeight: 700, color: '#000' }}>
                    {item.active_quantity ?? item.quantity} active
                    {(item.sold_quantity > 0 || item.disposed_quantity > 0) && (
                      <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: '0.8rem', marginLeft: '6px' }}>
                        ({item.sold_quantity || 0} sold · {item.disposed_quantity || 0} disposed)
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {item.expiry_date ? (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.95rem', fontWeight: 500, color: '#444' }}>
                      <Calendar size={14} style={{ marginRight: '8px', color: '#888' }} />
                      {formatDate(item.expiry_date)}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No label expiry</span>
                  )}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {statusBadge(item.status || 'Active')}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {renderActions(item)}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '64px', textAlign: 'center', color: '#888' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Package size={48} style={{ color: '#e5e5e5', marginBottom: '16px' }} />
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>
                      {lifecycleView === 'archived_view' ? 'No sold/disposed/archived items yet.' : 'No food items found.'}
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
                      {lifecycleView === 'active' && canAdd ? 'Add your first item above.' : ''}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </motion.div>
  );
};

export default InventoryDashboard;

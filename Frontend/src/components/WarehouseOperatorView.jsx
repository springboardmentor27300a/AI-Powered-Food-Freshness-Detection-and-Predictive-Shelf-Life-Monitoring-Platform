import React, { useState } from 'react';

export default function WarehouseOperatorView({ batches, warehouses, categories, onRegisterBatch, user, loading }) {
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Fruits');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.code || 'WH-CENTRAL-01');
  const [quantityKg, setQuantityKg] = useState('500');
  const [unitPrice, setUnitPrice] = useState('2.50');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0]);
  const [storageTemp, setStorageTemp] = useState('3.5');
  const [storageHumidity, setStorageHumidity] = useState('88.0');
  const [freshnessScore, setFreshnessScore] = useState(92);
  const [customBatchId, setCustomBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleAutoBatchId = () => {
    const prefix = productName.length >= 3 ? productName.slice(0, 3).toUpperCase() : 'PRD';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    setCustomBatchId(`BATCH-${dateStr}-${prefix}${rand}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ type: '', text: '' });

    const selectedWh = warehouses.find(w => w.code === warehouseId || w.name === warehouseId) || warehouses[0];

    const payload = {
      batch_id: customBatchId.trim() || undefined,
      product_name: productName,
      category,
      warehouse_id: selectedWh?.code || 'WH-CENTRAL-01',
      warehouse_name: selectedWh?.name || 'GreenValley Central Cold Storage',
      quantity_kg: parseFloat(quantityKg),
      unit_price_per_kg: parseFloat(unitPrice),
      harvest_date: harvestDate,
      expiry_date: expiryDate,
      freshness_score: parseInt(freshnessScore),
      storage_temp_celsius: parseFloat(storageTemp),
      storage_humidity_percent: parseFloat(storageHumidity),
      spoilage_indicators: ["Surface Integrity 100%", "Optimal Cold-Chain Compliance"]
    };

    try {
      await onRegisterBatch(payload);
      setMsg({ type: 'success', text: `Food batch ${customBatchId || 'item'} registered successfully in Cloud MongoDB!` });
      setTimeout(() => {
        setShowModal(false);
        setProductName('');
        setCustomBatchId('');
        setMsg({ type: '', text: '' });
      }, 1000);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to register food item batch.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Banner */}
      <div className="ux4g-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(20, 184, 166, 0.06))', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🏭</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Warehouse Inventory & Produce Tagging Hub</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Tag produce batches with unique Batch IDs, select cold-storage locations, specify expiry limits, and upload storage conditions.
          </p>
        </div>

        <button
          className="ux4g-btn-custom pulse-glow"
          onClick={() => { setShowModal(true); handleAutoBatchId(); }}
          style={{ padding: '0.9rem 1.8rem', fontSize: '0.95rem' }}
        >
          ➕ Register New Food Batch
        </button>
      </div>

      {/* UX4G Warehouse Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {warehouses.map((wh) => (
          <div key={wh.id || wh.code} className="ux4g-glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <span className="ux4g-badge-pill ux4g-badge-fresh" style={{ fontSize: '0.75rem' }}>
                {wh.code}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{wh.temperature_range_c}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.3rem' }}>{wh.name}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>📍 {wh.location}</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', height: 8, marginBottom: '0.5rem' }}>
              <div style={{ width: `${Math.min(100, ((wh.current_utilization_kg || 0) / wh.capacity_kg) * 100)}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
              <span>Capacity: {wh.capacity_kg.toLocaleString()} kg</span>
              <span style={{ color: '#10b981' }}>{(wh.current_utilization_kg || 0).toLocaleString()} kg used</span>
            </div>
          </div>
        ))}
      </div>

      {/* Inventory Table Card */}
      <div className="ux4g-glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>📦 Active Warehouse Produce Batches</h3>
          <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 800, background: 'rgba(16, 185, 129, 0.12)', padding: '4px 12px', borderRadius: 20 }}>
            Total Items: {batches.length}
          </span>
        </div>

        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Cloud MongoDB inventory...</p>
        ) : batches.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📦</span>
            <p>No food batches registered yet. Click "Register New Food Batch" above.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ux4g-custom-table">
              <thead>
                <tr>
                  <th>Batch ID & Produce Name</th>
                  <th>Category</th>
                  <th>Warehouse Location</th>
                  <th>Qty (kg) & Unit Price</th>
                  <th>Harvest & Expiry Date</th>
                  <th>Storage Metrics</th>
                  <th>Freshness Score</th>
                  <th>Availability Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  let statusClass = 'ux4g-badge-available';
                  if (b.status === 'Sold') statusClass = 'ux4g-badge-sold';
                  
                  let scoreClass = 'ux4g-badge-fresh';
                  if (b.freshness_score < 75) scoreClass = 'ux4g-badge-acceptable';

                  return (
                    <tr key={b.id || b.batch_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <img src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"} alt={b.product_name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{b.product_name}</div>
                            <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 800 }}>{b.batch_id}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 700 }}>{b.category}</span></td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{b.warehouse_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {b.warehouse_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{b.quantity_kg} kg</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>${b.unit_price_per_kg.toFixed(2)}/kg</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>🌾 {b.harvest_date}</div>
                        <div style={{ fontSize: '0.82rem', color: '#f43f5e', fontWeight: 800 }}>⏳ {b.expiry_date}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>🌡️ {b.storage_temp_celsius}°C</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>💧 {b.storage_humidity_percent}% RH</div>
                      </td>
                      <td>
                        <span className={`ux4g-badge-pill ${scoreClass}`}>
                          {b.freshness_score}/100 ({b.freshness_status})
                        </span>
                      </td>
                      <td>
                        <span className={`ux4g-badge-pill ${statusClass}`}>
                          {b.status === 'Sold' ? `SOLD (${b.purchased_by_store || 'Retail Store'})` : b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UX4G Modal */}
      {showModal && (
        <div className="ux4g-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ux4g-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🥦 Register Produce Batch</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            {msg.text && (
              <div style={{ background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', color: msg.type === 'success' ? '#10b981' : '#f43f5e', padding: '0.8rem', borderRadius: '10px', marginBottom: '1.2rem', fontSize: '0.85rem', fontWeight: 700 }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              
              {/* Batch ID */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Batch Tag ID Code</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="e.g. BATCH-20260825-APL01"
                    value={customBatchId}
                    onChange={(e) => setCustomBatchId(e.target.value)}
                  />
                  <button type="button" onClick={handleAutoBatchId} style={{ padding: '0.75rem 1.2rem', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ⚡ Auto Generate
                  </button>
                </div>
              </div>

              {/* Name & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Product Name</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="e.g. Organic Honeycrisp Apples"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Product Category</label>
                  <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warehouse & Quantity/Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Target Warehouse Location</label>
                  <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.map((w) => (
                      <option key={w.id || w.code} value={w.code}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Quantity (kg)</label>
                  <input type="number" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required min="1" />
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Price ($/kg)</label>
                  <input type="number" step="0.1" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Harvest Date</label>
                  <input type="date" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Expiry Date</label>
                  <input type="date" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
                </div>
              </div>

              {/* Storage Metrics & Freshness */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1rem', marginBottom: '1.2rem' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Storage Temp (°C)</label>
                  <input type="number" step="0.1" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={storageTemp} onChange={(e) => setStorageTemp(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Humidity (% RH)</label>
                  <input type="number" step="0.5" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={storageHumidity} onChange={(e) => setStorageHumidity(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Freshness Score ({freshnessScore}/100)</label>
                  <input type="range" min="0" max="100" value={freshnessScore} onChange={(e) => setFreshnessScore(e.target.value)} style={{ width: '100%', marginTop: '0.5rem' }} />
                </div>
              </div>

              <button
                type="submit"
                className="ux4g-btn-custom"
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center', padding: '0.9rem' }}
              >
                {submitting ? 'Saving to Cloud MongoDB...' : 'Confirm Batch Registration'}
              </button>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

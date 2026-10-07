import React, { useState, useEffect } from 'react';

export default function WarehouseOperatorView({ batches, warehouses, categories, onRegisterBatch, user, loading, onRefreshWarehouses }) {
  const [showModal, setShowModal] = useState(false);
  const [showClimateModal, setShowClimateModal] = useState(false);

  // Identify operator's assigned warehouse
  const assignedWh = warehouses.find(
    w => (user?.warehouse_id && (w.code === user.warehouse_id || w.id === user.warehouse_id)) ||
         (w.assigned_operator_id && user?.id && w.assigned_operator_id === user.id) ||
         (w.assigned_operator_email && user?.email && w.assigned_operator_email === user.email)
  ) || warehouses[0];

  // Storage Climate State
  const [climateTemp, setClimateTemp] = useState('3.2');
  const [climateHumidity, setClimateHumidity] = useState('88.5');
  const [climateAirflow, setClimateAirflow] = useState('420');
  const [updatingClimate, setUpdatingClimate] = useState(false);
  const [climateNotice, setClimateNotice] = useState({ type: '', text: '' });

  // Filter batches by operator's hub or all
  const [hubFilter, setHubFilter] = useState('assigned'); // 'assigned' | 'all'

  // Batch Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Fruits');
  const [warehouseId, setWarehouseId] = useState(assignedWh?.code || 'WH-CENTRAL-01');
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

  useEffect(() => {
    if (assignedWh?.code) {
      setWarehouseId(assignedWh.code);
    }
  }, [assignedWh]);

  const handleAutoBatchId = () => {
    const prefix = productName.length >= 3 ? productName.slice(0, 3).toUpperCase() : 'PRD';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    setCustomBatchId(`BATCH-${dateStr}-${prefix}${rand}`);
  };

  const handleUpdateClimate = async (e) => {
    e.preventDefault();
    setUpdatingClimate(true);
    setClimateNotice({ type: '', text: '' });

    const whTarget = assignedWh?.code || warehouseId || 'WH-CENTRAL-01';

    try {
      const res = await fetch('/api/storage/update-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: whTarget,
          temperature_celsius: parseFloat(climateTemp),
          humidity_percent: parseFloat(climateHumidity),
          airflow_cfm: parseFloat(climateAirflow)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update storage climate.');

      setClimateNotice({ type: 'success', text: `✅ Live climate conditions updated for ${whTarget}: ${climateTemp}°C, ${climateHumidity}% RH.` });
      setTimeout(() => {
        setShowClimateModal(false);
        setClimateNotice({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      setClimateNotice({ type: 'error', text: err.message });
    } finally {
      setUpdatingClimate(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ type: '', text: '' });

    const selectedWh = warehouses.find(w => w.code === warehouseId || w.name === warehouseId) || assignedWh || warehouses[0];

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

  // Filter displayed batches
  const displayedBatches = batches.filter((b) => {
    if (hubFilter === 'assigned' && assignedWh?.code) {
      return b.warehouse_id === assignedWh.code || b.warehouse_name === assignedWh.name;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🏭</span>
            <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
              Warehouse Hub Operations & Storage Management
            </h2>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
            Operate your assigned Warehouse Hub: register new produce batches, monitor storage climate telemetry, and maintain cold-chain integrity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="linear-btn linear-btn-secondary"
            onClick={() => setShowClimateModal(true)}
            style={{ padding: '0.8rem 1.2rem', fontSize: '0.85rem' }}
          >
            🌡️ Adjust Storage Climate
          </button>
          <button
            className="linear-btn linear-btn-primary"
            onClick={() => { setShowModal(true); handleAutoBatchId(); }}
            style={{ padding: '0.8rem 1.4rem', fontSize: '0.88rem' }}
          >
            ➕ Register Produce Batch
          </button>
        </div>
      </div>

      {/* Operator Assigned Hub Overview Card (CRITICAL WORKFLOW REQUIREMENT) */}
      <div className="linear-card" style={{ background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)', border: '1px solid rgba(94, 106, 210, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.72rem' }}>
                🟢 ASSIGNED HUB
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                Assigned by Retail Manager
              </span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--linear-fg)', marginTop: 4 }}>
              {assignedWh?.name || 'Central Cold Storage'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--linear-fg-muted)' }}>
              Code: <strong style={{ color: 'var(--linear-accent)' }}>{assignedWh?.code}</strong> • 📍 {assignedWh?.location || 'Logistics Zone'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: '#09090C', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', display: 'block' }}>TARGET TEMPERATURE</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#34D399' }}>{assignedWh?.temperature_range_c || '2°C - 4°C'}</span>
            </div>
            <div style={{ background: '#09090C', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', display: 'block' }}>TARGET HUMIDITY</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--linear-accent)' }}>{assignedWh?.humidity_range_pct || '85% - 90%'}</span>
            </div>
          </div>
        </div>

        {/* Capacity Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
            <span style={{ color: 'var(--linear-fg-muted)' }}>Hub Capacity Utilization</span>
            <span style={{ fontWeight: 600 }}>
              {(assignedWh?.current_utilization_kg || 0).toLocaleString()} kg of {assignedWh?.capacity_kg?.toLocaleString()} kg ({Math.round(((assignedWh?.current_utilization_kg || 0) / (assignedWh?.capacity_kg || 1)) * 100)}%)
            </span>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden', height: 8 }}>
            <div style={{ width: `${Math.min(100, ((assignedWh?.current_utilization_kg || 0) / (assignedWh?.capacity_kg || 1)) * 100)}%`, background: 'var(--linear-accent)', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Warehouse Hubs Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {warehouses.map((wh) => (
          <div key={wh.id || wh.code} className="linear-card" style={{ borderColor: wh.code === assignedWh?.code ? 'var(--linear-accent)' : 'var(--linear-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <span className={`linear-badge ${wh.code === assignedWh?.code ? 'linear-badge-good' : 'linear-badge-fresh'}`} style={{ fontSize: '0.7rem' }}>
                {wh.code} {wh.code === assignedWh?.code && '★ MY HUB'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', fontWeight: 500 }}>{wh.temperature_range_c}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--linear-fg)' }}>{wh.name}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)', marginBottom: '0.9rem' }}>📍 {wh.location}</p>
            
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden', height: 8, marginBottom: '0.6rem' }}>
              <div style={{ width: `${Math.min(100, ((wh.current_utilization_kg || 0) / wh.capacity_kg) * 100)}%`, background: 'var(--linear-accent)', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 500 }}>
              <span>Cap: {wh.capacity_kg?.toLocaleString()} kg</span>
              <span style={{ color: 'var(--linear-accent)' }}>{(wh.current_utilization_kg || 0).toLocaleString()} kg used</span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Batches Table Card */}
      <div className="linear-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="linear-text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              📦 Active Warehouse Produce Batches
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
              Showing {displayedBatches.length} items
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setHubFilter('assigned')}
              className={`linear-btn ${hubFilter === 'assigned' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
            >
              My Hub ({assignedWh?.code})
            </button>
            <button
              onClick={() => setHubFilter('all')}
              className={`linear-btn ${hubFilter === 'all' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
            >
              All Hubs ({batches.length})
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>Loading Cloud MongoDB inventory...</p>
        ) : displayedBatches.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📦</span>
            <p style={{ fontWeight: 500 }}>No food batches registered in this hub yet.</p>
            <button
              className="linear-btn linear-btn-primary"
              onClick={() => { setShowModal(true); handleAutoBatchId(); }}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
            >
              ➕ Register Produce Batch Now
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--linear-border-default)' }}>
            <table className="linear-table">
              <thead>
                <tr>
                  <th>Batch ID & Produce Name</th>
                  <th>Category</th>
                  <th>Warehouse Location</th>
                  <th>Qty & Price</th>
                  <th>Harvest & Expiry Date</th>
                  <th>Storage Metrics</th>
                  <th>Freshness Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedBatches.map((b) => {
                  let statusClass = 'linear-badge-fresh';
                  if (b.status === 'Sold') statusClass = 'linear-badge-spoilage';
                  
                  let scoreClass = 'linear-badge-fresh';
                  if (b.freshness_score < 75) scoreClass = 'linear-badge-warning';

                  return (
                    <tr key={b.id || b.batch_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <img src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"} alt={b.product_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--linear-border-default)' }} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--linear-fg)', fontSize: '0.9rem' }}>{b.product_name}</div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--linear-accent)', fontWeight: 600 }}>{b.batch_id}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 500 }}>{b.category}</span></td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{b.warehouse_name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>ID: {b.warehouse_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.quantity_kg} kg</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--linear-accent)' }}>${b.unit_price_per_kg?.toFixed(2)}/kg</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>🌾 {b.harvest_date}</div>
                        <div style={{ fontSize: '0.8rem', color: '#F87171', fontWeight: 600 }}>⏳ {b.expiry_date}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>🌡️ {b.storage_temp_celsius}°C</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>💧 {b.storage_humidity_percent}% RH</div>
                      </td>
                      <td>
                        <span className={`linear-badge ${scoreClass}`}>
                          {b.freshness_score}/100
                        </span>
                      </td>
                      <td>
                        <span className={`linear-badge ${statusClass}`}>
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

      {/* REGISTER BATCH MODAL DIALOG */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 5, 6, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }} onClick={() => setShowModal(false)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>🥦 Register Produce Batch</h2>
              <button onClick={() => setShowModal(false)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            {msg.text && (
              <div style={{ background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: '1px solid ' + (msg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'), color: msg.type === 'success' ? '#34D399' : '#F87171', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.82rem', fontWeight: 500 }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>BATCH TAG ID CODE</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="e.g. BATCH-20260825-APL01"
                    value={customBatchId}
                    onChange={(e) => setCustomBatchId(e.target.value)}
                  />
                  <button type="button" onClick={handleAutoBatchId} className="linear-btn linear-btn-secondary" style={{ whiteSpace: 'nowrap', padding: '0.7rem 0.9rem', fontSize: '0.74rem' }}>
                    ⚡ Auto Generate
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>PRODUCT NAME</label>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="e.g. Organic Honeycrisp Apples"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>FOOD CATEGORY</label>
                  <select className="linear-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>WAREHOUSE HUB DESTINATION</label>
                <select className="linear-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map(w => (
                    <option key={w.id || w.code} value={w.code}>
                      {w.name} ({w.code}) {w.code === assignedWh?.code ? '[My Assigned Hub]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>BATCH QUANTITY (KG)</label>
                  <input
                    type="number"
                    className="linear-input"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>WHOLESALE PRICE ($/KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="linear-input"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>HARVEST DATE</label>
                  <input
                    type="date"
                    className="linear-input"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>PROJECTED EXPIRY DATE</label>
                  <input
                    type="date"
                    className="linear-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginBottom: '1.4rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 2 }}>STORAGE TEMP (°C)</label>
                  <input type="number" step="0.1" className="linear-input" value={storageTemp} onChange={(e) => setStorageTemp(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 2 }}>STORAGE HUMIDITY (%)</label>
                  <input type="number" step="0.1" className="linear-input" value={storageHumidity} onChange={(e) => setStorageHumidity(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 2 }}>FRESHNESS SCORE</label>
                  <input type="number" min="0" max="100" className="linear-input" value={freshnessScore} onChange={(e) => setFreshnessScore(e.target.value)} />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="linear-btn linear-btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {submitting ? 'Registering Batch in MongoDB...' : '✅ Save Batch to Cloud Inventory'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* CLIMATE ADJUSTMENT MODAL */}
      {showClimateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 5, 6, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }} onClick={() => setShowClimateModal(false)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>🌡️ Adjust Storage Climate Conditions</h2>
              <button onClick={() => setShowClimateModal(false)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            <div style={{ background: '#09090C', padding: '12px', borderRadius: '10px', marginBottom: '1.2rem', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--linear-fg)' }}>{assignedWh?.name} ({assignedWh?.code})</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>📍 {assignedWh?.location}</div>
            </div>

            {climateNotice.text && (
              <div style={{
                padding: '0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                background: climateNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid ' + (climateNotice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                color: climateNotice.type === 'success' ? '#34D399' : '#F87171'
              }}>
                {climateNotice.text}
              </div>
            )}

            <form onSubmit={handleUpdateClimate} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>
                  Cold Storage Chamber Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="linear-input"
                  value={climateTemp}
                  onChange={(e) => setClimateTemp(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>
                  Relative Humidity (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="linear-input"
                  value={climateHumidity}
                  onChange={(e) => setClimateHumidity(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>
                  Airflow Ventilation (CFM)
                </label>
                <input
                  type="number"
                  className="linear-input"
                  value={climateAirflow}
                  onChange={(e) => setClimateAirflow(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={updatingClimate}
                className="linear-btn linear-btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {updatingClimate ? 'Syncing with Sensors...' : '✅ Save Climate Settings'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

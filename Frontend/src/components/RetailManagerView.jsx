import React, { useState } from 'react';

export default function RetailManagerView({ batches, warehouses, categories, onBuyBatch, user }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Buy Modal State
  const [buyModalItem, setBuyModalItem] = useState(null);
  const [storeName, setStoreName] = useState(user?.organization || 'FreshMart Superstores #104');
  const [purchasing, setPurchasing] = useState(false);
  const [buyError, setBuyError] = useState('');

  // Filter Logic
  const filteredBatches = batches.filter((b) => {
    if (selectedCategory !== 'All' && b.category !== selectedCategory) return false;
    if (selectedWarehouse !== 'All' && b.warehouse_id !== selectedWarehouse && b.warehouse_name !== selectedWarehouse) return false;
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchProduct = b.product_name.toLowerCase().includes(term);
      const matchBatch = b.batch_id.toLowerCase().includes(term);
      const matchCategory = b.category.toLowerCase().includes(term);
      if (!matchProduct && !matchBatch && !matchCategory) return false;
    }
    return true;
  });

  const handleConfirmBuy = async () => {
    if (!buyModalItem) return;
    setPurchasing(true);
    setBuyError('');

    try {
      await onBuyBatch(buyModalItem.batch_id || buyModalItem.id, storeName);
      setBuyModalItem(null);
    } catch (err) {
      setBuyError(err.message || 'Failed to complete retail purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Banner */}
      <div className="ux4g-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(16, 185, 129, 0.06))', borderColor: 'rgba(59, 130, 246, 0.35)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🛒</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Retail Fresh Produce Marketplace</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Source fresh produce, fruits, and vegetables directly from cold-storage hubs. Lock inventory instantly with real-time freshness scores.
          </p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderRadius: 14, border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Logistics Purchaser</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6' }}>{user?.organization || 'FreshMart Retail Network'}</span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="ux4g-glass-card" style={{ padding: '1.1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            type="text"
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
            placeholder="🔍 Search produce by name or Batch Tag ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div style={{ minWidth: 170 }}>
          <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Warehouse Filter */}
        <div style={{ minWidth: 190 }}>
          <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
            <option value="All">All Warehouses</option>
            {warehouses.map(w => <option key={w.id || w.code} value={w.code}>{w.name}</option>)}
          </select>
        </div>

        {/* Availability Filter */}
        <div style={{ minWidth: 160 }}>
          <select style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Available">Available Only</option>
            <option value="Sold">Sold Items</option>
          </select>
        </div>

      </div>

      {/* UX4G Product Cards Grid */}
      {filteredBatches.length === 0 ? (
        <div className="ux4g-glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔍</span>
          <p>No food inventory items match your current filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredBatches.map((b) => {
            const isSold = b.status === 'Sold';
            const today = new Date();
            const expDate = new Date(b.expiry_date);
            const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            let badgeClass = 'ux4g-badge-fresh';
            if (b.freshness_score < 80) badgeClass = 'ux4g-badge-good';
            if (b.freshness_score < 65) badgeClass = 'ux4g-badge-acceptable';
            if (b.freshness_score < 50) badgeClass = 'ux4g-badge-spoilage';

            return (
              <div key={b.id || b.batch_id} className="ux4g-glass-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                
                {/* Status Badge */}
                <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }}>
                  {isSold ? (
                    <span className="ux4g-badge-pill ux4g-badge-sold">
                      🔴 ALREADY SOLD
                    </span>
                  ) : (
                    <span className="ux4g-badge-pill ux4g-badge-available">
                      🟢 AVAILABLE
                    </span>
                  )}
                </div>

                {/* Product Image */}
                <div style={{ height: 165, borderRadius: 12, overflow: 'hidden', marginBottom: '1rem', position: 'relative', background: '#0f172a' }}>
                  <img
                    src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"}
                    alt={b.product_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: '3px 10px', borderRadius: 8, fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>
                    📁 {b.category}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ marginBottom: '0.6rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '3px' }}>{b.product_name}</h3>
                  <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 800 }}>
                    Tag: {b.batch_id}
                  </div>
                </div>

                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                  📍 {b.warehouse_name}
                </p>

                {/* Metrics Pill Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.1rem', background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Freshness Score</span>
                    <span className={`ux4g-badge-pill ${badgeClass}`} style={{ fontSize: '0.74rem', marginTop: 3 }}>
                      {b.freshness_score}/100 ({b.freshness_status})
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Expiry Window</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: daysLeft <= 5 ? '#f43f5e' : '#10b981' }}>
                      ⏳ {daysLeft > 0 ? `${daysLeft} Days Left` : 'Expired'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Quantity</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800 }}>{b.quantity_kg} kg</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Wholesale Price</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#3b82f6' }}>${b.unit_price_per_kg.toFixed(2)}/kg</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Batch Value</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      ${(b.quantity_kg * b.unit_price_per_kg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isSold ? (
                    <button className="ux4g-btn-buy" disabled style={{ background: 'rgba(244, 63, 94, 0.18)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
                      🚫 Already Sold
                    </button>
                  ) : (
                    <button
                      className="ux4g-btn-buy"
                      onClick={() => setBuyModalItem(b)}
                    >
                      🛒 Buy Food Item
                    </button>
                  )}
                </div>

                {/* Sold Metadata */}
                {isSold && (
                  <div style={{ marginTop: '0.7rem', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.12)', padding: '6px 12px', borderRadius: 8, color: '#f87171', fontWeight: 700 }}>
                    Purchased by: {b.purchased_by_store || 'Retail Superstore'}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Buy Modal */}
      {buyModalItem && (
        <div className="ux4g-modal-overlay" onClick={() => setBuyModalItem(null)}>
          <div className="ux4g-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>🛒 Confirm Retail Batch Purchase</h2>
              <button onClick={() => setBuyModalItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            {buyError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', padding: '0.8rem', borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.2rem', fontWeight: 700 }}>
                ⚠️ {buyError}
              </div>
            )}

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.1rem', borderRadius: 14, marginBottom: '1.3rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '4px' }}>{buyModalItem.product_name}</div>
              <div style={{ fontSize: '0.82rem', color: '#10b981', fontFamily: 'monospace', fontWeight: 800, marginBottom: '10px' }}>
                Batch ID: {buyModalItem.batch_id}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.88rem' }}>
                <div>Warehouse: <strong>{buyModalItem.warehouse_name}</strong></div>
                <div>Quantity: <strong>{buyModalItem.quantity_kg} kg</strong></div>
                <div>Freshness: <strong>{buyModalItem.freshness_score}/100</strong></div>
                <div>Total Cost: <strong style={{ color: '#10b981' }}>${(buyModalItem.quantity_kg * buyModalItem.unit_price_per_kg).toFixed(2)}</strong></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Purchasing Retail Store / Chain Name</label>
              <input
                type="text"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. FreshMart Hypermarket #104"
                required
              />
            </div>

            <button
              onClick={handleConfirmBuy}
              disabled={purchasing}
              className="ux4g-btn-custom"
              style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
            >
              {purchasing ? 'Executing Transaction on Cloud MongoDB...' : '✅ Complete Purchase & Lock Inventory'}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

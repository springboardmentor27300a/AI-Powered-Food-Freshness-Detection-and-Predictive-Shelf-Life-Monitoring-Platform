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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🛒</span>
            <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
              Retail Fresh Produce Marketplace
            </h2>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
            Source fresh produce directly from cold-storage hubs. Lock inventory instantly with real-time freshness scores.
          </p>
        </div>

        <div className="linear-badge linear-badge-good" style={{ padding: '0.55rem 1rem', fontSize: '0.78rem' }}>
          🛒 PURCHASER: {user?.organization || 'FreshMart Retail Network'}
        </div>
      </div>

      {/* Linear Filter Bar */}
      <div className="linear-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            type="text"
            className="linear-input"
            placeholder="🔍 Search produce by name or Batch Tag ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div style={{ minWidth: 170 }}>
          <select className="linear-input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Warehouse Filter */}
        <div style={{ minWidth: 190 }}>
          <select className="linear-input" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
            <option value="All">All Warehouses</option>
            {warehouses.map(w => <option key={w.id || w.code} value={w.code}>{w.name}</option>)}
          </select>
        </div>

        {/* Availability Filter */}
        <div style={{ minWidth: 160 }}>
          <select className="linear-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Available">Available Only</option>
            <option value="Sold">Sold Items</option>
          </select>
        </div>

      </div>

      {/* Product Modules Grid */}
      {filteredBatches.length === 0 ? (
        <div className="linear-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔍</span>
          <p style={{ fontWeight: 500 }}>No food inventory items match your current filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredBatches.map((b) => {
            const isSold = b.status === 'Sold';
            const today = new Date();
            const expDate = new Date(b.expiry_date);
            const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            let badgeClass = 'linear-badge-fresh';
            if (b.freshness_score < 80) badgeClass = 'linear-badge-good';
            if (b.freshness_score < 65) badgeClass = 'linear-badge-warning';
            if (b.freshness_score < 50) badgeClass = 'linear-badge-spoilage';

            return (
              <div key={b.id || b.batch_id} className="linear-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                
                {/* Status Badge */}
                <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }}>
                  {isSold ? (
                    <span className="linear-badge linear-badge-spoilage">
                      🔴 SOLD OUT
                    </span>
                  ) : (
                    <span className="linear-badge linear-badge-fresh">
                      🟢 AVAILABLE
                    </span>
                  )}
                </div>

                {/* Product Image Frame */}
                <div style={{ height: 165, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', position: 'relative', border: '1px solid var(--linear-border-default)' }}>
                  <img
                    src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"}
                    alt={b.product_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(5, 5, 6, 0.85)', color: '#ffffff', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)' }}>
                    📁 {b.category}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ marginBottom: '0.6rem' }}>
                  <h3 className="linear-text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '3px' }}>{b.product_name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--linear-accent)', fontWeight: 600 }}>
                    Tag: {b.batch_id}
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--linear-fg-muted)', marginBottom: '0.8rem', fontWeight: 400 }}>
                  📍 {b.warehouse_name}
                </p>

                {/* Metrics Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.1rem', background: '#09090C', padding: '12px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Freshness Score</span>
                    <span className={`linear-badge ${badgeClass}`} style={{ fontSize: '0.7rem', marginTop: 3 }}>
                      {b.freshness_score}/100
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Expiry Window</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: daysLeft <= 5 ? '#F87171' : '#34D399' }}>
                      ⏳ {daysLeft > 0 ? `${daysLeft} Days` : 'Expired'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Quantity</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-fg)' }}>{b.quantity_kg} kg</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Wholesale Price</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-accent)' }}>${b.unit_price_per_kg.toFixed(2)}/kg</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid var(--linear-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 400 }}>Total Batch Value</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                      ${(b.quantity_kg * b.unit_price_per_kg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isSold ? (
                    <button className="linear-btn linear-btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                      🚫 Already Sold
                    </button>
                  ) : (
                    <button
                      className="linear-btn linear-btn-primary"
                      onClick={() => setBuyModalItem(b)}
                    >
                      🛒 Buy Batch
                    </button>
                  )}
                </div>

                {/* Sold Metadata */}
                {isSold && (
                  <div style={{ marginTop: '0.7rem', fontSize: '0.76rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '8px', color: '#F87171', fontWeight: 500 }}>
                    Purchased by: {b.purchased_by_store || 'Retail Superstore'}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Buy Modal Dialog */}
      {buyModalItem && (
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
        }} onClick={() => setBuyModalItem(null)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.3rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>🛒 Confirm Retail Batch Purchase</h2>
              <button onClick={() => setBuyModalItem(null)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            {buyError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
                ⚠️ {buyError}
              </div>
            )}

            <div style={{ background: '#09090C', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px', color: 'var(--linear-fg)' }}>{buyModalItem.product_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--linear-accent)', fontWeight: 600, marginBottom: '8px' }}>
                Batch ID: {buyModalItem.batch_id}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <div>Warehouse: <strong>{buyModalItem.warehouse_name}</strong></div>
                <div>Quantity: <strong>{buyModalItem.quantity_kg} kg</strong></div>
                <div>Freshness: <strong>{buyModalItem.freshness_score}/100</strong></div>
                <div>Total Cost: <strong style={{ color: '#34D399' }}>${(buyModalItem.quantity_kg * buyModalItem.unit_price_per_kg).toFixed(2)}</strong></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.4rem' }}>Purchasing Retail Store Name</label>
              <input
                type="text"
                className="linear-input"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. FreshMart Hypermarket #104"
                required
              />
            </div>

            <button
              onClick={handleConfirmBuy}
              disabled={purchasing}
              className="linear-btn linear-btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem' }}
            >
              {purchasing ? 'Executing Purchase on Cloud...' : '✅ Complete Purchase & Lock Inventory'}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

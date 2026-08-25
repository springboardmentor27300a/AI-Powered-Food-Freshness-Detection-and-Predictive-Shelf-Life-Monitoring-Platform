import React from 'react';

export default function InspectorView({ batches, warehouses }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Banner */}
      <div className="ux4g-glass-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(20, 184, 166, 0.06))', borderColor: 'rgba(139, 92, 246, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🔬</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Food Quality Inspection & Compliance Hub</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Review visual computer vision score breakdowns, spoilage probability algorithms, cold-chain compliance, and safety standards.
        </p>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        <div className="ux4g-glass-card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>📊 Quality Weighted Matrix</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: 5 }}>
                <span>Visual Condition Analysis</span>
                <span style={{ color: '#10b981' }}>40% Weight</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#10b981', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: 5 }}>
                <span>Environmental Storage Conditions</span>
                <span style={{ color: '#3b82f6' }}>25% Weight</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#3b82f6', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: 5 }}>
                <span>Remaining Shelf-Life Prediction</span>
                <span style={{ color: '#f59e0b' }}>20% Weight</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#f59e0b', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: 5 }}>
                <span>Product Age & Harvest Index</span>
                <span style={{ color: '#8b5cf6' }}>15% Weight</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#8b5cf6', height: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="ux4g-glass-card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>🛡️ Spoilage Risk Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {batches.map((b) => (
              <div key={b.id || b.batch_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{b.product_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.batch_id} • {b.warehouse_name}</div>
                </div>
                <span className={`ux4g-badge-pill ${b.freshness_score >= 85 ? 'ux4g-badge-fresh' : 'ux4g-badge-acceptable'}`}>
                  {b.freshness_score}/100
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

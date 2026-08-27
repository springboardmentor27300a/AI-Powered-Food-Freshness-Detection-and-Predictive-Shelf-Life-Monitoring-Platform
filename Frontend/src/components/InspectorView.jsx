import React from 'react';

export default function InspectorView({ batches, warehouses }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🔬</span>
          <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
            Food Quality Inspection & Diagnostics Lab
          </h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
          Review visual computer vision score breakdowns, spoilage probability algorithms, cold-chain compliance, and safety standards.
        </p>
      </div>

      {/* Diagnostic Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Quality Weighted Matrix Card */}
        <div className="linear-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
              📊 Quality Weighted Diagnostic Matrix
            </h3>
            <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.7rem' }}>ACTIVE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 500, marginBottom: 5 }}>
                <span>Visual Condition Analysis</span>
                <span style={{ color: '#34D399' }}>40% Weight</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: 8, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#34D399', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 500, marginBottom: 5 }}>
                <span>Environmental Storage Temp/RH</span>
                <span style={{ color: 'var(--linear-accent)' }}>25% Weight</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: 8, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '100%', background: 'var(--linear-accent)', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 500, marginBottom: 5 }}>
                <span>Remaining Shelf-Life Prediction</span>
                <span style={{ color: '#FBBF24' }}>20% Weight</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: 8, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#FBBF24', height: '100%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 500, marginBottom: 5 }}>
                <span>Product Age & Harvest Index</span>
                <span style={{ color: '#C084FC' }}>15% Weight</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: 8, borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: '100%', background: '#C084FC', height: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Spoilage Risk Radar Card */}
        <div className="linear-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
              🛡️ Live Spoilage Risk Radar
            </h3>
            <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.7rem' }}>DIAGNOSTICS OK</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {batches.map((b) => (
              <div key={b.id || b.batch_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#09090C', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--linear-fg)' }}>{b.product_name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>{b.batch_id} • {b.warehouse_name}</div>
                </div>
                <span className={`linear-badge ${b.freshness_score >= 85 ? 'linear-badge-fresh' : 'linear-badge-warning'}`}>
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

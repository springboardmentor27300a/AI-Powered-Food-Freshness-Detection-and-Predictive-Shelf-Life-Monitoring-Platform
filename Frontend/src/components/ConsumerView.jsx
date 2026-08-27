import React from 'react';

export default function ConsumerView({ batches }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🍏</span>
          <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
            Consumer Food Freshness Assistant
          </h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
          Track food shelf-life, get optimal storage tips, and prevent household food waste with AI-assisted decay predictions.
        </p>
      </div>

      {/* Produce Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {batches.slice(0, 4).map((b) => (
          <div key={b.id || b.batch_id} className="linear-card">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.85rem' }}>
              <img src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"} alt={b.product_name} style={{ width: 52, height: 52, borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--linear-border-default)' }} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>{b.product_name}</h3>
                <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                  {b.freshness_score}% FRESH SCORE
                </span>
              </div>
            </div>

            {/* Storage Tip Box */}
            <div style={{ background: '#09090C', padding: '12px', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '0.85rem', fontWeight: 400, border: '1px solid var(--linear-border-default)' }}>
              💡 <strong>STORAGE OPTIMIZATION:</strong> Keep stored at <strong>{b.storage_temp_celsius}°C</strong> in high humidity ({b.storage_humidity_percent}% RH) to maximize crispiness and extend shelf life.
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
              <span>Harvested: {b.harvest_date}</span>
              <span style={{ color: '#F87171' }}>Best Before: {b.expiry_date}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

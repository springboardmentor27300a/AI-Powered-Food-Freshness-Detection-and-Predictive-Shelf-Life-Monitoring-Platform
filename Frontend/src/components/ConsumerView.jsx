import React from 'react';

export default function ConsumerView({ batches }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Banner */}
      <div className="ux4g-glass-card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(59, 130, 246, 0.06))', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🍏</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Consumer Food Freshness Assistant</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Track food shelf-life, get optimal storage tips, and prevent household food waste with AI-assisted decay predictions.
        </p>
      </div>

      {/* Produce Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {batches.slice(0, 4).map((b) => (
          <div key={b.id || b.batch_id} className="ux4g-glass-card">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.85rem' }}>
              <img src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"} alt={b.product_name} style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover' }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{b.product_name}</h3>
                <span className="ux4g-badge-pill ux4g-badge-fresh" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  {b.freshness_score}% Fresh Score
                </span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: 10, fontSize: '0.85rem', marginBottom: '0.85rem', border: '1px solid var(--border-color)' }}>
              💡 <strong>Storage Tip:</strong> Keep stored at <strong>{b.storage_temp_celsius}°C</strong> in high humidity ({b.storage_humidity_percent}% RH) to maximize crispiness and extend shelf life.
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Harvested: {b.harvest_date}</span>
              <span style={{ color: '#f43f5e', fontWeight: 800 }}>Best Before: {b.expiry_date}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

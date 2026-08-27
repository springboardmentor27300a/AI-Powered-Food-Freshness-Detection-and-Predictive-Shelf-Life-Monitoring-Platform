import React from 'react';

export default function AdminView({ stats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>⚡</span>
          <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
            Platform System Administrator Console
          </h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
          Cloud MongoDB Atlas cluster metrics, registered users across roles, active warehouse utilization, and total retail transaction volumes.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        <div className="linear-card">
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>REGISTERED BATCHES</span>
          <span style={{ fontSize: '2.4rem', fontWeight: 600, color: 'var(--linear-accent)', display: 'block', margin: '4px 0' }}>
            {stats?.total_batches || 0}
          </span>
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
            {stats?.available_batches || 0} Available • {stats?.sold_batches || 0} Sold
          </span>
        </div>

        <div className="linear-card">
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROCUREMENT REVENUE</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#34D399', display: 'block', margin: '4px 0' }}>
            ${(stats?.total_sold_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
            Completed retail orders locked
          </span>
        </div>

        <div className="linear-card">
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTIVE COLD HUBS</span>
          <span style={{ fontSize: '2.4rem', fontWeight: 600, color: '#C084FC', display: 'block', margin: '4px 0' }}>
            {stats?.active_warehouses || 3}
          </span>
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
            Connected cold logistics hubs
          </span>
        </div>

        <div className="linear-card">
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL INVENTORY QTY</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#FBBF24', display: 'block', margin: '4px 0' }}>
            {(stats?.total_quantity_kg || 0).toLocaleString()} kg
          </span>
          <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
            Stored across cold hubs
          </span>
        </div>

      </div>

    </div>
  );
}

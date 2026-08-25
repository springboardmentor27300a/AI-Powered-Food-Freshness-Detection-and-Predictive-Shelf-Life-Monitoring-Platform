import React from 'react';

export default function AdminView({ stats }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Banner */}
      <div className="ux4g-glass-card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(16, 185, 129, 0.06))', borderColor: 'rgba(245, 158, 11, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>⚡</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Platform System Administrator Console</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Cloud MongoDB Atlas cluster metrics, registered users across roles, active warehouse utilization, and total retail transaction volumes.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        <div className="ux4g-glass-card">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REGISTERED BATCHES</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', display: 'block', margin: '6px 0' }}>{stats?.total_batches || 0}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {stats?.available_batches || 0} Available • {stats?.sold_batches || 0} Sold
          </span>
        </div>

        <div className="ux4g-glass-card">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROCUREMENT REVENUE</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#3b82f6', display: 'block', margin: '6px 0' }}>
            ${(stats?.total_sold_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Completed retail orders locked
          </span>
        </div>

        <div className="ux4g-glass-card">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACTIVE COLD WAREHOUSES</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#8b5cf6', display: 'block', margin: '6px 0' }}>{stats?.active_warehouses || 3}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Connected cold logistics hubs
          </span>
        </div>

        <div className="ux4g-glass-card">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL INVENTORY QUANTITY</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f59e0b', display: 'block', margin: '6px 0' }}>
            {(stats?.total_quantity_kg || 0).toLocaleString()} kg
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Stored across cold hubs
          </span>
        </div>

      </div>

    </div>
  );
}

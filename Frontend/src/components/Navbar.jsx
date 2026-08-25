import React from 'react';

export default function Navbar({ user, role, setRole, theme, setTheme, onLogout }) {
  const roles = [
    { key: 'Retail Manager', label: '🛒 Retail Marketplace' },
    { key: 'Warehouse Operator', label: '🏭 Warehouse Operations' },
    { key: 'Food Quality Inspector', label: '🔬 Quality Inspection' },
    { key: 'Consumer', label: '🍏 Consumer Freshness' },
    { key: 'Administrator', label: '⚡ Admin Dashboard' }
  ];

  return (
    <header className="ux4g-navbar animate-fade-in" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(16px)' }}>
      <div style={{ maxWidth: 1380, margin: '0 auto', padding: '0.9rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }} onClick={() => { if(!user) window.location.reload(); }}>
          <div className="pulse-glow" style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', color: '#fff', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)' }}>
            🥬
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
              FreshSense AI
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              UX4G Supply Chain Engine
            </span>
          </div>
        </div>

        {/* Logged-In Workspace Role Switcher Pills */}
        {user && (
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '14px', border: '1px solid var(--border-color)', gap: '4px', overflowX: 'auto' }}>
            {roles.map((r) => (
              <button
                key={r.key}
                onClick={() => setRole(r.key)}
                style={{
                  background: role === r.key ? 'linear-gradient(135deg, #10b981, #14b8a6)' : 'transparent',
                  color: role === r.key ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '7px 15px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: role === r.key ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: role === r.key ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                }}
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Controls & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Light/Dark Theme"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              width: 40,
              height: 40,
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem'
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User Account / Sign Out Button */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '5px 14px 5px 8px', borderRadius: 24 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>{user.name}</span>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>{user.role}</span>
              </div>
              <button
                onClick={onLogout}
                className="ux4g-btn-custom"
                style={{ padding: '5px 12px', fontSize: '0.78rem', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', marginLeft: '6px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '6px 14px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 800, color: '#3b82f6' }}>
              🔒 Sign In Required
            </div>
          )}

        </div>

      </div>
    </header>
  );
}

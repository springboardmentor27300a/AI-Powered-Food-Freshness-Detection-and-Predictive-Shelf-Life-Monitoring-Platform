import React from 'react';

export default function Navbar({ user, role, setRole, theme, setTheme, onLogout }) {
  const allRoles = [
    { key: 'Retail Manager', label: '🛒 Marketplace' },
    { key: 'Warehouse Operator', label: '🏭 Warehouse' },
    { key: 'Food Quality Inspector', label: '🔬 Quality Inspection' },
    { key: 'Consumer', label: '🍏 Consumer' },
    { key: 'Administrator', label: '⚡ Admin Dashboard' },
    { key: 'Freshness Analytics Hub', label: '📈 Freshness & Shelf-Life Analytics' }
  ];

  // Restrict visible roles: Admins see all; users see their assigned role + Freshness Analytics Hub
  const isAdmin = user?.role === 'Administrator';
  const visibleRoles = user
    ? (isAdmin ? allRoles : allRoles.filter(r => r.key === user.role || r.key === 'Freshness Analytics Hub'))
    : allRoles;

  return (
    <header style={{
      background: 'rgba(5, 5, 6, 0.85)',
      borderBottom: '1px solid var(--linear-border-default)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      padding: '0.65rem 0'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0.3rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Linear Developer Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }} onClick={() => { if(!user) window.location.reload(); }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #5E6AD2 0%, #4F46E5 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            boxShadow: '0 0 20px rgba(94, 106, 210, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            🥬
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="linear-text-gradient" style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
                FreshSense <span className="linear-accent-gradient">AI</span>
              </h1>
              <span className="linear-badge linear-badge-good" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                MILESTONE 4 • AZURE READY
              </span>
            </div>
            
            <div style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--linear-accent)', display: 'inline-block', boxShadow: '0 0 8px #5E6AD2' }}></span>
              PRECISION FRESHNESS PLATFORM
            </div>
          </div>
        </div>

        {/* Workspace Selector */}
        {user && (
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '4px',
            borderRadius: '10px',
            gap: '5px',
            overflowX: 'auto',
            alignItems: 'center',
            border: '1px solid var(--linear-border-default)'
          }}>
            {visibleRoles.map((r) => {
              const isActive = role === r.key;
              const canClick = isAdmin || r.key === 'Freshness Analytics Hub' || r.key === user.role;
              return (
                <button
                  key={r.key}
                  onClick={() => {
                    if (canClick) setRole(r.key);
                  }}
                  className={`linear-btn ${isActive ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.76rem',
                    whiteSpace: 'nowrap',
                    borderRadius: '7px',
                    cursor: canClick ? 'pointer' : 'default'
                  }}
                >
                  {r.label} {!isAdmin && r.key === user.role && '🔒'}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Controls & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Light / Dark Mode"
            className="linear-btn linear-btn-secondary"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              fontSize: '1.05rem',
              borderRadius: '8px'
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User Profile Badge */}
          {user ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '3px 10px 3px 5px',
              borderRadius: '10px',
              border: '1px solid var(--linear-border-default)'
            }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '8px',
                background: 'var(--linear-accent)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.82rem',
                boxShadow: '0 0 10px rgba(94, 106, 210, 0.4)'
              }}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--linear-fg)' }}>
                  {user.name}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--linear-accent)', fontWeight: 500 }}>
                  {user.role}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="linear-btn linear-btn-secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.68rem',
                  marginLeft: '4px',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#F87171'
                }}
              >
                SIGN OUT
              </button>
            </div>
          ) : (
            <div className="linear-badge linear-badge-warning" style={{ fontSize: '0.72rem', padding: '0.45rem 0.85rem' }}>
              🔒 AUTH REQUIRED
            </div>
          )}

        </div>

      </div>
    </header>
  );
}

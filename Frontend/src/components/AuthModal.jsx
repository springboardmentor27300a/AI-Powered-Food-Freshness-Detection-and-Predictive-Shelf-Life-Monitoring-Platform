import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialRole = 'Retail Manager', warehouses = [] }) {
  if (!isOpen) return null;

  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState(initialRole);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [phone, setPhone] = useState('');
  const [adminKey, setAdminKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const selectedWarehouse = warehouses.find(w => w.code === warehouseId || w.name === warehouseId);
    
    const payload = isLogin
      ? { email, password }
      : {
          name,
          email,
          password,
          role,
          organization: organization || (role === 'Retail Manager' ? 'FreshMart Stores' : ''),
          warehouse_id: warehouseId || (warehouses[0] ? warehouses[0].code : 'WH-CENTRAL-01'),
          warehouse_name: selectedWarehouse ? selectedWarehouse.name : 'GreenValley Central Cold Storage',
          badge_id: badgeId,
          phone,
          admin_key: adminKey
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setSuccessMsg(isLogin ? 'Successfully authenticated!' : 'Registration complete!');
      localStorage.setItem('freshsense_token', data.access_token);
      localStorage.setItem('freshsense_user', JSON.stringify(data.user));

      setTimeout(() => {
        onAuthSuccess(data.user, data.access_token);
        onClose();
      }, 500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ux4g-modal-overlay" onClick={onClose}>
      <div className="ux4g-modal-box animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isLogin ? '🔐 Portal Authentication' : '📝 Dynamic User Registration'}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              {isLogin ? 'Access your UX4G role-based freshness workspace' : 'Register your profile directly into Cloud MongoDB Atlas'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Role Selection Tabs for Registration */}
        {!isLogin && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              SELECT USER ROLE:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {['Consumer', 'Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Administrator'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  style={{
                    background: role === r ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (role === r ? '#10b981' : 'var(--border-color)'),
                    color: role === r ? '#10b981' : 'var(--text-main)',
                    padding: '8px 4px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.2rem', fontWeight: 700 }}>
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.2rem', fontWeight: 700 }}>
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {!isLogin && (
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Full Name</label>
              <input
                type="text"
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: '1.1rem' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
            <input
              type="email"
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Password</label>
            <input
              type="password"
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {/* Dynamic Role Fields */}
          {!isLogin && (
            <>
              {role === 'Warehouse Operator' && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Assigned Cold Storage Warehouse</label>
                  <select
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id || w.code} value={w.code}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {role === 'Retail Manager' && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Retail Store / Hypermarket Chain</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="e.g. FreshMart Superstore #104"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </div>
              )}

              {role === 'Food Quality Inspector' && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Inspector Badge / License ID</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="e.g. INSP-AGRI-9920"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                  />
                </div>
              )}

              {role === 'Administrator' && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Admin Secret Key</label>
                  <input
                    type="password"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="Enter admin key (default: admin123)"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            className="ux4g-btn-custom"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '0.9rem' }}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : `Register as ${role}`}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account yet?" : 'Already registered?'}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 800, marginLeft: 6, cursor: 'pointer' }}
            >
              {isLogin ? 'Register New Account' : 'Sign In'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}

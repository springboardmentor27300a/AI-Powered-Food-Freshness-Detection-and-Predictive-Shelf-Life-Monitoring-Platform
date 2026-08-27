import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialRole = 'Retail Manager', warehouses = [] }) {
  if (!isOpen) return null;

  // Form Mode: 'login' | 'signup' | 'forgot_password'
  const [mode, setMode] = useState('login');
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

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [demoCode, setDemoCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
  };

  // Trigger Reset Code
  const handleSendResetCode = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Please enter your registered email address.');
      return;
    }
    setError('');
    setSendingCode(true);

    try {
      const res = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send reset code.');
      }

      setDemoCode(data.verification_code);
      setResetCode(data.verification_code);
      setSuccessMsg(`🔑 Password Reset OTP sent! Demo Code: ${data.verification_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  // Submit Password Reset
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          verification_code: resetCode.trim() || '123456',
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password.');
      }

      setSuccessMsg('✅ Password reset successfully! Please sign in with your new password.');
      setEmail(resetEmail);
      setTimeout(() => {
        setMode('login');
      }, 1200);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const isLogin = mode === 'login';
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
    }} onClick={onClose}>
      
      <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '100%', borderRadius: 16 }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
              {mode === 'login' ? '🔐 Portal Authentication' : mode === 'signup' ? '📝 Dynamic User Registration' : '🔑 Password Reset'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
              {mode === 'login' ? 'Access your role-based workspace' : mode === 'signup' ? 'Register your profile in Cloud MongoDB' : 'Reset your password using 6-digit OTP'}
            </p>
          </div>
          <button onClick={onClose} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem' }}>
            ✕
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
            ⚠️ ALERT: {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
            ✅ STATUS: {successMsg}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot_password' ? (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>REGISTERED EMAIL ADDRESS</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="email"
                  className="linear-input"
                  placeholder="name@company.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={handleSendResetCode}
                  disabled={sendingCode}
                  className="linear-btn linear-btn-secondary"
                  style={{ whiteSpace: 'nowrap', padding: '0.7rem 0.9rem', fontSize: '0.74rem' }}
                >
                  {sendingCode ? 'SENDING...' : '📧 SEND OTP'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>RESET OTP CODE</label>
                {demoCode && (
                  <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.68rem' }}>
                    DEMO OTP: {demoCode}
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={6}
                className="linear-input"
                style={{ letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 600, color: 'var(--linear-accent)' }}
                placeholder="854912"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>NEW PASSWORD</label>
              <input
                type="password"
                className="linear-input"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>CONFIRM NEW PASSWORD</label>
              <input
                type="password"
                className="linear-input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="linear-btn linear-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.85rem' }}
            >
              {loading ? 'RESETTING...' : '🔑 Reset Password'}
            </button>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--linear-fg-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            
            {mode === 'signup' && (
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>FULL NAME</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>EMAIL ADDRESS</label>
              <input
                type="email"
                className="linear-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>PASSWORD</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot_password'); setError(''); setSuccessMsg(''); setResetEmail(email); }}
                    style={{ background: 'none', border: 'none', color: 'var(--linear-accent)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                className="linear-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="linear-btn linear-btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.8rem', padding: '0.85rem', fontSize: '0.85rem' }}
            >
              {loading ? 'PROCESSING...' : mode === 'login' ? 'SIGN IN' : `REGISTER AS ${role.toUpperCase()}`}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

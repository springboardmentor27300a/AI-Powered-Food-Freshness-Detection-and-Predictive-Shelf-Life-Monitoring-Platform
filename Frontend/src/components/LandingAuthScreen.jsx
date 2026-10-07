import React, { useState, useEffect } from 'react';

export default function LandingAuthScreen({ onAuthSuccess, warehouses = [] }) {
  // Auth Form Mode: 'signup' | 'login' | 'forgot_password'
  const [mode, setMode] = useState('signup');
  const [role, setRole] = useState('Retail Manager');
  
  // Interactive Scanner State
  const [activeSample, setActiveSample] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  // Email Verification / Reset OTP State
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Password Reset Fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sample Produce for Scanner Simulator (Fallback only if 0 batches in MongoDB)
  const defaultSampleItems = [
    {
      name: 'Organic Gala Apples',
      tag: 'BATCH-20260825-APL01',
      category: 'Fruits',
      warehouse: 'GreenValley Central Cold Storage',
      score: 96,
      status: 'Fresh',
      daysLeft: 24,
      temp: '3.2°C',
      humidity: '87.5% RH',
      discoloration: '0.1%',
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Hydroponic Baby Spinach',
      tag: 'BATCH-20260824-SPN01',
      category: 'Vegetables',
      warehouse: 'GreenValley Central Cold Storage',
      score: 88,
      status: 'Good',
      daysLeft: 11,
      temp: '3.8°C',
      humidity: '91.0% RH',
      discoloration: '1.4%',
      image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Vine-Ripened Cluster Tomatoes',
      tag: 'BATCH-20260820-TMT01',
      category: 'Vegetables',
      warehouse: 'Sunshine Valley Produce Hub',
      score: 75,
      status: 'Acceptable',
      daysLeft: 5,
      temp: '5.1°C',
      humidity: '82.0% RH',
      discoloration: '4.8%',
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80'
    }
  ];

  const [liveBatches, setLiveBatches] = useState([]);

  useEffect(() => {
    fetch('/api/inventory/batches')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.slice(0, 5).map(b => ({
            name: b.product_name,
            tag: b.batch_id,
            category: b.category,
            warehouse: b.warehouse_name,
            score: b.freshness_score,
            status: b.freshness_status,
            daysLeft: Math.max(0, Math.ceil((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))),
            temp: `${b.storage_temp_celsius}°C`,
            humidity: `${b.storage_humidity_percent}% RH`,
            discoloration: `${Math.max(0.1, (100 - b.freshness_score) * 0.1).toFixed(1)}%`,
            image: b.image_url || 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'
          }));
          setLiveBatches(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const sampleItems = liveBatches.length > 0 ? liveBatches : defaultSampleItems;
  const currentSample = sampleItems[activeSample] || sampleItems[0];

  const handleSelectSample = (index) => {
    setIsScanning(true);
    setActiveSample(index);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  // Standard Form fields
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

  // Trigger Registration Email Verification Code API
  const handleSendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address before requesting verification code.');
      return;
    }
    setError('');
    setSendingCode(true);

    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send verification code.');
      }

      setCodeSent(true);
      setDemoCode(data.verification_code);
      setVerificationCode(data.verification_code);
      setSuccessMsg(`📧 Verification code sent to ${email}! Demo Code: ${data.verification_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  // Trigger Password Reset OTP API
  const handleSendResetCode = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Please enter your registered email address first.');
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
        throw new Error(data.detail || 'Failed to send password reset code.');
      }

      setCodeSent(true);
      setDemoCode(data.verification_code);
      setResetCode(data.verification_code);
      setSuccessMsg(`🔑 Password Reset OTP sent to ${resetEmail}! Demo OTP Code: ${data.verification_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  // Submit Password Reset
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          verification_code: resetCode.trim(),
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password.');
      }

      setSuccessMsg('✅ Password reset successfully! Please sign in with your new password.');
      setEmail(resetEmail);
      setPassword('');
      setTimeout(() => {
        setMode('login');
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Standard Login / Registration submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'signup' && !verificationCode) {
      setError('Please enter the 6-digit email verification code.');
      return;
    }

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
          verification_code: verificationCode.trim(),
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
        throw new Error(data.detail || 'Authentication failed. Please check your inputs.');
      }

      setSuccessMsg(isLogin ? 'Successfully logged in! Opening workspace...' : 'Email verified & registration complete! Opening workspace...');
      localStorage.setItem('freshsense_token', data.access_token);
      localStorage.setItem('freshsense_user', JSON.stringify(data.user));

      setTimeout(() => {
        onAuthSuccess(data.user);
      }, 600);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Login helper
  const handleQuickDemoLogin = async (demoRole) => {
    setLoading(true);
    setError('');
    
    const demoAccounts = {
      'Warehouse Operator': { email: 'operator.john@wh.com', password: 'password123', name: 'John Miller (WH Operator)', role: 'Warehouse Operator', warehouse_id: 'WH-CENTRAL-01', warehouse_name: 'GreenValley Central Cold Storage' },
      'Retail Manager': { email: 'retailer.alex@freshmart.com', password: 'password123', name: 'Alex Retailer', role: 'Retail Manager', organization: 'FreshMart Hypermarket #104' },
      'Food Quality Inspector': { email: 'inspector.sarah@agri.gov', password: 'password123', name: 'Sarah Inspector', role: 'Food Quality Inspector', badge_id: 'INSP-99201' },
      'Consumer': { email: 'consumer.david@gmail.com', password: 'password123', name: 'David Consumer', role: 'Consumer' },
      'Administrator': { email: 'admin@freshsense.ai', password: 'password123', name: 'System Admin', role: 'Administrator', admin_key: 'admin123' }
    };

    const demoUser = demoAccounts[demoRole] || demoAccounts['Retail Manager'];

    try {
      // First attempt direct login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoUser.email, password: demoUser.password })
      });
      const loginData = await loginRes.json();

      if (loginRes.ok) {
        localStorage.setItem('freshsense_token', loginData.access_token);
        localStorage.setItem('freshsense_user', JSON.stringify(loginData.user));
        onAuthSuccess(loginData.user);
        return;
      }

      // If user doesn't exist yet, request dynamic OTP code then register
      const otpRes = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoUser.email })
      });
      const otpData = await otpRes.json();

      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...demoUser,
          verification_code: otpData.verification_code
        })
      });
      const regData = await regRes.json();

      if (regRes.ok) {
        localStorage.setItem('freshsense_token', regData.access_token);
        localStorage.setItem('freshsense_user', JSON.stringify(regData.user));
        onAuthSuccess(regData.user);
      } else {
        throw new Error(regData.detail || 'Demo registration failed');
      }

    } catch (err) {
      const fallbackUser = { id: 'demo_123', name: demoUser.name, email: demoUser.email, role: demoUser.role, organization: demoUser.organization, warehouse_name: demoUser.warehouse_name };
      localStorage.setItem('freshsense_user', JSON.stringify(fallbackUser));
      onAuthSuccess(fallbackUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '3.5rem', padding: '2rem 1.5rem 5rem 1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* HERO SECTION - LINEAR GLASS & GRADIENT TYPOGRAPHY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '2.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Hero Heading & Interactive Scanner */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          
          <div className="linear-badge linear-badge-fresh" style={{ width: 'fit-content', padding: '0.4rem 1rem' }}>
            ✨ EMAIL VERIFIED CLOUD MONGO DB PLATFORM
          </div>

          <div>
            <h1 className="linear-text-gradient" style={{ fontSize: '3.2rem', fontWeight: 600, lineHeight: 1.12, letterSpacing: '-0.03em' }}>
              Next-Gen <span className="linear-accent-gradient">AI Food Freshness</span> & Cold Chain Platform
            </h1>
          </div>

          <p style={{ fontSize: '1.05rem', color: 'var(--linear-fg-muted)', lineHeight: 1.6, fontWeight: 400 }}>
            Eliminate supply chain food waste with real-time computer vision freshness scoring, Batch ID tags, cold-chain environmental tracking, and double-purchase locking.
          </p>

          {/* Interactive AI Scanner Simulator Linear Glass Card */}
          <div className="linear-card" style={{ padding: '1.4rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(94, 106, 210, 0.2)', color: 'var(--linear-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', border: '1px solid var(--linear-border-accent)' }}>
                  📡
                </div>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--linear-fg)' }}>Interactive AI Freshness Scanner Simulator</span>
              </div>

              <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.68rem' }}>
                CLICK SAMPLE TO SCAN
              </span>
            </div>

            {/* Sample Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
              {sampleItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(idx)}
                  className={`linear-btn ${activeSample === idx ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px'
                  }}
                >
                  <span>{idx === 0 ? '🍎' : idx === 1 ? '🥬' : '🍅'}</span>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>

            {/* Viewport Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '1.2rem', alignItems: 'center', background: '#09090C', padding: '1rem', borderRadius: '12px', border: '1px solid var(--linear-border-default)', position: 'relative', overflow: 'hidden' }}>
              
              <div style={{ height: 110, borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                <img src={currentSample.image} alt={currentSample.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(5, 5, 6, 0.85)', color: '#ffffff', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)' }}>
                  {currentSample.tag}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 500, fontSize: '1rem', color: 'var(--linear-fg)' }}>{currentSample.name}</span>
                  <span className={`linear-badge ${currentSample.score >= 90 ? 'linear-badge-fresh' : 'linear-badge-good'}`}>
                    {currentSample.score}/100
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', marginTop: '6px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--linear-border-default)' }}>
                    <span style={{ color: 'var(--linear-fg-muted)', display: 'block', fontSize: '0.65rem' }}>Shelf Window</span>
                    <strong style={{ color: '#34D399' }}>⏳ {currentSample.daysLeft} Days Left</strong>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--linear-border-default)' }}>
                    <span style={{ color: 'var(--linear-fg-muted)', display: 'block', fontSize: '0.65rem' }}>Decay Index</span>
                    <strong style={{ color: 'var(--linear-accent)' }}>🔍 {currentSample.discoloration}</strong>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--linear-border-default)' }}>
                    <span style={{ color: 'var(--linear-fg-muted)', display: 'block', fontSize: '0.65rem' }}>Storage Temp</span>
                    <strong style={{ color: 'var(--linear-fg)' }}>🌡️ {currentSample.temp}</strong>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--linear-border-default)' }}>
                    <span style={{ color: 'var(--linear-fg-muted)', display: 'block', fontSize: '0.65rem' }}>Humidity</span>
                    <strong style={{ color: 'var(--linear-fg)' }}>💧 {currentSample.humidity}</strong>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Persona Quick Access Strip */}
          <div style={{ paddingTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
              ⚡ ONE-CLICK PERSONA DEMO SIGN IN:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Consumer', 'Administrator'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleQuickDemoLogin(r)}
                  className="linear-btn linear-btn-secondary"
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.74rem'
                  }}
                >
                  Demo {r}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sign Up / Sign In / Forgot Password Linear Glass Card */}
        <div className="linear-card" style={{ padding: '1.8rem' }}>
          
          {/* Header Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.9rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                {mode === 'login' ? '🔐 Portal Sign In' : mode === 'signup' ? '📝 Create Profile' : '🔑 Password Reset'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
                {mode === 'login' ? 'Enter credentials to open workspace' : mode === 'signup' ? 'Verify email for Cloud MongoDB profile' : 'Enter registered email & 6-digit OTP'}
              </p>
            </div>

            <div style={{ display: 'flex', background: '#09090C', padding: '3px', borderRadius: '8px', border: '1px solid var(--linear-border-default)' }}>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
                className={`linear-btn ${mode === 'signup' ? 'linear-btn-primary' : 'linear-btn-ghost'}`}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.74rem', borderRadius: '6px' }}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                className={`linear-btn ${mode === 'login' ? 'linear-btn-primary' : 'linear-btn-ghost'}`}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.74rem', borderRadius: '6px' }}
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
              ✅ {successMsg}
            </div>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot_password' ? (
            <form onSubmit={handleResetPasswordSubmit}>
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
                    {sendingCode ? 'SENDING...' : '📧 SEND RESET OTP'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>6-DIGIT RESET OTP CODE</label>
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
                style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem' }}
              >
                {loading ? 'Updating Password...' : '🔑 Reset Password & Sign In'}
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
            /* STANDARD LOGIN / SIGNUP FORM */
            <form onSubmit={handleSubmit}>
              
              {mode === 'signup' && (
                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    SELECT USER ROLE:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {['Consumer', 'Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Administrator'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRoleChange(r)}
                        className={`linear-btn ${role === r ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                        style={{
                          padding: '0.4rem 0.2rem',
                          fontSize: '0.68rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Email + OTP Trigger */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>EMAIL ADDRESS</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="email"
                    className="linear-input"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {mode === 'signup' && (
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode}
                      className="linear-btn linear-btn-secondary"
                      style={{ whiteSpace: 'nowrap', padding: '0.7rem 0.9rem', fontSize: '0.74rem' }}
                    >
                      {sendingCode ? 'SENDING...' : codeSent ? '✓ RESEND OTP' : '📧 SEND OTP'}
                    </button>
                  )}
                </div>
              </div>

              {/* OTP Input for Signup */}
              {mode === 'signup' && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>6-DIGIT EMAIL VERIFICATION OTP</label>
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
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                  />
                </div>
              )}

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

              {/* Dynamic Role Fields for Signup */}
              {mode === 'signup' && (
                <>
                  {role === 'Warehouse Operator' && (
                    <div style={{ marginBottom: '1.1rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>ASSIGNED STORAGE HUB</label>
                      <select
                        className="linear-input"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                      >
                        <option value="">Select Warehouse Hub...</option>
                        {warehouses.map((w) => (
                          <option key={w.id || w.code} value={w.code}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {role === 'Retail Manager' && (
                    <div style={{ marginBottom: '1.1rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>RETAIL STORE NAME</label>
                      <input
                        type="text"
                        className="linear-input"
                        placeholder="e.g. FreshMart Superstore #104"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                      />
                    </div>
                  )}

                  {role === 'Food Quality Inspector' && (
                    <div style={{ marginBottom: '1.1rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>INSPECTOR BADGE LICENSE</label>
                      <input
                        type="text"
                        className="linear-input"
                        placeholder="e.g. INSP-AGRI-9920"
                        value={badgeId}
                        onChange={(e) => setBadgeId(e.target.value)}
                      />
                    </div>
                  )}

                  {role === 'Administrator' && (
                    <div style={{ marginBottom: '1.1rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.3rem' }}>ADMINISTRATOR SECRET KEY</label>
                      <input
                        type="password"
                        className="linear-input"
                        placeholder="Default: admin123"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                className="linear-btn linear-btn-primary"
                disabled={loading}
                style={{ width: '100%', marginTop: '0.8rem', padding: '0.85rem', fontSize: '0.9rem' }}
              >
                {loading ? 'Processing Cloud Sync...' : mode === 'login' ? 'Sign In & Access Platform' : `Create ${role} Profile`}
              </button>

            </form>
          )}

        </div>

      </div>

      {/* SUPPLY CHAIN WORKFLOW - LINEAR GLASS MODULES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="linear-badge linear-badge-good" style={{ padding: '0.4rem 1rem' }}>
            END-TO-END SUPPLY CHAIN WORKFLOW
          </span>
          <h2 className="linear-text-gradient" style={{ fontSize: '2.2rem', fontWeight: 600, marginTop: '8px' }}>
            How FreshSense Protects Food Freshness
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          
          <div className="linear-card">
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--linear-accent)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', boxShadow: '0 0 12px rgba(94,106,210,0.4)' }}>
              1
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--linear-fg)' }}>🏭 Batch Tagging</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--linear-fg-muted)', lineHeight: 1.5 }}>
              Warehouse Operators assign unique Batch Tag IDs (`BATCH-YYYYMMDD-XXX`), specify harvest dates, and expiry limits.
            </p>
          </div>

          <div className="linear-card">
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', border: '1px solid var(--linear-border-default)' }}>
              2
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--linear-fg)' }}>❄️ Cold Chain Sensing</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--linear-fg-muted)', lineHeight: 1.5 }}>
              Continuous storage temperature (°C) and relative humidity (%) tracking across multi-location cold hubs to prevent decay.
            </p>
          </div>

          <div className="linear-card">
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(94,106,210,0.2)', color: 'var(--linear-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', border: '1px solid var(--linear-border-accent)' }}>
              3
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--linear-fg)' }}>🛒 Retail Purchase Lock</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--linear-fg-muted)', lineHeight: 1.5 }}>
              Retail Managers browse live marketplace and click 'Buy Batch' &rarr; atomically updates status to 'SOLD' and locks double-buying.
            </p>
          </div>

          <div className="linear-card">
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--linear-accent)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem', boxShadow: '0 0 12px rgba(94,106,210,0.4)' }}>
              4
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--linear-fg)' }}>🍏 Consumer Audit</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--linear-fg-muted)', lineHeight: 1.5 }}>
              End consumers scan batch tags to verify freshness score history, storage conditions, and remaining shelf life.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

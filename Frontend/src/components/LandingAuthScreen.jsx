import React, { useState } from 'react';

export default function LandingAuthScreen({ onAuthSuccess, warehouses = [] }) {
  const [isLogin, setIsLogin] = useState(false); // Default to Sign Up
  const [role, setRole] = useState('Retail Manager');
  
  // Interactive Scanner State
  const [activeSample, setActiveSample] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  // Email Verification State
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Sample Produce for Scanner Simulator
  const sampleItems = [
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

  const currentSample = sampleItems[activeSample];

  const handleSelectSample = (index) => {
    setIsScanning(true);
    setActiveSample(index);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

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

  // Trigger Email Verification Code API
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
      setVerificationCode(data.verification_code); // Auto-fill for convenience
      setSuccessMsg(`📧 Verification code sent to ${email}! Demo Code: ${data.verification_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLogin && !verificationCode) {
      setError('Please enter the 6-digit email verification code.');
      return;
    }

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
          verification_code: verificationCode.trim() || '123456',
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
      'Warehouse Operator': { email: 'operator.john@wh.com', password: 'password123', name: 'John Miller (WH Operator)', role: 'Warehouse Operator', verification_code: '123456', warehouse_id: 'WH-CENTRAL-01', warehouse_name: 'GreenValley Central Cold Storage' },
      'Retail Manager': { email: 'retailer.alex@freshmart.com', password: 'password123', name: 'Alex Retailer', role: 'Retail Manager', verification_code: '123456', organization: 'FreshMart Hypermarket #104' },
      'Food Quality Inspector': { email: 'inspector.sarah@agri.gov', password: 'password123', name: 'Sarah Inspector', role: 'Food Quality Inspector', verification_code: '123456', badge_id: 'INSP-99201' },
      'Consumer': { email: 'consumer.david@gmail.com', password: 'password123', name: 'David Consumer', role: 'Consumer', verification_code: '123456' },
      'Administrator': { email: 'admin@freshsense.ai', password: 'password123', name: 'System Admin', role: 'Administrator', verification_code: '123456' }
    };

    const demoUser = demoAccounts[demoRole] || demoAccounts['Retail Manager'];

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoUser)
      });
      const data = await res.json();

      let userObj = data.user;
      let token = data.access_token;

      if (!res.ok) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: demoUser.email, password: demoUser.password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          userObj = loginData.user;
          token = loginData.access_token;
        } else {
          throw new Error('Demo login failed');
        }
      }

      localStorage.setItem('freshsense_token', token);
      localStorage.setItem('freshsense_user', JSON.stringify(userObj));
      onAuthSuccess(userObj);

    } catch (err) {
      const fallbackUser = { id: 'demo_123', name: demoUser.name, email: demoUser.email, role: demoUser.role, organization: demoUser.organization, warehouse_name: demoUser.warehouse_name };
      localStorage.setItem('freshsense_user', JSON.stringify(fallbackUser));
      onAuthSuccess(fallbackUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '3.5rem', padding: '2rem 1.5rem 5rem 1.5rem', maxWidth: 1380, margin: '0 auto' }}>
      
      {/* HERO SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '3rem', alignItems: 'center' }}>
        
        {/* LEFT COLUMN: AI Scanner Simulator */}
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '6px 18px', borderRadius: 30, width: 'fit-content' }}>
            <span className="pulse-glow" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.5px' }}>
              EMAIL VERIFIED CLOUD MONGO DB PLATFORM
            </span>
          </div>

          <h1 className="gradient-animated-text" style={{ fontSize: '3.1rem', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-1px' }}>
            Next-Gen AI Food Freshness & Cold Chain Platform
          </h1>

          <p style={{ fontSize: '1.08rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Eliminate supply chain food waste with real-time computer vision freshness scoring, Batch ID tags, cold-chain environmental tracking, and double-purchase locking.
          </p>

          {/* Interactive AI Scanner Viewport */}
          <div className="ux4g-glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(17, 24, 39, 0.95))', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="pulse-glow" style={{ fontSize: '1.2rem', color: '#10b981' }}>📡</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>Interactive AI Freshness Scanner Simulator</span>
              </div>
              <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '2px 10px', borderRadius: 20, fontWeight: 800 }}>
                CLICK SAMPLE TO SCAN
              </span>
            </div>

            {/* Sample Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
              {sampleItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(idx)}
                  style={{
                    background: activeSample === idx ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (activeSample === idx ? '#10b981' : 'var(--border-color)'),
                    color: activeSample === idx ? '#10b981' : 'var(--text-muted)',
                    padding: '6px 12px',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{idx === 0 ? '🍎' : idx === 1 ? '🥬' : '🍅'}</span>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>

            {/* Viewport Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.2rem', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 14, border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
              
              <div className="scanner-laser-line" />

              <div style={{ height: 110, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <img src={currentSample.image} alt={currentSample.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 800 }}>
                  {currentSample.tag}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>{currentSample.name}</span>
                  <span className={`ux4g-badge-pill ${currentSample.score >= 90 ? 'ux4g-badge-fresh' : 'ux4g-badge-good'}`} style={{ fontSize: '0.75rem' }}>
                    {currentSample.score}/100 {currentSample.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', marginTop: '6px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: 6 }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Shelf-Life Window</span>
                    <strong style={{ color: '#10b981' }}>⏳ {currentSample.daysLeft} Days Left</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: 6 }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Surface Decay Index</span>
                    <strong style={{ color: '#3b82f6' }}>🔍 {currentSample.discoloration}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: 6 }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Optimal Storage Temp</span>
                    <strong>🌡️ {currentSample.temp}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: 6 }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Relative Humidity</span>
                    <strong>💧 {currentSample.humidity}</strong>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Quick Demo Sign In */}
          <div style={{ paddingTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ Instant One-Click Persona Demo Sign In:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Consumer', 'Administrator'].map((r) => (
                <button
                  key={r}
                  onClick={() => handleQuickDemoLogin(r)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    padding: '7px 14px',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.25s'
                  }}
                  onMouseOver={(e) => e.target.style.borderColor = '#10b981'}
                  onMouseOut={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  Demo {r}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sign Up / Sign In Form with Email Verification */}
        <div className="animate-fade-in" style={{ width: '100%' }}>
          
          <div className="ux4g-glass-card" style={{ padding: '2.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 25px 65px rgba(0,0,0,0.6)' }}>
            
            {/* Header Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                  {isLogin ? '🔐 Account Sign In' : '📝 Create New Account'}
                </h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {isLogin ? 'Enter credentials to open your role workspace' : 'Verify your email to create a Cloud MongoDB profile'}
                </p>
              </div>

              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  style={{
                    background: !isLogin ? 'linear-gradient(135deg, #10b981, #14b8a6)' : 'transparent',
                    color: !isLogin ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer'
                  }}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); }}
                  style={{
                    background: isLogin ? 'linear-gradient(135deg, #10b981, #14b8a6)' : 'transparent',
                    color: isLogin ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer'
                  }}
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* Error/Success Alerts */}
            {error && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', padding: '0.85rem', borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.2rem', fontWeight: 800 }}>
                ⚠️ {error}
              </div>
            )}
            {successMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', padding: '0.85rem', borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.2rem', fontWeight: 800 }}>
                ✅ {successMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              
              {!isLogin && (
                <div style={{ marginBottom: '1.3rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                    SELECT YOUR USER ROLE:
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
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isLogin && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Full Name</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="e.g. Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Email Address Input + Send Verification Code Button */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="email"
                    style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {!isLogin && (
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode}
                      style={{
                        padding: '0.8rem 1.1rem',
                        borderRadius: 10,
                        background: codeSent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid ' + (codeSent ? '#10b981' : '#3b82f6'),
                        color: codeSent ? '#10b981' : '#3b82f6',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {sendingCode ? 'Sending...' : codeSent ? '✓ Resend Code' : '📧 Send OTP Code'}
                    </button>
                  )}
                </div>
              </div>

              {/* 6-Digit Email Verification Code Input for Sign Up */}
              {!isLogin && (
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      6-Digit Email Verification Code
                    </label>
                    {demoCode && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800 }}>
                        Demo OTP: {demoCode}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid ' + (verificationCode ? '#10b981' : 'var(--border-color)'), color: '#10b981', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '3px', outline: 'none' }}
                    placeholder="e.g. 854912"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Password</label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
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
                      <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Assigned Warehouse</label>
                      <select
                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                      >
                        <option value="">Select Cold Storage Hub...</option>
                        {warehouses.map((w) => (
                          <option key={w.id || w.code} value={w.code}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {role === 'Retail Manager' && (
                    <div style={{ marginBottom: '1.1rem' }}>
                      <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Retail Store / Store Name</label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
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
                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
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
                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', outline: 'none' }}
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
                className="ux4g-btn-custom pulse-glow"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '0.95rem', fontSize: '1rem' }}
              >
                {loading ? 'Verifying & Saving to Cloud MongoDB...' : isLogin ? 'Sign In & Access Platform' : `Verify Email & Create ${role} Account`}
              </button>

            </form>

          </div>

        </div>

      </div>

      {/* SUPPLY CHAIN WORKFLOW */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>
            END-TO-END SUPPLY CHAIN WORKFLOW
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>
            How FreshSense AI Protects Food Freshness
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          
          <div className="ux4g-glass-card float-bob">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
              1
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.4rem' }}>🏭 Batch Tagging</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Warehouse Operators assign unique Batch Tag IDs (`BATCH-YYYYMMDD-XXX`), specify harvest dates, expiry windows, and initial freshness score.
            </p>
          </div>

          <div className="ux4g-glass-card float-bob-delay">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
              2
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.4rem' }}>❄️ Cold Chain Monitoring</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Continuous storage temperature (°C) and relative humidity (%) tracking across multi-location cold hubs to prevent decay.
            </p>
          </div>

          <div className="ux4g-glass-card float-bob">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
              3
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.4rem' }}>🛒 Retail Purchase Lock</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Retail Managers browse live multi-warehouse marketplace and click 'Buy Batch' &rarr; atomically updates status to 'SOLD' and locks double-purchasing.
            </p>
          </div>

          <div className="ux4g-glass-card float-bob-delay">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
              4
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.4rem' }}>🍏 Consumer Protection</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Consumers get remaining shelf-life predictions, optimal temperature storage tips, and spoilage warning indicators.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

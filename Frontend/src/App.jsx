import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingAuthScreen from './components/LandingAuthScreen';
import WarehouseOperatorView from './components/WarehouseOperatorView';
import RetailManagerView from './components/RetailManagerView';
import InspectorView from './components/InspectorView';
import ConsumerView from './components/ConsumerView';
import AdminView from './components/AdminView';
import FreshnessAnalyticsHub from './components/FreshnessAnalyticsHub';

export default function App() {
  const [theme, setTheme] = useState('dark');
  
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('freshsense_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Current Active Role Workspace View
  const [role, setRole] = useState(() => {
    const saved = localStorage.getItem('freshsense_user');
    if (saved) {
      const u = JSON.parse(saved);
      return u.role || 'Retail Manager';
    }
    return 'Retail Manager';
  });

  // Data state
  const [batches, setBatches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Lock Active Workspace Role strictly to User Role upon Auth
  useEffect(() => {
    if (user && user.role) {
      setRole(user.role);
    }
  }, [user]);

  // Fetch API Data from Backend
  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, cRes, sRes] = await Promise.all([
        fetch('/api/inventory/batches'),
        fetch('/api/warehouses'),
        fetch('/api/categories'),
        fetch('/api/analytics/dashboard')
      ]);

      if (bRes.ok) setBatches(await bRes.json());
      if (wRes.ok) setWarehouses(await wRes.json());
      if (cRes.ok) setCategories(await cRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error('Error connecting to FreshSense API backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    if (userData.role) {
      setRole(userData.role);
    }
    fetchData();
  };

  const handleLogout = () => {
    localStorage.removeItem('freshsense_token');
    localStorage.removeItem('freshsense_user');
    setUser(null);
  };

  // Register Produce Batch API call
  const handleRegisterBatch = async (batchPayload) => {
    const token = localStorage.getItem('freshsense_token');
    const res = await fetch('/api/inventory/register-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(batchPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to register produce batch');
    }

    await fetchData();
    return data;
  };

  // Buy Produce Batch API call
  const handleBuyBatch = async (batchIdentifier, buyerStore) => {
    const token = localStorage.getItem('freshsense_token');
    const res = await fetch(`/api/inventory/batches/${batchIdentifier}/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ buyer_store: buyerStore })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to buy produce batch');
    }

    await fetchData();
    return data;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Linear Ambient Background Grid & Floating Light Blobs */}
      <div className="linear-bg-grid" />
      <div className="linear-blob-1" />
      <div className="linear-blob-2" />

      {/* Linear Header */}
      <Navbar
        user={user}
        role={role}
        setRole={setRole}
        theme={theme}
        setTheme={setTheme}
        onLogout={handleLogout}
      />

      {/* Main Workspace Body */}
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {!user ? (
          // Dedicated Sign Up & Login Landing Screen
          <LandingAuthScreen
            onAuthSuccess={handleAuthSuccess}
            warehouses={warehouses}
          />
        ) : (
          // Authenticated Role Workspace
          <div style={{ maxWidth: 1380, width: '100%', margin: '0 auto', padding: '2rem 1.5rem 4rem 1.5rem' }}>
            
            {role === 'Warehouse Operator' && (
              <WarehouseOperatorView
                batches={batches}
                warehouses={warehouses}
                categories={categories}
                onRegisterBatch={handleRegisterBatch}
                user={user}
                loading={loading}
                onRefreshWarehouses={fetchData}
              />
            )}

            {role === 'Retail Manager' && (
              <RetailManagerView
                batches={batches}
                warehouses={warehouses}
                categories={categories}
                onBuyBatch={handleBuyBatch}
                user={user}
                onRefreshWarehouses={fetchData}
              />
            )}

            {role === 'Food Quality Inspector' && (
              <InspectorView batches={batches} warehouses={warehouses} />
            )}

            {role === 'Consumer' && (
              <ConsumerView batches={batches} user={user} />
            )}

            {role === 'Administrator' && (
              <AdminView stats={stats} />
            )}

            {role === 'Freshness Analytics Hub' && (
              <FreshnessAnalyticsHub
                user={user}
                warehouses={warehouses}
                batches={batches}
              />
            )}

          </div>
        )}
      </main>

      {/* Linear Precision Footer */}
      <footer style={{
        borderTop: '1px solid var(--linear-border-default)',
        padding: '1.5rem',
        textAlign: 'center',
        fontSize: '0.82rem',
        color: 'var(--linear-fg-muted)',
        background: 'rgba(5, 5, 6, 0.95)',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.68rem' }}>CLOUD SYNC OK</span>
          <span style={{ fontWeight: 500, color: 'var(--linear-fg)' }}>FRESHSENSE AI • LINEAR / MODERN DESIGN SYSTEM</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>LAYERED AMBIENT LIGHTING • CLOUD MONGODB ATLAS CONNECTED</div>
      </footer>

    </div>
  );
}

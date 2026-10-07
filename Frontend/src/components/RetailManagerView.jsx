import React, { useState, useEffect } from 'react';

export default function RetailManagerView({ batches, warehouses, categories, onBuyBatch, user, onRefreshWarehouses }) {
  // Navigation Tabs: 'hubs' (Warehouse Hubs & Operator Assignment) | 'marketplace' (Produce Procurement)
  const [activeTab, setActiveTab] = useState('hubs');

  // Available Warehouse Operators for Assignment
  const [operators, setOperators] = useState([]);
  const [loadingOperators, setLoadingOperators] = useState(false);

  // Create Warehouse Hub Modal States
  const [showCreateHubModal, setShowCreateHubModal] = useState(false);
  const [hubName, setHubName] = useState('');
  const [hubCode, setHubCode] = useState('');
  const [hubLocation, setHubLocation] = useState('');
  const [hubCapacity, setHubCapacity] = useState('8000');
  const [hubTempRange, setHubTempRange] = useState('2°C - 4°C');
  const [hubHumRange, setHubHumRange] = useState('85% - 90%');
  const [selectedInitialOperator, setSelectedInitialOperator] = useState('');
  const [creatingHub, setCreatingHub] = useState(false);
  const [hubMsg, setHubMsg] = useState({ type: '', text: '' });

  // Assign Operator Modal States
  const [assignModalHub, setAssignModalHub] = useState(null);
  const [selectedAssignOperator, setSelectedAssignOperator] = useState('');
  const [assigningOperator, setAssigningOperator] = useState(false);
  const [assignMsg, setAssignMsg] = useState({ type: '', text: '' });

  // Marketplace Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Buy Modal State
  const [buyModalItem, setBuyModalItem] = useState(null);
  const [storeName, setStoreName] = useState(user?.organization || 'FreshMart Superstores #104');
  const [purchasing, setPurchasing] = useState(false);
  const [buyError, setBuyError] = useState('');

  // Fetch registered Warehouse Operators
  const fetchOperators = async () => {
    setLoadingOperators(true);
    try {
      const res = await fetch('/api/warehouses/available-operators');
      if (res.ok) {
        const data = await res.json();
        setOperators(data);
      }
    } catch (err) {
      console.error('Failed to load operators:', err);
    } finally {
      setLoadingOperators(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  // Auto-generate Hub Code based on Name
  const handleAutoHubCode = (name) => {
    setHubName(name);
    if (!hubCode || hubCode.startsWith('WH-')) {
      const clean = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'HUB';
      const num = Math.floor(10 + Math.random() * 90);
      setHubCode(`WH-${clean}-${num}`);
    }
  };

  // Create Warehouse Hub Handler
  const handleCreateHub = async (e) => {
    e.preventDefault();
    setCreatingHub(true);
    setHubMsg({ type: '', text: '' });

    const token = localStorage.getItem('freshsense_token');
    const matchedOp = operators.find((op) => op.id === selectedInitialOperator);

    const payload = {
      name: hubName.trim(),
      code: hubCode.trim().toUpperCase(),
      location: hubLocation.trim(),
      capacity_kg: parseFloat(hubCapacity),
      temperature_range_c: hubTempRange,
      humidity_range_pct: hubHumRange,
      assigned_operator_id: selectedInitialOperator || undefined,
      assigned_operator_name: matchedOp?.name,
      assigned_operator_email: matchedOp?.email
    };

    try {
      const res = await fetch('/api/warehouses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create warehouse hub.');
      }

      setHubMsg({ type: 'success', text: `✅ Warehouse Hub '${data.name}' (${data.code}) created successfully!` });
      if (onRefreshWarehouses) onRefreshWarehouses();
      fetchOperators();

      setTimeout(() => {
        setShowCreateHubModal(false);
        setHubName('');
        setHubCode('');
        setHubLocation('');
        setSelectedInitialOperator('');
        setHubMsg({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      setHubMsg({ type: 'error', text: err.message });
    } finally {
      setCreatingHub(false);
    }
  };

  // Assign Operator to Hub Handler
  const handleAssignOperator = async (e) => {
    e.preventDefault();
    if (!assignModalHub || !selectedAssignOperator) return;

    setAssigningOperator(true);
    setAssignMsg({ type: '', text: '' });

    const token = localStorage.getItem('freshsense_token');
    const matchedOp = operators.find((op) => op.id === selectedAssignOperator);

    try {
      const res = await fetch(`/api/warehouses/${assignModalHub.code || assignModalHub.id}/assign-operator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          operator_id: selectedAssignOperator,
          operator_name: matchedOp?.name,
          operator_email: matchedOp?.email
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to assign warehouse operator.');
      }

      setAssignMsg({ type: 'success', text: `✅ Operator '${matchedOp?.name}' assigned to '${data.name}'!` });
      if (onRefreshWarehouses) onRefreshWarehouses();
      fetchOperators();

      setTimeout(() => {
        setAssignModalHub(null);
        setSelectedAssignOperator('');
        setAssignMsg({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      setAssignMsg({ type: 'error', text: err.message });
    } finally {
      setAssigningOperator(false);
    }
  };

  // Filter Logic for Marketplace
  const filteredBatches = batches.filter((b) => {
    if (selectedCategory !== 'All' && b.category !== selectedCategory) return false;
    if (selectedWarehouse !== 'All' && b.warehouse_id !== selectedWarehouse && b.warehouse_name !== selectedWarehouse) return false;
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchProduct = b.product_name.toLowerCase().includes(term);
      const matchBatch = b.batch_id.toLowerCase().includes(term);
      const matchCategory = b.category.toLowerCase().includes(term);
      if (!matchProduct && !matchBatch && !matchCategory) return false;
    }
    return true;
  });

  const handleConfirmBuy = async () => {
    if (!buyModalItem) return;
    setPurchasing(true);
    setBuyError('');

    try {
      await onBuyBatch(buyModalItem.batch_id || buyModalItem.id, storeName);
      setBuyModalItem(null);
    } catch (err) {
      setBuyError(err.message || 'Failed to complete retail purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  const isApproved = user?.is_approved !== false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Approval Warning Banner if Pending Admin Approval */}
      {!isApproved && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '1rem 1.4rem',
          borderRadius: '12px',
          color: '#F87171',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '1.8rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Account Pending Administrator Approval
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--linear-fg-muted)', marginTop: 2 }}>
              Your Retail Manager account must be approved by the platform Administrator before you can create Warehouse Hubs or assign Warehouse Operators.
            </div>
          </div>
        </div>
      )}

      {/* Hero Container */}
      <div className="linear-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🏢</span>
            <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
              Retail Operations & Warehouse Hub Management
            </h2>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
            Create and manage regional Warehouse Hubs, assign Warehouse Operators, and procure fresh inventory.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="linear-badge linear-badge-good" style={{ padding: '0.55rem 1rem', fontSize: '0.78rem' }}>
            🛒 MANAGER: {user?.name || 'Retail Manager'} ({user?.organization || 'Retail Network'})
          </div>
          {isApproved && (
            <button
              className="linear-btn linear-btn-primary"
              onClick={() => {
                setShowCreateHubModal(true);
                handleAutoHubCode('Metro Logistics Hub');
              }}
              style={{ padding: '0.65rem 1.2rem', fontSize: '0.84rem' }}
            >
              ➕ Create Warehouse Hub
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('hubs')}
          className={`linear-btn ${activeTab === 'hubs' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
        >
          🏭 Warehouse Hubs & Operator Assignment ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`linear-btn ${activeTab === 'marketplace' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
        >
          🛒 Produce Procurement Marketplace ({batches.length})
        </button>
      </div>

      {/* =========================================================================
          TAB 1: WAREHOUSE HUBS & OPERATOR ASSIGNMENT (THE REQUESTED WORKFLOW)
         ========================================================================= */}
      {activeTab === 'hubs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Workflow Reminder Card */}
          <div className="linear-card" style={{ padding: '1rem 1.4rem', background: '#09090C', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.3rem' }}>💡</span>
              <div style={{ fontSize: '0.84rem' }}>
                <strong>Retail Manager Workflow:</strong> As an approved Retail Manager, you create Warehouse Hubs and assign Warehouse Operators to operate them.
              </div>
            </div>
            {isApproved && (
              <button
                className="linear-btn linear-btn-primary"
                onClick={() => {
                  setShowCreateHubModal(true);
                  handleAutoHubCode('Coastal Cold Storage');
                }}
                style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
              >
                ➕ New Hub
              </button>
            )}
          </div>

          {/* Warehouse Hubs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.35rem' }}>
            {warehouses.map((wh) => (
              <div key={wh.id || wh.code} className="linear-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                      {wh.code}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)', marginTop: 2 }}>{wh.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>📍 {wh.location}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', fontWeight: 500 }}>{wh.temperature_range_c}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>{wh.humidity_range_pct}</div>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div style={{ background: '#09090C', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--linear-fg-muted)' }}>Capacity Utilization</span>
                    <span style={{ fontWeight: 600, color: 'var(--linear-accent)' }}>
                      {(wh.current_utilization_kg || 0).toLocaleString()} / {wh.capacity_kg?.toLocaleString()} kg
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden', height: 7 }}>
                    <div style={{ width: `${Math.min(100, ((wh.current_utilization_kg || 0) / (wh.capacity_kg || 1)) * 100)}%`, background: 'var(--linear-accent)', height: '100%' }} />
                  </div>
                </div>

                {/* Assigned Operator Section */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--linear-border-default)', marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    ASSIGNED WAREHOUSE OPERATOR
                  </div>

                  {wh.assigned_operator_name ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#34D399' }}>
                          👷 {wh.assigned_operator_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>
                          {wh.assigned_operator_email}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setAssignModalHub(wh);
                          setSelectedAssignOperator(wh.assigned_operator_id || '');
                        }}
                        className="linear-btn linear-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem' }}
                      >
                        Reassign
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.72rem' }}>
                        ⚠️ No Operator Assigned
                      </span>
                      <button
                        onClick={() => {
                          setAssignModalHub(wh);
                          setSelectedAssignOperator('');
                        }}
                        className="linear-btn linear-btn-primary"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.74rem' }}
                      >
                        ➕ Assign Operator
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 2: PRODUCE PROCUREMENT MARKETPLACE
         ========================================================================= */}
      {activeTab === 'marketplace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filter Bar */}
          <div className="linear-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <input
                type="text"
                className="linear-input"
                placeholder="🔍 Search produce by name or Batch Tag ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ minWidth: 170 }}>
              <select className="linear-input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 190 }}>
              <select className="linear-input" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
                <option value="All">All Warehouses</option>
                {warehouses.map(w => <option key={w.id || w.code} value={w.code}>{w.name}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 160 }}>
              <select className="linear-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Available">Available Only</option>
                <option value="Sold">Sold Items</option>
              </select>
            </div>
          </div>

          {/* Product Modules Grid */}
          {filteredBatches.length === 0 ? (
            <div className="linear-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔍</span>
              <p style={{ fontWeight: 500 }}>No food inventory items match your current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {filteredBatches.map((b) => {
                const isSold = b.status === 'Sold';
                const today = new Date();
                const expDate = new Date(b.expiry_date);
                const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                
                let badgeClass = 'linear-badge-fresh';
                if (b.freshness_score < 80) badgeClass = 'linear-badge-good';
                if (b.freshness_score < 65) badgeClass = 'linear-badge-warning';
                if (b.freshness_score < 50) badgeClass = 'linear-badge-spoilage';

                return (
                  <div key={b.id || b.batch_id} className="linear-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    
                    {/* Status & FEFO Badges */}
                    <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5, display: 'flex', gap: '5px', alignItems: 'center' }}>
                      {daysLeft <= 5 && !isSold && (
                        <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.65rem' }}>
                          ⚡ FEFO PRIORITY
                        </span>
                      )}
                      {isSold ? (
                        <span className="linear-badge linear-badge-spoilage">
                          🔴 SOLD OUT
                        </span>
                      ) : (
                        <span className="linear-badge linear-badge-fresh">
                          🟢 AVAILABLE
                        </span>
                      )}
                    </div>

                    {/* Product Image Frame */}
                    <div style={{ height: 165, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', position: 'relative', border: '1px solid var(--linear-border-default)' }}>
                      <img
                        src={b.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"}
                        alt={b.product_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(5, 5, 6, 0.85)', color: '#ffffff', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)' }}>
                        📁 {b.category}
                      </div>
                    </div>

                    {/* Product Info */}
                    <div style={{ marginBottom: '0.6rem' }}>
                      <h3 className="linear-text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '3px' }}>{b.product_name}</h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--linear-accent)', fontWeight: 600 }}>
                        Tag: {b.batch_id}
                      </div>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--linear-fg-muted)', marginBottom: '0.8rem', fontWeight: 400 }}>
                      📍 {b.warehouse_name}
                    </p>

                    {/* Metrics Box */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.1rem', background: '#09090C', padding: '12px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Freshness Score</span>
                        <span className={`linear-badge ${badgeClass}`} style={{ fontSize: '0.7rem', marginTop: 3 }}>
                          {b.freshness_score}/100
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Expiry Window</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: daysLeft <= 5 ? '#F87171' : '#34D399' }}>
                          ⏳ {daysLeft > 0 ? `${daysLeft} Days` : 'Expired'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Quantity</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-fg)' }}>{b.quantity_kg} kg</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 500 }}>Wholesale Price</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-accent)' }}>${b.unit_price_per_kg?.toFixed(2)}/kg</span>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid var(--linear-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', display: 'block', fontWeight: 400 }}>Total Batch Value</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                          ${(b.quantity_kg * b.unit_price_per_kg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {isSold ? (
                        <button className="linear-btn linear-btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                          🚫 Already Sold
                        </button>
                      ) : (
                        <button
                          className="linear-btn linear-btn-primary"
                          onClick={() => setBuyModalItem(b)}
                        >
                          🛒 Buy Batch
                        </button>
                      )}
                    </div>

                    {isSold && (
                      <div style={{ marginTop: '0.7rem', fontSize: '0.76rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '8px', color: '#F87171', fontWeight: 500 }}>
                        Purchased by: {b.purchased_by_store || 'Retail Superstore'}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* CREATE WAREHOUSE HUB MODAL */}
      {showCreateHubModal && (
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
        }} onClick={() => setShowCreateHubModal(false)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>🏭 Create Regional Warehouse Hub</h2>
              <button onClick={() => setShowCreateHubModal(false)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            {hubMsg.text && (
              <div style={{
                padding: '0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                background: hubMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid ' + (hubMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                color: hubMsg.type === 'success' ? '#34D399' : '#F87171'
              }}>
                {hubMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateHub} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Hub Name</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. North Harbor Cold Storage Vault"
                  value={hubName}
                  onChange={(e) => handleAutoHubCode(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Unique Hub Code</label>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="e.g. WH-NORTH-04"
                    value={hubCode}
                    onChange={(e) => setHubCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Total Capacity (kg)</label>
                  <input
                    type="number"
                    className="linear-input"
                    value={hubCapacity}
                    onChange={(e) => setHubCapacity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Physical Location / Logistics Zone</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. Terminal 3, North Port Logistics Park"
                  value={hubLocation}
                  onChange={(e) => setHubLocation(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Temperature Range Target</label>
                  <input
                    type="text"
                    className="linear-input"
                    value={hubTempRange}
                    onChange={(e) => setHubTempRange(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Humidity Range Target</label>
                  <input
                    type="text"
                    className="linear-input"
                    value={hubHumRange}
                    onChange={(e) => setHubHumRange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Assign Initial Warehouse Operator (Optional)</label>
                <select
                  className="linear-input"
                  value={selectedInitialOperator}
                  onChange={(e) => setSelectedInitialOperator(e.target.value)}
                >
                  <option value="">-- Assign Later --</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.email}) {op.assigned_warehouse_id ? `[Already on ${op.assigned_warehouse_id}]` : '[Available]'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={creatingHub}
                className="linear-btn linear-btn-primary"
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.4rem' }}
              >
                {creatingHub ? 'Creating Hub on Cloud...' : '✅ Create Warehouse Hub'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ASSIGN OPERATOR MODAL */}
      {assignModalHub && (
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
        }} onClick={() => setAssignModalHub(null)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>👷 Assign Operator to Hub</h2>
              <button onClick={() => setAssignModalHub(null)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            <div style={{ background: '#09090C', padding: '12px', borderRadius: '10px', marginBottom: '1.2rem', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--linear-fg)' }}>{assignModalHub.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--linear-accent)' }}>Code: {assignModalHub.code} • 📍 {assignModalHub.location}</div>
            </div>

            {assignMsg.text && (
              <div style={{
                padding: '0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                background: assignMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid ' + (assignMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                color: assignMsg.type === 'success' ? '#34D399' : '#F87171'
              }}>
                {assignMsg.text}
              </div>
            )}

            <form onSubmit={handleAssignOperator} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Select Registered Warehouse Operator</label>
                {operators.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: '#F87171' }}>No registered Warehouse Operators found in system.</p>
                ) : (
                  <select
                    className="linear-input"
                    value={selectedAssignOperator}
                    onChange={(e) => setSelectedAssignOperator(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Operator --</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.email}) {op.assigned_warehouse_id ? `[Currently: ${op.assigned_warehouse_id}]` : '[Unassigned]'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={assigningOperator || !selectedAssignOperator}
                className="linear-btn linear-btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {assigningOperator ? 'Assigning Operator on Cloud...' : '✅ Confirm Assignment'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* BUY BATCH MODAL */}
      {buyModalItem && (
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
        }} onClick={() => setBuyModalItem(null)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.3rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>🛒 Confirm Retail Batch Purchase</h2>
              <button onClick={() => setBuyModalItem(null)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            {buyError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.8rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 500 }}>
                ⚠️ {buyError}
              </div>
            )}

            <div style={{ background: '#09090C', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px', color: 'var(--linear-fg)' }}>{buyModalItem.product_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--linear-accent)', fontWeight: 600, marginBottom: '8px' }}>
                Batch ID: {buyModalItem.batch_id}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <div>Warehouse: <strong>{buyModalItem.warehouse_name}</strong></div>
                <div>Quantity: <strong>{buyModalItem.quantity_kg} kg</strong></div>
                <div>Freshness: <strong>{buyModalItem.freshness_score}/100</strong></div>
                <div>Total Cost: <strong style={{ color: '#34D399' }}>${(buyModalItem.quantity_kg * buyModalItem.unit_price_per_kg).toFixed(2)}</strong></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.4rem' }}>Purchasing Retail Store Name</label>
              <input
                type="text"
                className="linear-input"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. FreshMart Hypermarket #104"
                required
              />
            </div>

            <button
              onClick={handleConfirmBuy}
              disabled={purchasing}
              className="linear-btn linear-btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem' }}
            >
              {purchasing ? 'Executing Purchase on Cloud...' : '✅ Complete Purchase & Lock Inventory'}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

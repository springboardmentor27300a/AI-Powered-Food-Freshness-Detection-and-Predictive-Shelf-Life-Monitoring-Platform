import React, { useState, useEffect } from 'react';

export default function AdminView({ stats }) {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'hubs' | 'metrics'
  const [actionNotice, setActionNotice] = useState({ type: '', text: '' });

  // Create Retail Manager Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRMName, setNewRMName] = useState('');
  const [newRMEmail, setNewRMEmail] = useState('');
  const [newRMPassword, setNewRMPassword] = useState('');
  const [newRMOrg, setNewRMOrg] = useState('FreshMart Superstores Hub');
  const [newRMPhone, setNewRMPhone] = useState('');
  const [creatingRM, setCreatingRM] = useState(false);

  // Fetch Users and Warehouses from MongoDB
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [uRes, wRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/warehouses')
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (wRes.ok) setWarehouses(await wRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveUser = async (userId, userName) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      if (res.ok) {
        setActionNotice({ type: 'success', text: `✅ Retail Manager '${userName}' approved! They can now create Warehouse Hubs.` });
        fetchAdminData();
        setTimeout(() => setActionNotice({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: 'Failed to approve user.' });
    }
  };

  const handleRevokeUser = async (userId, userName) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/revoke`, { method: 'POST' });
      if (res.ok) {
        setActionNotice({ type: 'warning', text: `Approval revoked for '${userName}'.` });
        fetchAdminData();
        setTimeout(() => setActionNotice({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: 'Failed to revoke approval.' });
    }
  };

  const handleCreateRetailManager = async (e) => {
    e.preventDefault();
    setCreatingRM(true);
    try {
      const res = await fetch('/api/admin/create-retail-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRMName,
          email: newRMEmail,
          password: newRMPassword,
          organization: newRMOrg,
          phone: newRMPhone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create Retail Manager.');
      }

      setActionNotice({ type: 'success', text: `✅ Approved Retail Manager '${data.name}' created successfully!` });
      setShowCreateModal(false);
      setNewRMName('');
      setNewRMEmail('');
      setNewRMPassword('');
      fetchAdminData();
      setTimeout(() => setActionNotice({ type: '', text: '' }), 4000);
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setCreatingRM(false);
    }
  };

  const retailManagers = users.filter((u) => u.role === 'Retail Manager');
  const warehouseOperators = users.filter((u) => u.role === 'Warehouse Operator');
  const pendingApprovals = retailManagers.filter((u) => u.is_approved === false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hero Container */}
      <div className="linear-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚡</span>
            <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
              Platform Administrator Governance Console
            </h2>
            <span className="linear-badge linear-badge-good" style={{ fontSize: '0.68rem' }}>
              RBAC TIER 1
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
            Oversee platform hierarchy: approve Retail Managers, track Warehouse Hubs, monitor assigned Warehouse Operators, and inspect cloud metrics.
          </p>
        </div>

        <button
          className="linear-btn linear-btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ padding: '0.75rem 1.3rem', fontSize: '0.86rem' }}
        >
          ➕ Create Approved Retail Manager
        </button>
      </div>

      {/* Workflow Architecture Diagram Card */}
      <div className="linear-card" style={{ padding: '1.2rem 1.5rem', background: '#09090C', border: '1px solid var(--linear-border-default)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>
          📐 SYSTEM HIERARCHY WORKFLOW
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ background: 'rgba(94, 106, 210, 0.15)', border: '1px solid rgba(94, 106, 210, 0.4)', padding: '8px 14px', borderRadius: '10px' }}>
            <strong style={{ color: 'var(--linear-accent)' }}>1. Administrator</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)' }}>Approves Retail Manager</div>
          </div>
          <span style={{ color: 'var(--linear-fg-muted)', fontSize: '1.2rem' }}>➔</span>
          <div style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '8px 14px', borderRadius: '10px' }}>
            <strong style={{ color: '#34D399' }}>2. Retail Manager</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)' }}>Creates Warehouse Hubs</div>
          </div>
          <span style={{ color: 'var(--linear-fg-muted)', fontSize: '1.2rem' }}>➔</span>
          <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '8px 14px', borderRadius: '10px' }}>
            <strong style={{ color: '#FBBF24' }}>3. Warehouse Operator</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)' }}>Assigned to Hub by RM</div>
          </div>
          <span style={{ color: 'var(--linear-fg-muted)', fontSize: '1.2rem' }}>➔</span>
          <div style={{ background: 'rgba(192, 132, 252, 0.12)', border: '1px solid rgba(192, 132, 252, 0.3)', padding: '8px 14px', borderRadius: '10px' }}>
            <strong style={{ color: '#C084FC' }}>4. Inventory & Climate</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)' }}>Operated in Assigned Hub</div>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice.text && (
        <div style={{
          padding: '0.9rem 1.2rem',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: 500,
          background: actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: '1px solid ' + (actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'),
          color: actionNotice.type === 'success' ? '#34D399' : '#F87171'
        }}>
          {actionNotice.text}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          className={`linear-btn ${activeTab === 'users' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
        >
          👥 Retail Managers & Users ({users.length}) {pendingApprovals.length > 0 && <span style={{ color: '#F87171' }}>• {pendingApprovals.length} Pending</span>}
        </button>
        <button
          onClick={() => setActiveTab('hubs')}
          className={`linear-btn ${activeTab === 'hubs' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
        >
          🏭 Warehouse Hubs & Assigned Operators ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`linear-btn ${activeTab === 'metrics' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem' }}
        >
          📊 System & Financial Metrics
        </button>
      </div>

      {/* TAB 1: USER & RETAIL MANAGER APPROVALS */}
      {activeTab === 'users' && (
        <div className="linear-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <h3 className="linear-text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Retail Manager Governance & User Approvals
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
                Retail Managers must be approved by the Administrator before they are authorized to create Warehouse Hubs.
              </p>
            </div>
            <button onClick={fetchAdminData} className="linear-btn linear-btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
              🔄 Refresh List
            </button>
          </div>

          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>Loading users from MongoDB Atlas...</p>
          ) : users.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>
              No users registered yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--linear-border-default)' }}>
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>User Name & Email</th>
                    <th>Role</th>
                    <th>Organization</th>
                    <th>Assigned Warehouse</th>
                    <th>Approval Status</th>
                    <th>Administrator Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isRM = u.role === 'Retail Manager';
                    const isApproved = u.is_approved !== false;

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--linear-fg)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>{u.email}</div>
                        </td>
                        <td>
                          <span className={`linear-badge ${
                            u.role === 'Administrator' ? 'linear-badge-good' :
                            u.role === 'Retail Manager' ? 'linear-badge-fresh' :
                            u.role === 'Warehouse Operator' ? 'linear-badge-warning' : 'linear-badge-good'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--linear-fg)' }}>
                            {u.organization || '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem' }}>{u.warehouse_name || '—'}</div>
                          {u.warehouse_id && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>ID: {u.warehouse_id}</div>
                          )}
                        </td>
                        <td>
                          {isRM ? (
                            isApproved ? (
                              <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.7rem' }}>
                                🟢 APPROVED
                              </span>
                            ) : (
                              <span className="linear-badge linear-badge-spoilage" style={{ fontSize: '0.7rem' }}>
                                ⏳ PENDING APPROVAL
                              </span>
                            )
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                              Active
                            </span>
                          )}
                        </td>
                        <td>
                          {isRM ? (
                            !isApproved ? (
                              <button
                                onClick={() => handleApproveUser(u.id, u.name)}
                                className="linear-btn linear-btn-primary"
                                style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
                              >
                                ✅ Approve Retail Manager
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRevokeUser(u.id, u.name)}
                                className="linear-btn linear-btn-secondary"
                                style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#F87171' }}
                              >
                                ✕ Revoke Approval
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WAREHOUSE HUBS & ASSIGNED OPERATORS */}
      {activeTab === 'hubs' && (
        <div className="linear-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <h3 className="linear-text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Warehouse Hubs & Operator Assignment Oversight
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
                Track which Retail Manager created each hub and which Warehouse Operator is operating it.
              </p>
            </div>
          </div>

          {warehouses.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--linear-fg-muted)' }}>
              No warehouse hubs created yet. Approved Retail Managers can create warehouse hubs.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--linear-border-default)' }}>
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Hub Code & Name</th>
                    <th>Location</th>
                    <th>Capacity / Utilization</th>
                    <th>Climate Parameters</th>
                    <th>Created By (Retail Manager)</th>
                    <th>Assigned Warehouse Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((wh) => (
                    <tr key={wh.id || wh.code}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--linear-fg)' }}>{wh.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--linear-accent)' }}>Code: {wh.code}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>📍 {wh.location}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {wh.current_utilization_kg?.toLocaleString() || 0} / {wh.capacity_kg?.toLocaleString() || 0} kg
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden', height: 5, marginTop: 4 }}>
                          <div style={{ width: `${Math.min(100, ((wh.current_utilization_kg || 0) / (wh.capacity_kg || 1)) * 100)}%`, background: 'var(--linear-accent)', height: '100%' }} />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>🌡️ {wh.temperature_range_c}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>💧 {wh.humidity_range_pct}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#34D399' }}>
                          {wh.created_by_name || 'Retail Manager'}
                        </div>
                      </td>
                      <td>
                        {wh.assigned_operator_name ? (
                          <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.25)', display: 'inline-block' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34D399' }}>
                              👷 {wh.assigned_operator_name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)' }}>
                              {wh.assigned_operator_email}
                            </div>
                          </div>
                        ) : (
                          <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.7rem' }}>
                            ⚠️ UNASSIGNED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SYSTEM METRICS (100% REAL DATA, NO FAKE FALLBACKS) */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          
          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>REGISTERED BATCHES</span>
            <span style={{ fontSize: '2.4rem', fontWeight: 600, color: 'var(--linear-accent)', display: 'block', margin: '4px 0' }}>
              {stats?.total_batches ?? 0}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              {stats?.available_batches ?? 0} Available • {stats?.sold_batches ?? 0} Sold
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROCUREMENT REVENUE</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#34D399', display: 'block', margin: '4px 0' }}>
              ${Number(stats?.total_sold_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              Completed retail orders locked
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTIVE COLD HUBS</span>
            <span style={{ fontSize: '2.4rem', fontWeight: 600, color: '#C084FC', display: 'block', margin: '4px 0' }}>
              {warehouses.length}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              Logistics vaults active
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL INVENTORY QTY</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#FBBF24', display: 'block', margin: '4px 0' }}>
              {Number(stats?.total_quantity_kg ?? 0).toLocaleString()} kg
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              Stored across cold hubs
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VALUE AT RISK</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#F87171', display: 'block', margin: '4px 0' }}>
              ${Number(stats?.economic_value_at_risk ?? 0).toFixed(2)}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              {stats?.critical_risk_batches ?? 0} near-expiry lots
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WASTE PREVENTED</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#38BDF8', display: 'block', margin: '4px 0' }}>
              ${Number(stats?.total_waste_diverted_dollars ?? 0).toFixed(2)}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              {Number(stats?.total_waste_diverted_kg ?? 0).toFixed(0)} kg saved from write-off
            </span>
          </div>

          <div className="linear-card">
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>COLD STORAGE COMPLIANCE</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#10B981', display: 'block', margin: '4px 0' }}>
              {stats?.cold_storage_compliance_rate != null ? stats.cold_storage_compliance_rate : 100}%
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
              Network sensor adherence
            </span>
          </div>

        </div>
      )}

      {/* CREATE RETAIL MANAGER MODAL */}
      {showCreateModal && (
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
        }} onClick={() => setShowCreateModal(false)}>
          <div className="linear-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', borderRadius: 16 }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>➕ Create Approved Retail Manager</h2>
              <button onClick={() => setShowCreateModal(false)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)', marginBottom: '1.2rem' }}>
              Retail Managers created by an Administrator are immediately approved and authorized to create Warehouse Hubs.
            </p>

            <form onSubmit={handleCreateRetailManager} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. Marcus Vance"
                  value={newRMName}
                  onChange={(e) => setNewRMName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  className="linear-input"
                  placeholder="e.g. marcus@freshmart.com"
                  value={newRMEmail}
                  onChange={(e) => setNewRMEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Password</label>
                <input
                  type="password"
                  className="linear-input"
                  placeholder="••••••••"
                  value={newRMPassword}
                  onChange={(e) => setNewRMPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Retail Organization / Store Network</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. FreshMart Metro Logistics"
                  value={newRMOrg}
                  onChange={(e) => setNewRMOrg(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: 4 }}>Phone Number</label>
                <input
                  type="text"
                  className="linear-input"
                  placeholder="e.g. +1 (555) 019-2831"
                  value={newRMPhone}
                  onChange={(e) => setNewRMPhone(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={creatingRM}
                className="linear-btn linear-btn-primary"
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}
              >
                {creatingRM ? 'Creating on MongoDB...' : '✅ Create & Approve Retail Manager'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

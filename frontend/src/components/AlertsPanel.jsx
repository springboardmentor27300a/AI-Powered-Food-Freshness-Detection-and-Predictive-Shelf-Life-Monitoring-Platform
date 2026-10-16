import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, Loader2, RefreshCw } from 'lucide-react';
import { apiGet, apiPatch, formatDateTime } from '../api';

const severityColor = { critical: '#dc2626', high: '#ea580c', medium: '#a16207', low: '#6b7280' };
const prettyType = (t) => String(t || 'alert').replace(/_/g, ' ');

export default function AlertsPanel({ limit = 8, title = 'Shelf-Life & Inventory Alerts' }) {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet(`/api/alerts?limit=${limit}`);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (alert) => {
    if (alert.is_read) return;
    try {
      await apiPatch(`/api/alerts/${alert._id}`, { is_read: true });
      await load();
    } catch {}
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BellRing size={18} /> {title}
        </h2>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#4b5563' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && <p style={{ color: '#ef4444' }}>Failed to load alerts: {error}</p>}
      {!alerts && !error && (
        <p style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 className="animate-spin" size={16} /> Loading alerts…
        </p>
      )}
      {alerts && alerts.length === 0 && (
        <p style={{ color: '#9ca3af' }}>No alerts recorded yet. Alerts appear here when the system detects risk.</p>
      )}
      {alerts && alerts.length > 0 && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {alerts.map((a) => (
            <div
              key={a._id}
              onClick={() => markRead(a)}
              style={{
                padding: '10px 14px', borderRadius: '12px', cursor: a.is_read ? 'default' : 'pointer',
                backgroundColor: a.is_read ? '#f9fafb' : '#fef2f2',
                borderLeft: `4px solid ${severityColor[a.severity] || '#9ca3af'}`,
                opacity: a.is_read ? 0.65 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: severityColor[a.severity] || '#374151' }}>
                  {prettyType(a.type)}
                </b>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{formatDateTime(a.created_at)}</span>
              </div>
              <span style={{ color: '#374151', fontSize: '0.88rem' }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

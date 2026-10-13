// Notification bell (Milestone 4): unread count + recent notifications,
// backed entirely by the persistent alerts API (no fake notifications).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BellRing, CheckCheck } from 'lucide-react';
import { apiGet, apiPatch, formatDateTime } from '../api';

const severityColor = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#a16207',
  low: '#6b7280',
};

const prettyType = (t) => String(t || 'alert').replace(/_/g, ' ');

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        apiGet('/api/alerts?limit=20'),
        apiGet('/api/alerts/unread-count'),
      ]);
      setAlerts(Array.isArray(list) ? list : []);
      setUnread(count?.unread ?? 0);
    } catch {
      /* silent: bell is non-critical chrome */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const onClickAway = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const markRead = async (alert) => {
    if (alert.is_read) return;
    try {
      await apiPatch(`/api/alerts/${alert._id}`, { is_read: true });
      await load();
    } catch {
      /* ignore */
    }
  };

  const markAllVisible = async () => {
    setLoading(true);
    try {
      const unreadAlerts = alerts.filter((a) => !a.is_read).slice(0, 20);
      await Promise.all(unreadAlerts.map((a) => apiPatch(`/api/alerts/${a._id}`, { is_read: true })));
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', marginBottom: '16px' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{
          width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'transparent', border: '1px solid #333', color: '#a0a0a0',
          padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative',
        }}
      >
        <BellRing size={16} style={{ marginRight: '8px' }} /> Notifications
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: '#fff',
            borderRadius: '999px', minWidth: '20px', height: '20px', fontSize: '0.7rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: '340px', maxHeight: '420px',
          overflowY: 'auto', backgroundColor: '#fff', color: '#111', borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)', zIndex: 1500, padding: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '4px 6px' }}>
            <b>Notifications</b>
            <button
              onClick={markAllVisible}
              disabled={loading || unread === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', cursor: unread === 0 ? 'default' : 'pointer', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem' }}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          {alerts.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              No notifications yet.
            </p>
          )}
          {alerts.map((a) => (
            <div
              key={a._id}
              onClick={() => markRead(a)}
              style={{
                padding: '10px 12px', borderRadius: '12px', marginBottom: '6px', cursor: a.is_read ? 'default' : 'pointer',
                backgroundColor: a.is_read ? '#f9fafb' : '#eef2ff',
                borderLeft: `4px solid ${severityColor[a.severity] || '#9ca3af'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <b style={{ fontSize: '0.78rem', textTransform: 'capitalize', color: severityColor[a.severity] || '#374151' }}>
                  {prettyType(a.type)}
                </b>
                <span style={{ fontSize: '0.68rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '2px' }}>{a.message}</div>
              {!a.is_read && <div style={{ fontSize: '0.68rem', color: '#2563eb', marginTop: '3px' }}>click to mark read</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

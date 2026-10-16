
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Thermometer, Droplets, CheckCircle, Package, Loader2, AlertTriangle } from 'lucide-react';
import { apiGet, riskColor, formatDays, complianceColors, formatDateTime } from '../../api';
import { LineChart } from '../../components/Charts';
import AlertsPanel from '../../components/AlertsPanel';

export default function WarehouseDashboard() {
  const [status, setStatus] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      apiGet('/api/storage/status'),
      apiGet('/api/analytics/storage-compliance'),
      apiGet('/api/recommendations/inventory-overview'),
    ])
      .then(([statusData, complianceData, overviewData]) => {
        setStatus(statusData);
        setCompliance(complianceData);
        setOverview(overviewData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

  if (error) {
    return <div style={{ ...card, color: '#ef4444' }}>Failed to load warehouse data: {error}</div>;
  }
  if (!status || !compliance) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
        <Loader2 className="animate-spin" size={20} /> Loading warehouse telemetry…
      </div>
    );
  }

  const zones = status.zones || [];
  const compliantPct = status.total_zones
    ? Math.round((status.compliance_counts.compliant / status.total_zones) * 100)
    : 0;
  const avgTemp = zones.length ? (zones.reduce((s, z) => s + (z.temperature_c || 0), 0) / zones.length).toFixed(1) : '—';
  const avgHumidity = zones.length ? Math.round(zones.reduce((s, z) => s + (z.humidity_pct || 0), 0) / zones.length) : '—';

  const trendPoints = (compliance.trend || []).map((r, i) => ({
    label: r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`,
    value: r.storage_score,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Warehouse Operations</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>Monitor environmental conditions and storage compliance.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#ef4444' }}>
              <Thermometer size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Avg Temperature</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{avgTemp}°C</div>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Across {zones.length} zones</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#3b82f6' }}>
              <Droplets size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Avg Humidity</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{avgHumidity}%</div>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Across {zones.length} zones</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#16a34a' }}>
              <CheckCircle size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Compliance</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{compliantPct}%</div>
          <p style={{ color: complianceColors[status.compliance_counts.non_compliant > 0 ? 'Non-Compliant' : 'Compliant'], fontSize: '0.9rem', marginTop: '8px', fontWeight: 600 }}>
            {status.compliance_counts.non_compliant > 0
              ? `${status.compliance_counts.non_compliant} zone(s) failing`
              : 'All storage areas passing'}
          </p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#fdf4ff', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#c026d3' }}>
              <Package size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Avg Storage Score</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{compliance.average_storage_score ?? '—'}</div>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Last {compliance.total_readings} readings</p>
        </div>
      </div>

      <AlertsPanel title="Storage & Inventory Alerts" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Environmental Analytics</h2>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9rem' }}>Storage compliance score over recent readings</p>
          <LineChart series={[{ name: 'Score', color: '#16a34a', points: trendPoints }]} yMin={0} yMax={100} />
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Temperature Trend</h2>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9rem' }}>Recorded temperatures, recent readings</p>
          <LineChart series={[{
            name: 'Temperature (°C)',
            color: '#ef4444',
            points: (compliance.trend || []).map((r, i) => ({
              label: r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`,
              value: r.temperature_c,
            })),
          }]} />
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Humidity Trend</h2>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9rem' }}>Recorded humidity, recent readings</p>
          <LineChart series={[{
            name: 'Humidity (%)',
            color: '#3b82f6',
            points: (compliance.trend || []).map((r, i) => ({
              label: r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`,
              value: r.humidity_pct,
            })),
          }]} yMin={0} yMax={100} />
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Zone Snapshot</h2>
          {zones.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No zones recorded yet. Record readings from the Storage Monitoring page.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {zones.map((z) => (
                <div key={z._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{z.zone}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {z.temperature_c}°C · {z.humidity_pct}% · {z.category}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: complianceColors[z.compliance_status] || '#9ca3af' }}>{z.compliance_status}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{formatDateTime(z.recorded_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {overview && overview.items && overview.items.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>Batch Freshness & Storage Impact</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: 0 }}>
            Products whose shelf-life estimate is affected by current storage conditions.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Product', 'Batch', 'Zone', 'Est. Remaining', 'Risk', 'Storage Action'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.items.map((i) => {
                  const storageRec = i.recommendations?.find((r) => r.type === 'storage_fix');
                  return (
                    <tr key={i.item_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{i.item.name}</td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>{i.item.batch_number}</td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>{i.shelf_life.zone || '-'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: riskColor(i.shelf_life.risk_level) }}>
                        {formatDays(i.shelf_life.effective_remaining_days)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: `${riskColor(i.shelf_life.risk_level)}20`, color: riskColor(i.shelf_life.risk_level), fontWeight: 700, fontSize: '0.8rem' }}>
                          {i.shelf_life.risk_level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '0.85rem' }}>
                        {storageRec ? storageRec.action : 'Conditions within range'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {overview.items.some((i) => i.shelf_life.risk_level === 'High' || i.shelf_life.risk_level === 'Critical') && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 600, marginTop: '16px', marginBottom: 0 }}>
              <AlertTriangle size={16} /> Some batches are at high risk - check the Storage Monitoring page for corrective actions.
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

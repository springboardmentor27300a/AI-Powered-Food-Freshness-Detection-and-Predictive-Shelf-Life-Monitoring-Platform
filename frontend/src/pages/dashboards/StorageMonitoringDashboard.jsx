
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer, Droplets, Wind, Lightbulb, Plus, CheckCircle2, AlertTriangle, XCircle, Loader2, Package } from 'lucide-react';
import { apiGet, apiPost, complianceColors, formatDateTime } from '../../api';
import { LineChart } from '../../components/Charts';

const CATEGORIES = [
  'Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry',
  'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages',
];
const CIRCULATION = ['Low', 'Moderate', 'High'];
const LIGHT = ['Dark', 'Dim', 'Bright'];

const statusIcon = (status) => {
  if (status === 'Compliant') return <CheckCircle2 size={16} color="#16a34a" />;
  if (status === 'Non-Compliant') return <XCircle size={16} color="#ef4444" />;
  if (status === 'Partially Compliant') return <AlertTriangle size={16} color="#eab308" />;
  return <AlertTriangle size={16} color="#9ca3af" />;
};

const initialForm = {
  zone: 'Cold Storage Unit 1',
  category: 'Dairy Products',
  temperature_c: 4,
  humidity_pct: 85,
  air_circulation: 'Low',
  light_exposure: 'Dark',
};

export default function StorageMonitoringDashboard() {
  const [overview, setOverview] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [status, analytics, inventory] = await Promise.all([
        apiGet('/api/storage/status'),
        apiGet('/api/analytics/storage-compliance'),
        apiGet('/api/inventory'),
      ]);
      setOverview(status);
      setCompliance(analytics);
      setItems(Array.isArray(inventory) ? inventory : []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'temperature_c' || name === 'humidity_pct' ? parseFloat(value) : value,
    }));
  };

  const submitReading = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/storage/', {
        ...form,
        item_id: form.item_id || null,
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const linkItem = (itemId) => {
    const item = items.find((i) => i._id === itemId);
    setForm((prev) => ({
      ...prev,
      item_id: itemId,
      category: item ? item.category : prev.category,
      zone: (item && item.storage_zone) || prev.zone,
    }));
  };

  const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
  const labelStyle = { color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
  const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

  const trend = compliance?.trend || [];
  const trendPoints = trend.map((r, i) => ({
    label: r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`,
    value: r.storage_score,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Storage Monitoring</h1>
          <p style={{ color: '#666', margin: 0 }}>Temperature, humidity, air circulation and light compliance across zones.</p>
        </div>
        <button className="button" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', color: '#fff' }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> Record Reading
        </button>
      </div>

      {error && <p style={{ color: '#ef4444' }}>Failed to load storage data: {error}</p>}

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={submitReading}
            style={{ ...card, marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', overflow: 'hidden' }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Link to Inventory Item (optional)</label>
              <select name="item_id" value={form.item_id || ''} onChange={(e) => linkItem(e.target.value)} style={inputStyle}>
                <option value="">- Zone reading only -</option>
                {items.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} · Batch {item.batch_number}{item.storage_zone ? ` · ${item.storage_zone}` : ''}
                  </option>
                ))}
              </select>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '4px 0 0' }}>
                Linked readings use the product's category for compliance and generate alerts for breaches.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Zone</label>
              <input name="zone" value={form.zone} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Category Stored</label>
              <select name="category" value={form.category} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Temperature (°C)</label>
              <input name="temperature_c" type="number" step="0.5" value={form.temperature_c} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Humidity (%)</label>
              <input name="humidity_pct" type="number" min="0" max="100" value={form.humidity_pct} onChange={handleChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Air Circulation</label>
              <select name="air_circulation" value={form.air_circulation} onChange={handleChange} style={inputStyle}>
                {CIRCULATION.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Light Exposure</label>
              <select name="light_exposure" value={form.light_exposure} onChange={handleChange} style={inputStyle}>
                {LIGHT.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" disabled={saving} className="button" style={{ backgroundColor: '#000', color: '#fff', width: '100%', display: 'flex', justifyContent: 'center' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Manual Reading'}
              </button>
            </div>
            <p style={{ gridColumn: '1 / -1', color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>
              Readings are recorded as <b>manual entries</b> - no IoT sensors are connected.
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '50%', color: '#16a34a' }}><CheckCircle2 size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Compliant Zones</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{overview ? `${overview.compliance_counts.compliant}/${overview.total_zones}` : '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Passing all recorded checks</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '50%', color: '#2563eb' }}><Thermometer size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Avg Storage Score</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{compliance?.average_storage_score ?? '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Across last {compliance?.total_readings ?? 0} readings</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '50%', color: '#ef4444' }}><AlertTriangle size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Temp Breaches</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{compliance?.breach_counts?.temperature ?? '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Recent history</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '50%', color: '#d97706' }}><Droplets size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Humidity Breaches</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706' }}>{compliance?.breach_counts?.humidity ?? '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Recent history</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '4px' }}>Storage Score Trend</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 12px' }}>Last {trendPoints.length} readings (oldest → newest)</p>
          <LineChart series={[{ name: 'Storage score', color: '#2563eb', points: trendPoints }]} yMin={0} yMax={100} />
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Parameter Breaches</h3>
          {compliance ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { key: 'temperature', icon: <Thermometer size={16} />, label: 'Temperature' },
                { key: 'humidity', icon: <Droplets size={16} />, label: 'Humidity' },
                { key: 'air_circulation', icon: <Wind size={16} />, label: 'Air Circulation' },
                { key: 'light_exposure', icon: <Lightbulb size={16} />, label: 'Light Exposure' },
              ].map(({ key, icon, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#374151' }}>{icon} {label}</span>
                  <span style={{ fontWeight: 800, color: compliance.breach_counts[key] > 0 ? '#ef4444' : '#16a34a' }}>
                    {compliance.breach_counts[key]} breaches
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af' }}>Loading…</p>
          )}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px' }}>Zone Compliance Status</h2>
        {!overview || overview.zones.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No storage readings recorded yet. Add one with “Record Reading”.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '640px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Zone', 'Category', 'Temp', 'Humidity', 'Score', 'Status', 'Source', 'Recorded'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.zones.map((z) => (
                  <tr key={z._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{z.zone}</td>
                    <td style={{ padding: '14px 16px', color: '#4b5563' }}>{z.category}</td>
                    <td style={{ padding: '14px 16px' }}>{z.temperature_c} °C</td>
                    <td style={{ padding: '14px 16px' }}>{z.humidity_pct}%</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>{z.storage_score}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: complianceColors[z.compliance_status] || '#9ca3af' }}>
                        {statusIcon(z.compliance_status)} {z.compliance_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '0.8rem', textTransform: 'capitalize' }}>{z.source || 'manual'}</td>
                    <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(z.recorded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

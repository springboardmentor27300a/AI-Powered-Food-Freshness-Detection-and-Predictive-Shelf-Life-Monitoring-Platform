
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Loader2, PackageSearch } from 'lucide-react';
import { apiPost, riskColor, formatDays, formatDate } from '../../api';

const CATEGORIES = [
  'Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry',
  'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages',
];
const PACKAGING = ['Vacuum Sealed', 'Modified Atmosphere', 'Sealed Container', 'Ventilated', 'Open', 'None'];

const priorityStyles = {
  critical: { bg: '#fee2e2', color: '#b91c1c', label: 'Critical' },
  high: { bg: '#ffedd5', color: '#c2410c', label: 'High' },
  medium: { bg: '#fef9c3', color: '#a16207', label: 'Medium' },
  low: { bg: '#dcfce7', color: '#15803d', label: 'Low' },
  info: { bg: '#f3f4f6', color: '#6b7280', label: 'Info' },
};

const typeLabels = {
  consumption: 'Consumption',
  waste_reduction: 'Waste Reduction',
  rotation: 'Inventory Rotation',
  quality_improvement: 'Quality Improvement',
  storage_fix: 'Storage Optimization',
  data_capture: 'Data Capture',
};

const initialForm = {
  name: 'Whole Milk',
  category: 'Dairy Products',
  quantity: 80,
  quality_score: 78,
  temperature_c: 12,
  humidity_pct: 85,
  packaging_type: 'Sealed Container',
};

export default function RecommendationsDashboard() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: ['quantity', 'quality_score', 'temperature_c', 'humidity_pct'].includes(name)
        ? (value === '' ? null : parseFloat(value))
        : value,
    }));
  };

  const generate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost('/api/recommendations/item', form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
  const labelStyle = { color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
  const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Recommendation Engine</h1>
        <p style={{ color: '#666', margin: 0 }}>
          Consumption guidance, waste-reduction actions, rotation suggestions and storage fixes for any item.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '24px', alignItems: 'start' }}>
        <form onSubmit={generate} style={{ ...card, display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lightbulb size={18} color="#d97706" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Item Details</h3>
          </div>

          <div>
            <label style={labelStyle}>Product Name</label>
            <input name="name" value={form.name} onChange={handleChange} style={inputStyle} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select name="category" value={form.category} onChange={handleChange} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input name="quantity" type="number" min="0" value={form.quantity ?? ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Quality Score (0-100)</label>
            <input name="quality_score" type="number" min="0" max="100" value={form.quality_score ?? ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Temperature (°C)</label>
              <input name="temperature_c" type="number" step="0.5" value={form.temperature_c ?? ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Humidity (%)</label>
              <input name="humidity_pct" type="number" min="0" max="100" value={form.humidity_pct ?? ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Packaging Type</label>
            <select name="packaging_type" value={form.packaging_type} onChange={handleChange} style={inputStyle}>
              {PACKAGING.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px', backgroundColor: loading ? '#e5e7eb' : '#111', color: loading ? '#9ca3af' : '#fff',
              border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '1rem', cursor: loading ? 'wait' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}
          >
            {loading ? <><Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Generating...</> : 'Generate Recommendations'}
          </button>
        </form>

        <div style={{ display: 'grid', gap: '24px' }}>
          {!result ? (
            <div style={{ ...card, padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <PackageSearch size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Describe an item and generate a recommendation to see a prioritized action plan.</p>
            </div>
          ) : (
            <>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800 }}>{result.item.name}</h2>
                    <span style={{ backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', color: '#475569' }}>
                      {result.item.category}{result.item.quantity ? ` · ${result.item.quantity} units` : ''}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: riskColor(result.shelf_life.risk_level) }}>
                      {formatDays(result.shelf_life.effective_remaining_days)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>
                      predicted expiry {formatDate(result.shelf_life.predicted_expiry_date)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Prioritized Action Plan</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {result.recommendations.map((rec, i) => {
                    const p = priorityStyles[rec.priority] || priorityStyles.info;
                    return (
                      <div key={`${rec.type}-${i}`} style={{ display: 'flex', gap: '14px', padding: '14px', backgroundColor: '#f9fafb', borderRadius: '14px', alignItems: 'flex-start' }}>
                        <span style={{ backgroundColor: p.bg, color: p.color, padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {p.label}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: '2px' }}>{rec.title || typeLabels[rec.type] || rec.type}</div>
                          <div style={{ fontSize: '0.92rem', color: '#4b5563' }}>{rec.message || rec.action}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            {typeLabels[rec.type] || rec.type}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={card}>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Storage Assessment</h3>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div>
                    <div style={labelStyle}>Storage Score</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{result.storage_assessment.storage_score}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Compliance</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, paddingTop: '8px' }}>{result.storage_assessment.compliance_status}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {result.storage_assessment.checks.map((check) => (
                    <div key={check.parameter} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '10px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{check.parameter.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 600, color: check.compliant ? '#16a34a' : check.status === 'Critical' ? '#ef4444' : '#d97706' }}>
                        {check.value === null ? 'Not recorded' : `${check.value}${check.unit ? ` ${check.unit}` : ''}`} · {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

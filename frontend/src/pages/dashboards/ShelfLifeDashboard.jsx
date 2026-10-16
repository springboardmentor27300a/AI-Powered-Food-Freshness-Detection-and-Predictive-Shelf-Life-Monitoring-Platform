
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Timer, ShieldAlert, Gauge, Loader2, Sparkles } from 'lucide-react';
import { apiPost, riskColor, formatDays, formatDate } from '../../api';
import { LineChart } from '../../components/Charts';

const CATEGORIES = [
  'Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry',
  'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages',
];
const PACKAGING = ['Vacuum Sealed', 'Modified Atmosphere', 'Sealed Container', 'Ventilated', 'Open', 'None'];

const initialForm = {
  name: 'Organic Bananas',
  category: 'Fruits',
  quantity: 100,
  quality_score: 85,
  temperature_c: 6,
  humidity_pct: 70,
  packaging_type: 'Open',
};

function buildTrend(prediction) {
  const days = Math.max(1, Math.round(prediction.predicted_remaining_days));
  const points = [];
  const steps = Math.min(days, 10);
  for (let i = 0; i <= steps; i += 1) {
    const fraction = i / steps;
    points.push({
      label: `+${Math.round(fraction * days)}d`,
      value: Math.round(prediction.freshness_factor * 100 * (1 - fraction * fraction)),
    });
  }
  return points;
}

export default function ShelfLifeDashboard() {
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

  const runPrediction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost('/api/shelf-life/predict', form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statCard = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
  const labelStyle = { color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
  const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Shelf-Life Estimation</h1>
        <p style={{ color: '#666', margin: 0 }}>
          Parametric Q10 estimate combining product quality, storage temperature, humidity, packaging and elapsed storage time.
          Results are estimates, not guaranteed safe-life dates.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
        <form onSubmit={runPrediction} style={{ ...statCard, display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} color="#65a30d" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Estimation Inputs</h3>
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
            <label style={labelStyle}>Quality Score (from AI inspection, 0-100)</label>
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
            {loading ? <><Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Estimating...</> : 'Estimate Shelf Life'}
          </button>
        </form>

        <div style={{ display: 'grid', gap: '24px' }}>
          {!result ? (
            <div style={{ ...statCard, padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <Timer size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Enter product details and run an estimate to see remaining shelf life, expiry forecast, and risk level.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
                <div style={statCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
                    <div style={{ backgroundColor: '#ecfccb', padding: '10px', borderRadius: '50%', color: '#65a30d' }}><Timer size={20} /></div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Estimated Remaining Shelf Life</h3>
                  </div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: riskColor(result.risk_level) }}>
                    {formatDays(result.effective_remaining_days)}
                  </div>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>
                    {result.effective_remaining_days} d effective · confidence {result.prediction_confidence}%
                  </p>
                  {result.storage_duration_days != null && (
                    <p style={{ color: '#888', fontSize: '0.8rem', margin: '4px 0 0' }}>
                      total estimate {result.estimated_total_life_days} d − stored {result.storage_duration_days} d
                    </p>
                  )}
                </div>

                <div style={statCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
                    <div style={{ backgroundColor: '#f0f4ff', padding: '10px', borderRadius: '50%', color: '#2563eb' }}><CalendarClock size={20} /></div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Estimated Expiry</h3>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{formatDate(result.predicted_expiry_date)}</div>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>
                    Label expiry: {formatDate(result.label_expiry_date)}
                  </p>
                </div>

                <div style={statCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
                    <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '50%', color: '#d97706' }}><ShieldAlert size={20} /></div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Risk Level</h3>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: riskColor(result.risk_level) }}>{result.risk_level}</div>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>
                    Base {result.base_shelf_life_days} d · {result.packaging_type}
                  </p>
                </div>

                <div style={statCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
                    <div style={{ backgroundColor: '#fdf4ff', padding: '10px', borderRadius: '50%', color: '#c026d3' }}><Gauge size={20} /></div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Model Factors</h3>
                  </div>
                  <div style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
                    <div>Temp ×{result.temperature_factor}</div>
                    <div>Humidity −{Math.round(result.humidity_penalty * 100)}%</div>
                    <div>Freshness ×{result.freshness_factor}</div>
                    {result.storage_regime && <div>Regime: {String(result.storage_regime).replace(/_/g, ' ')}</div>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                <div style={statCard}>
                  <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Estimated Freshness Trend</h3>
                  <LineChart
                    series={[{ name: 'Freshness', color: riskColor(result.risk_level), points: buildTrend(result) }]}
                    yMin={0}
                    yMax={100}
                    unit="%"
                  />
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '8px 0 0' }}>
                    Illustrative decay curve, not measured data.
                  </p>
                </div>

                <div style={statCard}>
                  <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Prediction Breakdown</h3>
                  <div style={{ fontSize: '0.95rem' }}>
                    {[
                      ['Model', result.model],
                      ['Category', result.category],
                      ['Source type', result.source_type],
                      ['Guidance source', result.guidance_source],
                      ['Reference temp', `${result.reference_temperature_c} °C`],
                      ['Storage temp', result.temperature_c !== null && result.temperature_c !== undefined ? `${result.temperature_c} °C` : 'Not recorded'],
                      ['Humidity', result.humidity_pct !== null && result.humidity_pct !== undefined ? `${result.humidity_pct}%` : 'Not recorded'],
                      ['Packaging factor', `×${result.packaging_factor}`],
                      ['Storage duration applied', result.duration_applied ? `Yes (${result.storage_duration_days} d subtracted)` : 'No storage timestamp provided'],
                      [                      'Prediction confidence', `${result.prediction_confidence}%`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280' }}>{k}</span>
                        <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ ...statCard, backgroundColor: '#fffbeb' }}>
                  <h3 style={{ fontSize: '1.05rem', marginTop: 0, marginBottom: '10px' }}>About This Estimate</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0 0 8px' }}>{result.estimate_disclaimer}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0 0 8px' }}>
                    <b>Prediction Confidence:</b> {result.confidence_explanation}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>
                    <b>Model quality metrics:</b> {result.metrics_note?.note}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

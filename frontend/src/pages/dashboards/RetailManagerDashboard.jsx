// Retail analytics dashboard: business-level inventory quality and waste-risk monitoring.
// Data comes from GET /api/recommendations/inventory-overview (real inventory records).
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, PackageMinus, AlertOctagon, Loader2, Tag, Recycle,
  ArrowUpNarrowWide, XCircle,
} from 'lucide-react';
import { apiGet, riskColor, formatDays } from '../../api';
import { BarChart, DonutChart } from '../../components/Charts';
import AlertsPanel from '../../components/AlertsPanel';

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

export default function RetailManagerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // GET is the canonical contract (POST also supported server-side; see routes/recommendations.py)
    apiGet('/api/recommendations/inventory-overview')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div style={{ ...card, color: '#ef4444' }}>
        Failed to load retail analytics: {error}
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
          Make sure the backend is running and you are logged in with a staff role.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
        <Loader2 className="animate-spin" size={20} /> Loading retail analytics…
      </div>
    );
  }

  const items = data.items || [];
  const urgent = items.filter((i) => i.shelf_life.risk_level === 'High' || i.shelf_life.risk_level === 'Critical');
  const markdownCandidates = items.filter(
    (i) => i.shelf_life.effective_remaining_days > 0 && i.shelf_life.effective_remaining_days <= 3,
  );
  const rotationNeeded = items.filter(
    (i) => i.recommendations?.some((rec) => rec.type === 'rotation' && rec.priority !== 'low'),
  );
  const fresh = items.filter((i) => i.shelf_life.risk_level === 'Low').length;
  const spoiled = items.filter((i) => i.ml_status === 'Rotten' || i.shelf_life.effective_remaining_days <= 0).length;

  const riskDonut = ['Low', 'Medium', 'High', 'Critical'].map((level) => ({
    label: level,
    value: items.filter((i) => i.shelf_life.risk_level === level).length,
    color: riskColor(level),
  }));

  const qualityByCategory = Object.entries(
    items.reduce((acc, i) => {
      const cat = i.item.category || 'Unknown';
      acc[cat] = acc[cat] || { total: 0, count: 0 };
      acc[cat].total += i.shelf_life.effective_remaining_days;
      acc[cat].count += 1;
      return acc;
    }, {}),
  ).map(([cat, v]) => ({ label: cat, value: Math.round(v.total / v.count) }))
    .sort((a, b) => a.value - b.value);

  const metric = (icon, label, value, sub, color = '#111') => (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ backgroundColor: `${color}15`, padding: '12px', borderRadius: '50%', marginRight: '16px', color }}>{icon}</div>
        <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{label}</h3>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
      <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px', marginBottom: 0 }}>{sub}</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Retail Analytics</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>
        Monitor product freshness and optimize store inventory. Derived from {data.total_items} registered products.
      </p>

      {data.total_items === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '48px' }}>
          <PackageMinus size={48} style={{ opacity: 0.4, marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No products registered yet.</h3>
          <p style={{ margin: 0 }}>Register products in the Inventory section to see retail analytics.</p>
        </div>
      ) : (
        <>
          {/* Shelf-life alerts panel (spec: Retail Manager requires shelf-life alerts) */}
          <AlertsPanel title="Shelf-Life & Inventory Alerts" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            {metric(<TrendingUp size={22} />, 'Total Inventory', `${data.total_units} units`, `${data.total_items} batches`, '#2563eb')}
            {metric(<TrendingUp size={22} />, 'Fresh / Low Risk', fresh, 'Batches with low risk', '#16a34a')}
            {metric(<AlertOctagon size={22} />, 'Urgent Batches', urgent.length, 'High or critical risk', '#ef4444')}
            {metric(<XCircle size={22} />, 'Spoiled / Expired', spoiled, 'Rotten or past expiry', '#b91c1c')}
            {metric(<PackageMinus size={22} />, 'Waste-Risk Units', data.estimated_waste_units, 'Units with <= 2 days remaining', '#d97706')}
            {metric(<Tag size={22} />, 'Markdown Candidates', markdownCandidates.length, 'Batches with <= 3 days remaining', '#7c3aed')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div style={card}>
              <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '4px' }}>Shelf-Life Risk Distribution</h3>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 12px' }}>Active batches by risk level</p>
              <DonutChart data={riskDonut} centerValue={items.length} centerLabel="batches" />
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '4px' }}>Avg Estimated Remaining Life by Category</h3>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 12px' }}>Parametric estimates from current storage conditions</p>
              <BarChart data={qualityByCategory} unit=" d" />
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Recycle size={18} /> Waste Reduction Insights
              </h3>
              {markdownCandidates.length === 0 ? (
                <p style={{ color: '#9ca3af' }}>No markdown candidates right now.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {markdownCandidates.map((i) => (
                    <div key={i.item_id} style={{ padding: '10px 14px', backgroundColor: '#fef9c3', borderRadius: '12px' }}>
                      <b>{i.item.name}</b> (Batch {i.item.batch_number}) — {formatDays(i.shelf_life.effective_remaining_days)} left ·
                      {' '}{i.item.quantity} units. Discount or donate today.
                    </div>
                  ))}
                </div>
              )}
              <h3 style={{ fontSize: '1.1rem', margin: '20px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpNarrowWide size={18} /> Rotation Needed
              </h3>
              {rotationNeeded.length === 0 ? (
                <p style={{ color: '#9ca3af' }}>Rotation is up to date.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {rotationNeeded.map((i) => (
                    <div key={i.item_id} style={{ padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                      <b>{i.item.name}</b> — {i.recommendations.find((rec) => rec.type === 'rotation')?.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product/batch quality table */}
          <div style={card}>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px' }}>Product / Batch Quality</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Product', 'Batch', 'Qty', 'Quality', 'AI Status', 'Est. Remaining', 'Risk', 'Storage Temp', 'Action'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.item_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{i.item.name}</td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>{i.item.batch_number}</td>
                      <td style={{ padding: '12px 16px' }}>{i.item.quantity ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{i.shelf_life.freshness_factor != null ? `${Math.round(i.shelf_life.freshness_factor * 100)}/100` : 'Not scanned'}</td>
                      <td style={{ padding: '12px 16px' }}>{i.shelf_life.ml_status || 'Unknown'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: riskColor(i.shelf_life.risk_level) }}>
                        {formatDays(i.shelf_life.effective_remaining_days)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: `${riskColor(i.shelf_life.risk_level)}20`, color: riskColor(i.shelf_life.risk_level), fontWeight: 700, fontSize: '0.8rem' }}>
                          {i.shelf_life.risk_level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{i.shelf_life.temperature_c != null ? `${i.shelf_life.temperature_c} °C` : 'Not recorded'}</td>
                      <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: '0.85rem' }}>
                        {i.recommendations[0]?.title}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

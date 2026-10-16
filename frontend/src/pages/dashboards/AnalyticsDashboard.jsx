
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Boxes, AlertOctagon, Activity, Loader2, TrendingDown, Clock } from 'lucide-react';
import { apiGet, riskColor, formatDays, formatDate } from '../../api';
import { BarChart, DonutChart } from '../../components/Charts';

const riskTone = {
  Low: { bg: '#dcfce7', color: '#15803d' },
  Medium: { bg: '#fef9c3', color: '#a16207' },
  High: { bg: '#ffedd5', color: '#c2410c' },
  Critical: { bg: '#fee2e2', color: '#b91c1c' },
};

const categoryColorPalette = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#db2777', '#65a30d'];

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [scans, setScans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([apiGet('/api/analytics/freshness'), apiGet('/api/analytics/scans')])
      .then(([freshness, scanStats]) => {
        setData(freshness);
        setScans(scanStats);
      })
      .catch((err) => setError(err.message));
  }, []);

  const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

  if (error) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#ef4444' }}>
        <p style={{ margin: 0 }}>Failed to load analytics: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#6b7280' }}>
        <Loader2 className="animate-spin" size={20} /> Loading analytics…
      </div>
    );
  }

  const riskDonut = ['Low', 'Medium', 'High', 'Critical'].map((level) => ({
    label: level,
    value: data.risk_counts[level] || 0,
    color: riskColor(level),
  }));

  const categoryBars = Object.entries(data.category_breakdown)
    .map(([cat, stats], i) => ({
      label: cat,
      value: stats.avg_remaining_days,
      color: categoryColorPalette[i % categoryColorPalette.length],
    }))
    .sort((a, b) => a.value - b.value);

  const urgent = data.items.filter((i) => ['High', 'Critical'].includes(i.shelf_life.risk_level));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Freshness Analytics</h1>
        <p style={{ color: '#666', margin: 0 }}>
          Inventory-wide shelf-life risk, category health, and AI inspection insights.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#f0f4ff', padding: '10px', borderRadius: '50%', color: '#2563eb' }}><Boxes size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Tracked Items</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{data.total_items}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>{data.total_units} units total</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '50%', color: '#ef4444' }}><AlertOctagon size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Urgent Batches</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{urgent.length}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>High or critical risk</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#ecfccb', padding: '10px', borderRadius: '50%', color: '#65a30d' }}><TrendingDown size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Avg Remaining Life</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {formatDays(
              data.items.length
                ? data.items.reduce((s, i) => s + i.shelf_life.effective_remaining_days, 0) / data.items.length
                : 0,
            )}
          </div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>Across all tracked items</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
            <div style={{ backgroundColor: '#fdf4ff', padding: '10px', borderRadius: '50%', color: '#c026d3' }}><Activity size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>AI Spoilage Rate</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{scans ? `${scans.spoilage_rate_pct}%` : '—'}</div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '6px 0 0' }}>
            {scans ? `${scans.rotten_scans} rotten of ${scans.total_scans} scans` : 'No scans yet'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Shelf-Life Risk Distribution</h3>
          <DonutChart data={riskDonut} centerValue={data.total_items} centerLabel="items" />
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>Avg Remaining Days by Category</h3>
          <BarChart data={categoryBars} unit=" d" />
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Priority Watchlist</h2>
          <Clock size={18} color="#9ca3af" />
        </div>
        {urgent.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No urgent batches — inventory risk is under control.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '640px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Product', 'Category', 'Batch', 'Remaining', 'Forecast Expiry', 'Risk'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {urgent.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '13px 16px', color: '#4b5563' }}>{item.category}</td>
                    <td style={{ padding: '13px 16px', color: '#4b5563' }}>{item.batch_number}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 700, color: riskColor(item.shelf_life.risk_level) }}>
                      {formatDays(item.shelf_life.effective_remaining_days)}
                    </td>
                    <td style={{ padding: '13px 16px', color: '#4b5563' }}>{formatDate(item.shelf_life.predicted_expiry_date)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        backgroundColor: riskTone[item.shelf_life.risk_level].bg,
                        color: riskTone[item.shelf_life.risk_level].color,
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                      }}>
                        {item.shelf_life.risk_level}
                      </span>
                    </td>
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

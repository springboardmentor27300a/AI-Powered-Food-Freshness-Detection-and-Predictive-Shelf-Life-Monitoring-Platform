import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Boxes, AlertOctagon, Recycle, ShieldCheck, Gauge, Timer, Loader2, TrendingUp,
} from 'lucide-react';
import { apiGet, riskColor } from '../../api';
import { LineChart, BarChart, DonutChart } from '../../components/Charts';

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

const kpi = (icon, label, value, sub, color = '#111') => (
  <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
      <div style={{ backgroundColor: `${color}15`, padding: '10px', borderRadius: '50%', color }}>{icon}</div>
      <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{label}</h3>
    </div>
    <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{value}</div>
    <p style={{ color: '#888', fontSize: '0.8rem', margin: '4px 0 0' }}>{sub}</p>
  </div>
);

const pct = (v) => (v === null || v === undefined ? 'N/A' : `${v}%`);
const num = (v) => (v === null || v === undefined ? 'N/A' : v);

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/api/executive/executive').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div style={{ ...card, color: '#ef4444' }}>Failed to load executive analytics: {error}</div>;
  }
  if (!data) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
        <Loader2 className="animate-spin" size={20} /> Loading executive analytics…
      </div>
    );
  }

  const k = data.kpis || {};
  const s = data.series || {};
  const toPoints = (arr) => (s.labels || []).map((lab, i) => ({ label: lab.slice(5), value: arr?.[i] }));
  const hasAny = (arr) => (arr || []).some((v) => v !== null && v !== undefined && v !== 0);

  const riskDonut = ['Low', 'Medium', 'High', 'Critical'].map((level) => ({
    label: level,
    value: k.risk_counts?.[level] || 0,
    color: riskColor(level),
  }));

  const categoryBars = (data.category_analytics || []).map((c) => ({
    label: `${c.category} (${c.items})`,
    value: c.avg_remaining_days,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Executive Analytics</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Cross-module platform intelligence, computed from {data.kpis?.total_active_items ?? 0} active items,
        {' '}{data.total_alerts} alerts and {data.total_reports} reports in the database.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {kpi(<Boxes size={22} />, 'Active Inventory', num(k.total_active_items), `${num(k.total_active_units)} units`, '#2563eb')}
        {kpi(<TrendingUp size={22} />, 'Fresh Inventory', pct(k.fresh_pct), 'Low-risk share of active items', '#16a34a')}
        {kpi(<AlertOctagon size={22} />, 'At-Risk Inventory', pct(k.at_risk_pct), 'High + critical risk share', '#ef4444')}
        {kpi(<AlertOctagon size={22} />, 'Spoilage Rate', pct(k.spoilage_pct), 'Rotten share of AI scans', '#b91c1c')}
        {kpi(<Recycle size={22} />, 'Waste Units', num(k.waste_units), 'Units disposed (lifetime)', '#d97706')}
        {kpi(<ShieldCheck size={22} />, 'Storage Compliance', pct(k.storage_compliance_pct), 'Compliant zones', '#0d9488')}
        {kpi(<Gauge size={22} />, 'Avg Quality Score', num(k.avg_quality_score), 'Across AI scans', '#7c3aed')}
        {kpi(<Timer size={22} />, 'Avg Remaining Shelf-Life', num(k.avg_remaining_shelf_life_days), 'Days, active inventory', '#0891b2')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Active Inventory Risk Distribution</h3>
          <DonutChart data={riskDonut} centerValue={k.total_active_items} centerLabel="items" />
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Avg Remaining Shelf-Life by Category</h3>
          {categoryBars.length === 0
            ? <p style={{ color: '#9ca3af' }}>No active inventory recorded yet.</p>
            : <BarChart data={categoryBars} unit=" d" />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Scan Activity (14 days)</h3>
          {hasAny(s.scans_fresh) || hasAny(s.scans_rotten) ? (
            <LineChart series={[
              { name: 'Fresh', color: '#16a34a', points: toPoints(s.scans_fresh) },
              { name: 'Rotten', color: '#ef4444', points: toPoints(s.scans_rotten) },
            ]} yMin={0} />
          ) : <p style={{ color: '#9ca3af' }}>No scans in the last 14 days.</p>}
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Waste & Sales Flow (14 days)</h3>
          {hasAny(s.disposal_units) || hasAny(s.sold_units_series) ? (
            <LineChart series={[
              { name: 'Disposed units', color: '#ef4444', points: toPoints(s.disposal_units) },
              { name: 'Sold units', color: '#16a34a', points: toPoints(s.sold_units_series) },
            ]} yMin={0} />
          ) : <p style={{ color: '#9ca3af' }}>No disposals or sales in the last 14 days.</p>}
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Storage Score Trend (14 days)</h3>
          {hasAny(s.avg_storage_score) ? (
            <LineChart series={[
              { name: 'Avg storage score', color: '#2563eb', points: toPoints(s.avg_storage_score) },
            ]} yMin={0} yMax={100} />
          ) : <p style={{ color: '#9ca3af' }}>No storage readings in the last 14 days.</p>}
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Product Registrations (14 days)</h3>
          {hasAny(s.registrations) ? (
            <LineChart series={[
              { name: 'Registrations', color: '#7c3aed', points: toPoints(s.registrations) },
            ]} yMin={0} />
          ) : <p style={{ color: '#9ca3af' }}>No registrations in the last 14 days.</p>}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Lifecycle Status Distribution (all items)</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(data.lifecycle_counts || {}).map(([status, count]) => (
            <div key={status} style={{ backgroundColor: '#f9fafb', borderRadius: '14px', padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{count}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', textTransform: 'capitalize' }}>{status}</div>
            </div>
          ))}
          {Object.keys(data.lifecycle_counts || {}).length === 0 && (
            <p style={{ color: '#9ca3af' }}>No inventory recorded yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

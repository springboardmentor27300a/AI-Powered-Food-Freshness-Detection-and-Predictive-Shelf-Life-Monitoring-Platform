
import React from 'react';

// LineChart: multi-series time series with hover values.
// series: [{ name, color, points: [{ label, value }] }]
export function LineChart({ series, height = 220, yMin, yMax, unit = '' }) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No data recorded yet
      </div>
    );
  }

  const width = 600;
  const pad = { top: 16, right: 16, bottom: 28, left: 44 };
  const labels = allPoints.map((p) => p.label);
  const values = allPoints.map((p) => p.value).filter((v) => v !== null && v !== undefined);
  const lo = yMin !== undefined ? yMin : Math.min(...values);
  const hi = yMax !== undefined ? yMax : Math.max(...values);
  const span = hi - lo || 1;

  const x = (i) => pad.left + (i * (width - pad.left - pad.right)) / Math.max(labels.length - 1, 1);
  const y = (v) => pad.top + (1 - (v - lo) / span) * (height - pad.top - pad.bottom);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {gridLines.map((g) => {
        const gy = pad.top + g * (height - pad.top - pad.bottom);
        const gv = hi - g * span;
        return (
          <g key={g}>
            <line x1={pad.left} y1={gy} x2={width - pad.right} y2={gy} stroke="#e5e7eb" strokeWidth="1" />
            <text x={pad.left - 6} y={gy + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {Math.round(gv * 10) / 10}{unit}
            </text>
          </g>
        );
      })}
      {series.map((s) => {
        const pts = s.points
          .map((p, i) => (p.value === null || p.value === undefined ? null : `${x(i)},${y(p.value)}`))
          .filter(Boolean);
        if (pts.length === 0) return null;
        return (
          <polyline
            key={s.name}
            points={pts.join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {labels.map((label, i) => {
        if (labels.length > 8 && i % Math.ceil(labels.length / 8) !== 0) return null;
        return (
          <text key={`${label}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// BarChart: horizontal bars for category comparisons.
// data: [{ label, value, color }]
export function BarChart({ data, max, unit = '' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No data recorded yet
      </div>
    );
  }
  const peak = max !== undefined ? max : Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>{d.label}</span>
            <span style={{ color: '#6b7280' }}>{d.value}{unit}</span>
          </div>
          <div style={{ backgroundColor: '#f3f4f6', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(2, (d.value / peak) * 100)}%`,
                backgroundColor: d.color || '#2563eb',
                height: '100%',
                borderRadius: '5px',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// DonutChart: distribution of a whole.
// data: [{ label, value, color }]
export function DonutChart({ data, size = 170, centerLabel, centerValue }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;

  const segments = data
    .filter((d) => d.value > 0)
    .reduce((acc, d) => {
      const fraction = d.value / total;
      const start = acc.length > 0 ? acc[acc.length - 1].offsetEnd : 0;
      acc.push({ ...d, dash: fraction * circumference, offset: start, offsetEnd: start + fraction * circumference });
      return acc;
    }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth="18" />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        {centerValue !== undefined && (
          <>
            <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="26" fontWeight="800" fill="#111">
              {centerValue}
            </text>
            <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fontSize="11" fill="#9ca3af">
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <div>
        {data.map((d) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: d.color, marginRight: '8px', display: 'inline-block' }} />
            <span style={{ color: '#374151', fontWeight: 600, marginRight: '8px' }}>{d.label}</span>
            <span style={{ color: '#6b7280' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

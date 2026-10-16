import React from "react";

// Dependency-free SVG charts (no chart library needed).

export function Donut({ parts, label = "", size = 150 }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" role="img" aria-label={`${label}: ${total}`}>
      <circle cx="75" cy="75" r={r} fill="none" stroke="#eef2f0" strokeWidth="22" />
      {total > 0 &&
        parts.map((p) => {
          if (p.value <= 0) return null;
          const len = (p.value / total) * C;
          const el = (
            <circle
              key={p.label}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="22"
              strokeDasharray={`${Math.max(len - (parts.filter((x) => x.value > 0).length > 1 ? 2 : 0), 0)} ${C}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 75 75)"
            />
          );
          offset += len;
          return el;
        })}
      <text x="75" y="73" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1f2937">
        {total}
      </text>
      <text x="75" y="91" textAnchor="middle" fontSize="11" fill="#6b7280">
        {label}
      </text>
    </svg>
  );
}

export function Legend({ parts, vertical = false }) {
  return (
    <div className={`flex ${vertical ? "flex-col gap-2" : "flex-wrap gap-x-4 gap-y-1"} text-xs text-gray-600`}>
      {parts.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.label} {p.value}
        </span>
      ))}
    </div>
  );
}

export function HBars({ rows, max = 100, labelWidth = "w-28" }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-xs">
          <div className={`${labelWidth} shrink-0 text-gray-700 truncate`} title={r.label}>{r.label}</div>
          <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (r.value / (max || 1)) * 100)}%`, background: r.color }}
            />
          </div>
          <div className="w-9 text-right font-bold text-gray-800">{r.display ?? r.value}</div>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data, color = "#16a34a", height = 170 }) {
  const w = 520;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = w / data.length;
  const bw = Math.min(54, step * 0.62);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 56);
        const x = i * step + (step - bw) / 2;
        const y = height - 28 - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx="6" fill={d.color || color} />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2937">
              {d.value}
            </text>
            <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#6b7280">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// points: [{ label, value }], optional band [low, high] for the recommended range.
export function LineChart({ points, color = "#dc2626", unit = "", band = null, height = 200 }) {
  const w = 640;
  const pad = { l: 44, r: 16, t: 14, b: 30 };
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals, band ? band[0] : Infinity);
  let hi = Math.max(...vals, band ? band[1] : -Infinity);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.1;
  hi += span * 0.1;
  const x = (i) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i * (w - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const labelEvery = Math.ceil(points.length / 7);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={`Trend chart (${unit})`}>
      {band && (
        <rect
          x={pad.l}
          y={y(band[1])}
          width={w - pad.l - pad.r}
          height={Math.max(y(band[0]) - y(band[1]), 1)}
          fill="#dcfce7"
          opacity="0.7"
        />
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f0" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill={color} />
          {i % labelEvery === 0 && (
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

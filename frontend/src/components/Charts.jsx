/**
 * Lightweight SVG chart primitives (no chart-library dependency).
 *   ScoreRing  - circular 0-100 gauge
 *   BarChart   - horizontal bars with labels + values
 *   HBar       - single value bar (compliance/percentage)
 *   LineChart  - multi-series line/area trend chart with X labels
 *   DonutChart - segments distribution (freshness/risk)
 */
import { getFreshnessTone } from '../utils/helpers'

/** Circular gauge: value 0-100, color by tone. */
export function ScoreRing({ value = 0, size = 108, stroke = 9, label = '', sub = '' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const norm = Math.max(0, Math.min(100, Number(value) || 0))
  const color = statusColor(norm)
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(norm / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="score-ring-center">
        <strong style={{ color }}>{Math.round(norm)}</strong>
        {label && <small>{label}</small>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}

export function statusColor(value) {
  return value >= 80 ? 'var(--green-600)' : value >= 60 ? '#0ea5e9' : value >= 40 ? 'var(--amber-600)' : 'var(--red-600)'
}

/** Horizontal bar list: [{label, value(0-100), note?}] */
export function HBar({ label, value, note, tone }) {
  const color = tone || statusColor(value)
  return (
    <div className="hbar">
      <div className="hbar-meta">
        <span className="hbar-label">{label}</span>
        <span className="hbar-value" style={{ color }}>{note ?? `${Math.round(value)}`}</span>
      </div>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  )
}

/** Horizontal bar chart: items = [{label, value(0-100), hint?}] */
export function BarChart({ items }) {
  return (
    <div className="barchart">
      {items.map((it) => (
        <HBar key={it.label} label={it.label} value={it.value} note={it.hint} />
      ))}
    </div>
  )
}

/** Simple donut chart: items = [{label, value, color?}] */
export function DonutChart({ items, size = 150, stroke = 22, centerLabel = '' }) {
  const total = Math.max(1, items.reduce((s, i) => s + i.value, 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth={stroke} />
          {items.map((it, i) => {
            const frac = it.value / total
            const seg = (
              <circle
                key={it.label + i}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={it.color || `hsl(${(i * 137) % 360} 60% 45%)`}
                strokeWidth={stroke} strokeLinecap="butt"
                strokeDasharray={`${Math.max(0, frac * c - 1.5)} ${c}`}
                transform={`rotate(${(offset / total) * 360 - 90} ${size / 2} ${size / 2})`}
              />
            )
            offset += frac
            return seg
          })}
        </svg>
        {centerLabel && (
          <div className="donut-center"><strong>{total}</strong><small>{centerLabel}</small></div>
        )}
      </div>
      <ul className="donut-legend">
        {items.map((it) => (
          <li key={it.label}>
            <span className="legend-swatch" style={{ background: it.color || '#94a3b8' }} />
            <span className="legend-label">{it.label}</span>
            <span className="legend-value">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Multi-series line/area chart. series = [{name, color, points:[{date, value}]}] */
export function LineChart({ series, height = 200, valueTicks = 4 }) {
  const width = 680
  const padL = 44
  const padR = 12
  const padT = 14
  const padB = 26

  // Collect all points for scaling.
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return <div className="empty-inline">No trend data recorded yet.</div>
  const xs = [...new Set(all.map((p) => p.date))].sort()
  const maxV = Math.max(1, ...all.map((p) => Number(p.value) || 0))
  const maxTick = Math.ceil(maxV / 5) * 5
  const stepX = (width - padL - padR) / Math.max(1, xs.length - 1)

  const x = (date) => {
    const i = xs.indexOf(date)
    return padL + i * stepX
  }
  const y = (v) => padT + (height - padT - padB) * (1 - (Number(v) || 0) / maxTick)

  const ticks = Array.from({ length: valueTicks + 1 }, (_, i) => (maxTick / valueTicks) * i).reverse()

  return (
    <svg className="linechart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {/* grid + y labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--ink-100)" strokeDasharray="3 3" />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(t)}</text>
        </g>
      ))}
      {/* x labels (thin out when many points) */}
      {xs.map((d, i) => {
        const show = xs.length <= 12 || i % Math.ceil(xs.length / 8) === 0
        if (!show) return null
        const [, m, day] = d.split('-')
        return (
          <text key={d} x={x(d)} y={height - 8} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
            {day}/{m}
          </text>
        )
      })}
      {/* area + line per series */}
      {series.map((s) => {
        const pts = s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')
        return (
          <g key={s.name}>
            <polyline
              points={`${padL},${y(0)} ${pts} ${x(xs[xs.length - 1])},${y(0)}`}
              fill={s.color} opacity="0.10"
            />
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" />
            {s.points.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="2.6" fill={s.color} />
            ))}
          </g>
        )
      })}
      {series.length > 1 && (
        <g>
          {series.map((s) => (
            <g key={`legend-${s.name}`}>
              <rect x={padL} y={padT - 12} width="0" height="0" fill={s.color} />
              <line x1={padL} x2={padL} y1={0} y2={0} stroke={s.color} />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

/** Small colored badge for the application overall-score status. */
export function StatusPill({ status }) {
  const tone = getFreshnessTone(status)
  return <span className={`badge badge-${tone}`}>{status}</span>
}
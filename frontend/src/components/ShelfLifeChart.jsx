import React from "react";

// A small, dependency-free line/point chart for remaining shelf-life
// days over time. Plain inline SVG - no charting library needed.
//
// `points` is an array of { date: string|Date, days: number } in
// chronological order. With fewer than 2 points, the caller should
// show the "insufficient historical data" message instead of
// rendering this chart (see FreshnessAnalysis.jsx).
export default function ShelfLifeChart({ points }) {
  if (!points || points.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxDays = Math.max(...points.map((p) => p.days), 1);
  const yMax = Math.ceil((maxDays + 1) / 5) * 5; // round up to a clean gridline

  const xFor = (index) =>
    padding.left + (index / (points.length - 1)) * plotWidth;
  const yFor = (days) =>
    padding.top + plotHeight - (days / yMax) * plotHeight;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.days)}`).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const value = Math.round(yMax * fraction);
    const y = yFor(value);
    return { value, y };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Remaining shelf life over time"
    >
      {/* Gridlines + y-axis labels */}
      {gridLines.map((g) => (
        <g key={g.value}>
          <line
            x1={padding.left}
            y1={g.y}
            x2={width - padding.right}
            y2={g.y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
          <text x={padding.left - 8} y={g.y + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
            {g.value}
          </text>
        </g>
      ))}

      {/* Trend line */}
      <polyline points={linePoints} fill="none" stroke="#16a34a" strokeWidth="2" />

      {/* Data points + x-axis date labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(p.days)} r="4" fill="#16a34a" />
          <text
            x={xFor(i)}
            y={height - padding.bottom + 16}
            fontSize="9"
            fill="#6b7280"
            textAnchor="middle"
          >
            {new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        </g>
      ))}

      <text x={4} y={12} fontSize="10" fill="#6b7280">
        Days remaining
      </text>
    </svg>
  );
}

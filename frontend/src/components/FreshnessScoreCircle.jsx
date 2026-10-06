import React from "react";

function colorForScore(score) {
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#65a30d";
  if (score >= 55) return "#ca8a04";
  if (score >= 30) return "#ea580c";
  return "#dc2626";
}

export default function FreshnessScoreCircle({ score, size = 96, label }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = colorForScore(clamped);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.26} fontWeight="600" fill="#1e293b">
          {Math.round(clamped)}
        </text>
      </svg>
      {label && <p className="mt-1 text-xs text-slate-500">{label}</p>}
    </div>
  );
}

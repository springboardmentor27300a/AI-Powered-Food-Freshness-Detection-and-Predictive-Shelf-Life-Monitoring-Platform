import React from "react";

// Small shared building blocks so all four dashboards look like one system.

const ICONS = {
  list: "M4 6h16M4 12h16M4 18h10",
  check: "M5 13l4 4L19 7",
  alert: "M12 8v5m0 3h.01M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  x: "M6 6l12 12M18 6L6 18",
  users: "M17 20h5v-2a4 4 0 00-3-3.9M9 20H4v-2a4 4 0 014-4h2a4 4 0 014 4v2zM12 7a3 3 0 11-6 0 3 3 0 016 0zm6 1a2 2 0 11-4 0 2 2 0 014 0z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  bell: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z",
  home: "M3 12l9-9 9 9M5 10v10h14V10",
  camera: "M3 8h4l2-3h6l2 3h4v11H3V8zm9 8a3 3 0 100-6 3 3 0 000 6z",
  thermo: "M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z",
  bulb: "M9 18h6m-5 3h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z",
  trash: "M6 7h12M9 7V4h6v3m-8 0l1 13h8l1-13",
  file: "M7 3h7l5 5v13H7V3zm7 0v5h5",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h11",
  close: "M6 6l12 12M18 6L6 18",
};

export function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name] || ICONS.list} />
    </svg>
  );
}

export function Card({ id, title, subtitle, right, children, className = "" }) {
  return (
    <section
      id={id}
      className={`bg-white border border-gray-200 rounded-2xl p-5 scroll-mt-24 min-w-0 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-3.5">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
};

export function StatCard({ label, value, icon, tone = "blue", hint, loading }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4 min-w-0">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[28px] leading-none font-extrabold text-gray-900">
          {loading ? <span className="inline-block h-7 w-12 rounded bg-gray-100 animate-pulse" /> : value}
        </p>
        <p className="text-xs text-gray-500 mt-1.5">{label}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

export function Pill({ cls, children }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center text-sm text-gray-500 bg-gray-50/60">
      <p className="font-semibold text-gray-700 mb-0.5">{title}</p>
      {children && <p>{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

export function SuccessBanner({ children }) {
  if (!children) return null;
  return (
    <div role="status" className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
      {children}
    </div>
  );
}

export function Note({ children }) {
  return <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mt-3">{children}</p>;
}

export function KV({ label, children, strong = true }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-gray-200 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${strong ? "font-semibold text-gray-900" : "text-gray-800"}`}>{children}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 5 }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-5 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export const inputCls =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

export function PageHeading({ name, text }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-gray-900">Welcome, {name}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{text}</p>
    </div>
  );
}

export function Th({ children, className = "" }) {
  return (
    <th className={`text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 px-3 py-2.5 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 text-sm text-gray-700 border-b border-gray-100 ${className}`}>{children}</td>;
}

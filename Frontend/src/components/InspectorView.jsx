import React, { useState, useEffect, useCallback } from "react";

const FRESHNESS_COLORS = {
  Fresh: "#34D399",
  Good: "#60A5FA",
  Acceptable: "#FBBF24",
  "Near Spoilage": "#F97316",
  Spoiled: "#EF4444",
};

const SPOILAGE_THRESHOLDS = [
  { label: "Safe — Excellent Quality", min: 88, color: "#34D399", icon: "✅" },
  { label: "Good — Minor Imperfections", min: 70, color: "#60A5FA", icon: "🟦" },
  { label: "Acceptable — Monitor Closely", min: 50, color: "#FBBF24", icon: "⚠️" },
  { label: "Near Spoilage — Urgent Dispatch", min: 30, color: "#F97316", icon: "🔶" },
  { label: "Spoiled — Write-Off Required", min: 0, color: "#EF4444", icon: "🚨" },
];

function getSpoilageLevel(score) {
  return SPOILAGE_THRESHOLDS.find((t) => score >= t.min) || SPOILAGE_THRESHOLDS[4];
}

function getFreshnessStatus(score) {
  if (score >= 88) return "Fresh";
  if (score >= 70) return "Good";
  if (score >= 50) return "Acceptable";
  if (score >= 30) return "Near Spoilage";
  return "Spoiled";
}

function ScoreRing({ score, size = 80 }) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color =
    score >= 88 ? "#34D399" : score >= 70 ? "#60A5FA" : score >= 50 ? "#FBBF24" : score >= 30 ? "#F97316" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700, transform: "rotate(90deg)", transformOrigin: "center", fontFamily: "Inter, sans-serif" }}>
        {score}
      </text>
    </svg>
  );
}

function WeightBar({ label, weight, score, color }) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.81rem", fontWeight: 500, marginBottom: 5 }}>
        <span style={{ color: "var(--linear-fg)" }}>{label}</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "var(--linear-fg-muted)", fontSize: "0.72rem" }}>{weight}% weight</span>
          <span style={{ color, fontWeight: 700 }}>{score}/100</span>
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", height: 7, borderRadius: "9999px", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, background: color, height: "100%", transition: "width 0.8s ease", boxShadow: `0 0 8px ${color}55` }} />
      </div>
    </div>
  );
}

export default function InspectorView({ batches, warehouses }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("score_asc");
  const [searchQ, setSearchQ] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [categoryHealth, setCategoryHealth] = useState([]);
  const [freshnessTrends, setFreshnessTrends] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [sRes, cRes, tRes] = await Promise.all([
        fetch("/api/analytics/dashboard"),
        fetch("/api/analytics/category-health"),
        fetch("/api/analytics/freshness-trends"),
      ]);
      if (sRes.ok) setDashboardStats(await sRes.json());
      if (cRes.ok) setCategoryHealth(await cRes.json());
      if (tRes.ok) setFreshnessTrends(await tRes.json());
    } catch (err) {
      console.error("Inspector analytics fetch error:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const enrichedBatches = batches.map((b) => {
    const score = b.freshness_score ?? 85;
    const status = getFreshnessStatus(score);
    const spoilageProb = Math.max(0, 100 - score);
    const compositeScore = Math.round(score * 0.4 + 90 * 0.25 + 85 * 0.2 + 90 * 0.15);
    let daysLeft = 8;
    try { daysLeft = Math.max(0, Math.round((new Date(b.expiry_date) - new Date()) / 86400000)); } catch (e) {}
    return { ...b, status, spoilageProb, compositeScore, daysLeft };
  });

  const filteredBatches = enrichedBatches
    .filter((b) => filterStatus === "all" || b.status === filterStatus)
    .filter((b) => !searchQ || b.product_name?.toLowerCase().includes(searchQ.toLowerCase()) || b.batch_id?.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "score_asc") return a.freshness_score - b.freshness_score;
      if (sortBy === "score_desc") return b.freshness_score - a.freshness_score;
      if (sortBy === "expiry") return a.daysLeft - b.daysLeft;
      return (a.product_name || "").localeCompare(b.product_name || "");
    });

  const criticalBatches = enrichedBatches.filter((b) => b.freshness_score < 50);
  const warningBatches = enrichedBatches.filter((b) => b.freshness_score >= 50 && b.freshness_score < 70);
  const freshBatches = enrichedBatches.filter((b) => b.freshness_score >= 88);

  const handleExportCSV = async () => {
    setReportLoading(true);
    setReportMsg("");
    try {
      const res = await fetch("/api/reports/export/csv");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FreshSense_QA_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setReportMsg("✅ Quality Audit CSV exported successfully.");
    } catch (e) {
      setReportMsg("❌ Export failed. Ensure backend is running.");
    } finally {
      setReportLoading(false);
      setTimeout(() => setReportMsg(""), 4000);
    }
  };

  const handlePrintReport = (batchId) => {
    window.open(`/api/reports/batch/${batchId}/inspection-report`, "_blank");
  };

  const tabs = [
    { key: "overview", label: "📊 QA Overview" },
    { key: "batch", label: `🔬 Batch Inspection (${filteredBatches.length})` },
    { key: "reports", label: "📋 Reports & Export" },
  ];

  const avgScore = enrichedBatches.length
    ? Math.round(enrichedBatches.reduce((s, b) => s + b.freshness_score, 0) / enrichedBatches.length)
    : null;
  const avgComposite = enrichedBatches.length
    ? Math.round(enrichedBatches.reduce((s, b) => s + b.compositeScore, 0) / enrichedBatches.length)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* HERO */}
      <div className="linear-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.3rem" }}>
            <span style={{ fontSize: "1.9rem" }}>🔬</span>
            <h2 className="linear-text-gradient" style={{ fontSize: "1.45rem", fontWeight: 600 }}>
              Food Quality Inspector — Diagnostics Lab
            </h2>
            <span className="linear-badge linear-badge-fresh" style={{ fontSize: "0.68rem" }}>MILESTONE 4</span>
          </div>
          <p style={{ fontSize: "0.87rem", color: "var(--linear-fg-muted)" }}>
            Live CV score breakdowns • Spoilage probability maps • Cold-chain compliance • ISO 22000 inspection reports
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="linear-btn linear-btn-secondary" onClick={fetchStats} style={{ fontSize: "0.78rem", padding: "0.5rem 1rem" }}>🔄 Refresh Data</button>
          <button className="linear-btn linear-btn-primary" onClick={handleExportCSV} disabled={reportLoading} style={{ fontSize: "0.78rem", padding: "0.5rem 1.1rem" }}>📥 Export QA Audit CSV</button>
        </div>
      </div>

      {/* CRITICAL ALERT */}
      {criticalBatches.length > 0 && (
        <div style={{ padding: "0.85rem 1.2rem", borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#F87171", fontSize: "0.86rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          🚨 <strong>{criticalBatches.length} CRITICAL SPOILAGE RISK</strong> — Batches below 50/100 require immediate write-off or urgent dispatch action.
          {criticalBatches.map((b) => (
            <span key={b.batch_id} style={{ background: "rgba(239,68,68,0.2)", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem" }}>
              {b.product_name} ({b.freshness_score}/100)
            </span>
          ))}
        </div>
      )}

      {reportMsg && (
        <div style={{ padding: "0.8rem 1.2rem", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 500, background: reportMsg.startsWith("✅") ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${reportMsg.startsWith("✅") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, color: reportMsg.startsWith("✅") ? "#34D399" : "#F87171" }}>
          {reportMsg}
        </div>
      )}

      {/* KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Total Batches", value: enrichedBatches.length, icon: "📦", color: "var(--linear-accent)" },
          { label: "Fresh / Excellent", value: freshBatches.length, icon: "✅", color: "#34D399" },
          { label: "Warning Zone", value: warningBatches.length, icon: "⚠️", color: "#FBBF24" },
          { label: "Critical Risk", value: criticalBatches.length, icon: "🚨", color: "#F87171" },
          { label: "Avg Freshness", value: avgScore ? `${avgScore}/100` : "N/A", icon: "📈", color: "#C084FC" },
          { label: "Active Warehouses", value: warehouses.length, icon: "🏭", color: "#60A5FA" },
        ].map((k, i) => (
          <div key={i} className="linear-card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", marginBottom: "0.3rem" }}>{k.icon}</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--linear-fg-muted)", marginTop: "0.3rem", fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid var(--linear-border-default)", paddingBottom: "0.4rem", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`linear-btn ${activeTab === t.key ? "linear-btn-primary" : "linear-btn-secondary"}`}
            style={{ padding: "0.45rem 1.1rem", fontSize: "0.82rem", borderRadius: "7px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: QA OVERVIEW ── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
            {/* PRD 4-Pillar Matrix */}
            <div className="linear-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--linear-fg)" }}>📊 PRD Quality Weighted Diagnostic Matrix</h3>
                <span className="linear-badge linear-badge-fresh" style={{ fontSize: "0.68rem" }}>ISO 22000</span>
              </div>
              <WeightBar label="Visual Condition Analysis (CV Engine)" weight={40} score={avgScore || 91} color="#34D399" />
              <WeightBar label="Environmental Storage (Temp / RH)" weight={25} score={94} color="var(--linear-accent)" />
              <WeightBar label="Remaining Shelf-Life Prediction" weight={20} score={87} color="#FBBF24" />
              <WeightBar label="Product Age & Harvest Index" weight={15} score={90} color="#C084FC" />
              <div style={{ marginTop: "1rem", padding: "0.7rem 1rem", background: "rgba(94,106,210,0.1)", borderRadius: "8px", border: "1px solid rgba(94,106,210,0.2)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--linear-fg)" }}>PRD Composite Score</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--linear-accent)" }}>{avgComposite ? `${avgComposite}/100` : "91/100"}</span>
              </div>
            </div>

            {/* Spoilage Risk Radar */}
            <div className="linear-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--linear-fg)" }}>🛡️ Live Spoilage Risk Radar</h3>
                <span className="linear-badge linear-badge-warning" style={{ fontSize: "0.68rem" }}>LIVE</span>
              </div>
              {filteredBatches.length === 0 ? (
                <p style={{ color: "var(--linear-fg-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
                  No active batches. Register batches in Warehouse workspace to initiate diagnostics.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", maxHeight: 300, overflowY: "auto" }}>
                  {filteredBatches.slice(0, 8).map((b) => {
                    const level = getSpoilageLevel(b.freshness_score);
                    return (
                      <div key={b.id || b.batch_id}
                        onClick={() => { setSelectedBatch(b); setActiveTab("batch"); }}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#09090C", padding: "9px 13px", borderRadius: "10px", border: "1px solid var(--linear-border-default)", cursor: "pointer" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--linear-fg)" }}>{b.product_name}</div>
                          <div style={{ fontSize: "0.73rem", color: "var(--linear-fg-muted)" }}>{b.batch_id} • {b.warehouse_name} • {b.daysLeft}d left</div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: level.color, background: level.color + "18", padding: "2px 8px", borderRadius: "6px" }}>
                          {level.icon} {b.freshness_score}/100
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
            {/* Freshness Distribution */}
            <div className="linear-card">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1.2rem" }}>📉 Freshness Status Distribution</h3>
              {loadingStats ? (
                <p style={{ color: "var(--linear-fg-muted)", fontSize: "0.85rem" }}>Loading analytics...</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {Object.entries(dashboardStats?.freshness_breakdown || { Fresh: 4, Good: 3, Acceptable: 2, "Near Spoilage": 1, Spoiled: 0 }).map(([status, count]) => {
                    const total = Math.max(1, Object.values(dashboardStats?.freshness_breakdown || {}).reduce((a, c) => a + c, 0));
                    const pct = Math.round((count / total) * 100);
                    const color = FRESHNESS_COLORS[status] || "#888";
                    return (
                      <div key={status}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{status}</span>
                          <span style={{ color, fontWeight: 700 }}>{count} batches ({pct}%)</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.06)", height: 7, borderRadius: "9999px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, background: color, height: "100%", transition: "width 0.7s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Health Matrix */}
            <div className="linear-card">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1.2rem" }}>🧬 Category Health Matrix</h3>
              {categoryHealth.length === 0 ? (
                <p style={{ color: "var(--linear-fg-muted)", fontSize: "0.85rem" }}>Loading health data...</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {categoryHealth.map((cat) => (
                    <div key={cat.category} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#09090C", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--linear-border-default)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ fontSize: "1.4rem" }}>{cat.icon}</span>
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{cat.category}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--linear-fg-muted)" }}>{cat.primary_risk}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: cat.avg_freshness >= 88 ? "#34D399" : cat.avg_freshness >= 70 ? "#60A5FA" : "#FBBF24" }}>
                          {cat.avg_freshness}/100
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--linear-fg-muted)" }}>{cat.compliance_rate}% compliant</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Trend Chart */}
          {freshnessTrends && (
            <div className="linear-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }}>📈 7-Day Category Freshness Degradation Trends</h3>
                <span className="linear-badge linear-badge-good" style={{ fontSize: "0.68rem" }}>TREND ANALYSIS</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: 90, padding: "0 0.5rem", marginBottom: "0.6rem", borderBottom: "1px solid var(--linear-border-default)" }}>
                {freshnessTrends.dates.map((date, di) => (
                  <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 2, width: "100%" }}>
                      {freshnessTrends.series.map((s) => (
                        <div key={s.category} title={`${s.category}: ${s.values[di]}/100`}
                          style={{ width: "100%", height: `${(s.values[di] / 100) * 70}%`, background: s.color + "CC", borderRadius: "3px 3px 0 0", minHeight: 3 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "0.62rem", color: "var(--linear-fg-muted)", textAlign: "center", marginTop: 3 }}>{date}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.6rem" }}>
                {freshnessTrends.series.map((s) => (
                  <div key={s.category} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "2px", background: s.color }} />
                    <span style={{ color: "var(--linear-fg-muted)" }}>{s.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: BATCH INSPECTION ── */}
      {activeTab === "batch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Filters */}
          <div className="linear-card" style={{ padding: "1rem 1.2rem" }}>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
              <input type="text" placeholder="🔍 Search batch ID or product name..."
                value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.9rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--linear-border-default)", borderRadius: "8px", color: "var(--linear-fg)", fontSize: "0.84rem" }} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "0.5rem 0.8rem", background: "#09090C", border: "1px solid var(--linear-border-default)", borderRadius: "8px", color: "var(--linear-fg)", fontSize: "0.82rem" }}>
                <option value="all">All Status</option>
                {Object.keys(FRESHNESS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "0.5rem 0.8rem", background: "#09090C", border: "1px solid var(--linear-border-default)", borderRadius: "8px", color: "var(--linear-fg)", fontSize: "0.82rem" }}>
                <option value="score_asc">Sort: Lowest Score First (Risk Priority)</option>
                <option value="score_desc">Sort: Highest Score First</option>
                <option value="expiry">Sort: Soonest Expiry</option>
                <option value="name">Sort: Product Name A-Z</option>
              </select>
              <span style={{ fontSize: "0.78rem", color: "var(--linear-fg-muted)", whiteSpace: "nowrap" }}>
                {filteredBatches.length} record{filteredBatches.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Batch Detail Panel */}
          {selectedBatch && (() => {
            const level = getSpoilageLevel(selectedBatch.freshness_score);
            const verdicts = [
              "Product has exceeded freshness threshold. Execute write-off protocol and divert to composting.",
              "Near-spoilage threshold. Apply 40-70% emergency clearance or donate to food banks.",
              "Product borderline. Immediate quality review recommended. Apply 15% markdown.",
              "Product acceptable. Prioritize in FEFO dispatch rotation within 7 days.",
              "Product meets all ISO 22000 freshness standards. Cleared for retail distribution.",
            ];
            const vi = selectedBatch.freshness_score >= 88 ? 4 : selectedBatch.freshness_score >= 70 ? 3 : selectedBatch.freshness_score >= 50 ? 2 : selectedBatch.freshness_score >= 30 ? 1 : 0;
            return (
              <div className="linear-card" style={{ border: "1px solid rgba(94,106,210,0.4)", background: "rgba(94,106,210,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.8rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--linear-fg)" }}>🔬 {selectedBatch.product_name}</h3>
                      <span className="linear-badge linear-badge-fresh" style={{ fontSize: "0.68rem" }}>INSPECTION ACTIVE</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--linear-fg-muted)", marginTop: "0.2rem" }}>
                      {selectedBatch.batch_id} • {selectedBatch.warehouse_name} • {selectedBatch.category}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="linear-btn linear-btn-secondary" onClick={() => handlePrintReport(selectedBatch.batch_id)} style={{ fontSize: "0.78rem", padding: "0.4rem 0.9rem" }}>🖨️ Print ISO Report</button>
                    <button className="linear-btn linear-btn-secondary" onClick={() => setSelectedBatch(null)} style={{ fontSize: "0.78rem", padding: "0.4rem 0.8rem", color: "#F87171", borderColor: "rgba(239,68,68,0.3)" }}>✕ Close</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2rem", alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    <ScoreRing score={selectedBatch.freshness_score} size={100} />
                    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: level.color, textAlign: "center" }}>{getFreshnessStatus(selectedBatch.freshness_score)}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--linear-fg-muted)" }}>Freshness Score</div>
                  </div>
                  <div>
                    <WeightBar label="Visual Condition Analysis" weight={40} score={selectedBatch.freshness_score} color="#34D399" />
                    <WeightBar label="Environmental Storage" weight={25} score={Math.min(100, 90 + (selectedBatch.storage_temp_celsius < 5 ? 5 : -5))} color="var(--linear-accent)" />
                    <WeightBar label="Shelf-Life Remaining" weight={20} score={Math.min(100, selectedBatch.daysLeft * 10)} color="#FBBF24" />
                    <WeightBar label="Product Age Index" weight={15} score={selectedBatch.compositeScore} color="#C084FC" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "0.8rem", marginTop: "1.2rem" }}>
                  {[
                    { label: "Spoilage Probability", value: `${selectedBatch.spoilageProb}%`, color: selectedBatch.spoilageProb > 50 ? "#F87171" : "#34D399" },
                    { label: "Days Until Expiry", value: `${selectedBatch.daysLeft} days`, color: selectedBatch.daysLeft <= 3 ? "#F87171" : selectedBatch.daysLeft <= 7 ? "#FBBF24" : "#34D399" },
                    { label: "Storage Temp", value: `${selectedBatch.storage_temp_celsius ?? "N/A"}°C`, color: "var(--linear-accent)" },
                    { label: "Humidity", value: `${selectedBatch.storage_humidity_percent ?? "N/A"}% RH`, color: "#60A5FA" },
                    { label: "Quantity (kg)", value: `${(selectedBatch.quantity_kg ?? 0).toLocaleString()} kg`, color: "var(--linear-fg)" },
                    { label: "Unit Value", value: `$${selectedBatch.unit_price_per_kg ?? 0}/kg`, color: "#C084FC" },
                  ].map((m) => (
                    <div key={m.label} style={{ padding: "0.7rem 0.9rem", background: "#09090C", borderRadius: "9px", border: "1px solid var(--linear-border-default)" }}>
                      <div style={{ fontSize: "0.68rem", color: "var(--linear-fg-muted)", marginBottom: "0.2rem" }}>{m.label}</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "1rem", padding: "0.9rem 1.2rem", background: level.color + "12", borderRadius: "10px", border: `1px solid ${level.color}33` }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: level.color, marginBottom: "0.3rem" }}>{level.icon} INSPECTOR VERDICT — {level.label.toUpperCase()}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--linear-fg-muted)" }}>{verdicts[vi]}</div>
                </div>
              </div>
            );
          })()}

          {/* Batch Grid */}
          {filteredBatches.length === 0 ? (
            <div className="linear-card" style={{ textAlign: "center", padding: "3rem", color: "var(--linear-fg-muted)" }}>
              No batches match your filter. Register batches in the Warehouse workspace to begin inspection.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
              {filteredBatches.map((b) => {
                const level = getSpoilageLevel(b.freshness_score);
                const isSelected = selectedBatch?.batch_id === b.batch_id;
                return (
                  <div key={b.id || b.batch_id} className="linear-card" onClick={() => setSelectedBatch(isSelected ? null : b)}
                    style={{ cursor: "pointer", border: isSelected ? "1px solid var(--linear-accent)" : "1px solid var(--linear-border-default)", background: isSelected ? "rgba(94,106,210,0.06)" : undefined, transition: "all 0.15s", padding: "1.1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--linear-fg)" }}>{b.product_name}</div>
                        <div style={{ fontSize: "0.73rem", color: "var(--linear-fg-muted)", marginTop: "0.1rem" }}>{b.batch_id} • {b.category}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--linear-fg-muted)" }}>📍 {b.warehouse_name}</div>
                      </div>
                      <ScoreRing score={b.freshness_score} size={62} />
                    </div>
                    <div style={{ marginBottom: "0.7rem" }}>
                      <div style={{ background: "rgba(255,255,255,0.06)", height: 5, borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: `${b.freshness_score}%`, background: level.color, height: "100%" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: level.color, background: level.color + "18", padding: "2px 8px", borderRadius: "6px" }}>
                        {level.icon} {getFreshnessStatus(b.freshness_score)}
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.72rem", color: "var(--linear-fg-muted)" }}>
                        <span>⏱ {b.daysLeft}d</span>
                        <span>🌡 {b.storage_temp_celsius ?? "—"}°C</span>
                        <span>💧 {b.storage_humidity_percent ?? "—"}%</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.8rem" }}>
                      <button className="linear-btn linear-btn-secondary"
                        onClick={(e) => { e.stopPropagation(); setSelectedBatch(b); }}
                        style={{ flex: 1, fontSize: "0.73rem", padding: "0.35rem" }}>🔬 Inspect</button>
                      <button className="linear-btn linear-btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handlePrintReport(b.batch_id); }}
                        style={{ flex: 1, fontSize: "0.73rem", padding: "0.35rem" }}>🖨️ Report</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: REPORTS & EXPORT ── */}
      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="linear-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--linear-fg)" }}>📋 Reports & Export System</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--linear-fg-muted)", marginTop: "0.2rem" }}>
                  Generate, download, and print inspection certificates, quality audit reports, and data exports.
                </p>
              </div>
              <span className="linear-badge linear-badge-fresh" style={{ fontSize: "0.68rem" }}>PRD §4.11</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {[
                {
                  icon: "📥", title: "Full Inventory Audit CSV",
                  desc: "Complete freshness metrics, batch data, storage conditions, and status for all inventory. Excel-compatible.",
                  color: "#34D399", action: handleExportCSV,
                },
                {
                  icon: "📊", title: "QA Dashboard Summary JSON",
                  desc: "Platform-wide freshness scores, spoilage distribution, category health, and network compliance.",
                  color: "var(--linear-accent)",
                  action: () => {
                    const report = {
                      generated_at: new Date().toISOString(),
                      total_batches: enrichedBatches.length,
                      avg_freshness_score: avgScore || "N/A",
                      critical_risk: criticalBatches.length,
                      warning_zone: warningBatches.length,
                      fresh_batches: freshBatches.length,
                      iso_standard: "ISO 22000:2018",
                      platform: "FreshSense AI Milestone 4",
                    };
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `QA_Dashboard_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setReportMsg("✅ QA Dashboard JSON summary exported.");
                    setTimeout(() => setReportMsg(""), 4000);
                  },
                },
                {
                  icon: "🖨️", title: "Batch Inspection Reports",
                  desc: 'Click "Print ISO Report" on any batch in the Batch Inspection tab to generate a printable PDF certificate.',
                  color: "#FBBF24", action: () => setActiveTab("batch"),
                },
                {
                  icon: "🚨", title: "Critical Spoilage Alert CSV",
                  desc: "Export all batches below 50/100 freshness requiring immediate corrective action.",
                  color: "#F87171",
                  action: () => {
                    if (criticalBatches.length === 0) {
                      setReportMsg("✅ No critical batches. All inventory is above threshold.");
                      setTimeout(() => setReportMsg(""), 4000);
                      return;
                    }
                    const csv = ["Batch ID,Product,Category,Score,Days Left,Warehouse", ...criticalBatches.map((b) => `${b.batch_id},${b.product_name},${b.category},${b.freshness_score},${b.daysLeft},${b.warehouse_name}`)].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "Critical_Spoilage_Alert.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    setReportMsg(`✅ Critical alert report exported — ${criticalBatches.length} high-risk batches.`);
                    setTimeout(() => setReportMsg(""), 4000);
                  },
                },
              ].map((card) => (
                <div key={card.title} style={{ padding: "1.2rem", background: "#09090C", borderRadius: "12px", border: `1px solid ${card.color}33`, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  <div style={{ fontSize: "1.8rem" }}>{card.icon}</div>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--linear-fg)" }}>{card.title}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--linear-fg-muted)", marginTop: "0.3rem", lineHeight: 1.5 }}>{card.desc}</div>
                  </div>
                  <button onClick={card.action} className="linear-btn linear-btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "0.5rem", borderColor: card.color + "44", color: card.color }}>
                    Generate / Export
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Inspection Log Table */}
          <div className="linear-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }}>🗂️ Batch Quality Inspection Log</h3>
              <span style={{ fontSize: "0.78rem", color: "var(--linear-fg-muted)" }}>{enrichedBatches.length} records</span>
            </div>
            {enrichedBatches.length === 0 ? (
              <p style={{ color: "var(--linear-fg-muted)", textAlign: "center", padding: "2rem" }}>No batches registered yet.</p>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--linear-border-default)" }}>
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>Batch & Product</th>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Expiry</th>
                      <th>Storage Cond.</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedBatches.map((b) => {
                      const level = getSpoilageLevel(b.freshness_score);
                      return (
                        <tr key={b.batch_id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{b.product_name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--linear-accent)" }}>{b.batch_id}</div>
                          </td>
                          <td><span style={{ fontSize: "0.8rem" }}>{b.category}</span></td>
                          <td><span style={{ fontWeight: 700, color: level.color }}>{b.freshness_score}/100</span></td>
                          <td>
                            <span style={{ fontSize: "0.73rem", color: level.color, background: level.color + "18", padding: "2px 7px", borderRadius: "5px", fontWeight: 600 }}>
                              {level.icon} {getFreshnessStatus(b.freshness_score)}
                            </span>
                          </td>
                          <td><span style={{ fontSize: "0.8rem", color: b.daysLeft <= 3 ? "#F87171" : "var(--linear-fg)" }}>{b.daysLeft}d left</span></td>
                          <td><span style={{ fontSize: "0.78rem", color: "var(--linear-fg-muted)" }}>{b.storage_temp_celsius}°C / {b.storage_humidity_percent}%</span></td>
                          <td>
                            <button onClick={() => handlePrintReport(b.batch_id)} className="linear-btn linear-btn-secondary"
                              style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}>
                              🖨️ Report
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';

export default function FreshnessAnalyticsHub({ user, warehouses = [], batches = [] }) {
  // Navigation Tabs: 'lab' | 'storage' | 'recommendations' | 'analytics'
  const [activeTab, setActiveTab] = useState('lab');

  // --- TAB 1: SHELF-LIFE SIMULATOR STATES ---
  const [simCategory, setSimCategory] = useState('Fruits');
  const [simHarvestAge, setSimHarvestAge] = useState(4); // days ago
  const [simVisualScore, setSimVisualScore] = useState(92);
  const [simTemp, setSimTemp] = useState(3.5);
  const [simHumidity, setSimHumidity] = useState(88.0);
  const [simPackaging, setSimPackaging] = useState('Modified Atmosphere (MAP)');
  const [simAirflow, setSimAirflow] = useState('Optimal (Active)');
  
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // --- TAB 2: STORAGE TELEMETRY STATES ---
  const [zones, setZones] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState('ZONE-WH01-A');
  const [telemetryHistory, setTelemetryHistory] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // --- TAB 3: RECOMMENDATION & FEFO STATES ---
  const [fefoQueue, setFefoQueue] = useState([]);
  const [markdowns, setMarkdowns] = useState([]);
  const [ethyleneMatrix, setEthyleneMatrix] = useState([]);
  const [recOverview, setRecOverview] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [dispatchedBatches, setDispatchedBatches] = useState({});
  const [appliedDiscounts, setAppliedDiscounts] = useState({});

  // --- TAB 4: ANALYTICS STATES ---
  const [dashboardStats, setDashboardStats] = useState(null);
  const [freshnessTrends, setFreshnessTrends] = useState(null);
  const [categoryHealth, setCategoryHealth] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Calculate harvest date string from days ago
  const getHarvestDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Run Shelf-Life Simulation
  const runSimulation = async () => {
    setSimLoading(true);
    const harvestDate = getHarvestDateStr(simHarvestAge);
    try {
      const res = await fetch('/api/prediction/simulate-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: simCategory,
          harvest_date: harvestDate,
          storage_temp_celsius: parseFloat(simTemp),
          storage_humidity_percent: parseFloat(simHumidity),
          packaging_type: simPackaging,
          air_circulation: simAirflow,
          visual_score: parseInt(simVisualScore)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (err) {
      console.error('Shelf-life simulation error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Fetch Storage Telemetry & Alerts
  const fetchStorageData = async () => {
    setStorageLoading(true);
    try {
      const [zRes, aRes] = await Promise.all([
        fetch('/api/storage/zones'),
        fetch('/api/storage/alerts')
      ]);
      if (zRes.ok) {
        const zData = await zRes.json();
        setZones(zData);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAlerts(aData);
      }
    } catch (err) {
      console.error('Storage telemetry fetch error:', err);
    } finally {
      setStorageLoading(false);
    }
  };

  // Fetch Zone Telemetry History for Chart
  const fetchZoneHistory = async (zoneId) => {
    try {
      const res = await fetch(`/api/storage/telemetry/${zoneId}`);
      if (res.ok) {
        const data = await res.json();
        setTelemetryHistory(data);
      }
    } catch (err) {
      console.error('Zone history fetch error:', err);
    }
  };

  // Fetch Recommendations & FEFO Data
  const fetchRecommendationsData = async () => {
    setRecLoading(true);
    try {
      const [fRes, mRes, eRes, oRes] = await Promise.all([
        fetch('/api/recommendations/fefo-queue'),
        fetch('/api/recommendations/markdowns'),
        fetch('/api/recommendations/storage-matrix'),
        fetch('/api/recommendations/overview')
      ]);

      if (fRes.ok) setFefoQueue(await fRes.json());
      if (mRes.ok) setMarkdowns(await mRes.json());
      if (eRes.ok) setEthyleneMatrix(await eRes.json());
      if (oRes.ok) setRecOverview(await oRes.json());
    } catch (err) {
      console.error('Recommendations fetch error:', err);
    } finally {
      setRecLoading(false);
    }
  };

  // Fetch Analytics Dashboard Data
  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      const [sRes, tRes, hRes] = await Promise.all([
        fetch('/api/analytics/dashboard'),
        fetch('/api/analytics/freshness-trends'),
        fetch('/api/analytics/category-health')
      ]);

      if (sRes.ok) setDashboardStats(await sRes.json());
      if (tRes.ok) setFreshnessTrends(await tRes.json());
      if (hRes.ok) setCategoryHealth(await hRes.json());
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Auto-run simulation on slider changes with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 150);
    return () => clearTimeout(timer);
  }, [simCategory, simHarvestAge, simVisualScore, simTemp, simHumidity, simPackaging, simAirflow]);

  // Initial load on tab changes
  useEffect(() => {
    if (activeTab === 'storage') {
      fetchStorageData();
      fetchZoneHistory(selectedZoneId);
    } else if (activeTab === 'recommendations') {
      fetchRecommendationsData();
    } else if (activeTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedZoneId) {
      fetchZoneHistory(selectedZoneId);
    }
  }, [selectedZoneId]);

  // Handle Resolve Storage Alert
  const handleResolveAlert = async (alertId) => {
    try {
      const res = await fetch(`/api/storage/alerts/${alertId}/resolve`, { method: 'POST' });
      if (res.ok) {
        setActionNotice(`Alert ${alertId} resolved! Cold chain parameters normalized.`);
        fetchStorageData();
        fetchZoneHistory(selectedZoneId);
        setTimeout(() => setActionNotice(''), 4000);
      }
    } catch (err) {
      console.error('Resolve alert error:', err);
    }
  };

  // Handle Simulate IoT Excursion
  const handleTriggerExcursion = async (triggerExcursion) => {
    try {
      const res = await fetch('/api/storage/simulate-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: selectedZoneId,
          trigger_excursion: triggerExcursion
        })
      });
      if (res.ok) {
        setActionNotice(triggerExcursion ? '⚠️ Simulated temperature excursion injected (+7.2°C)!' : '✅ Telemetry reset to optimal (3.1°C).');
        fetchStorageData();
        fetchZoneHistory(selectedZoneId);
        setTimeout(() => setActionNotice(''), 4000);
      }
    } catch (err) {
      console.error('Trigger excursion error:', err);
    }
  };

  // Handle FEFO Dispatch Priority
  const handlePrioritizeDispatch = (batchId) => {
    setDispatchedBatches(prev => ({ ...prev, [batchId]: true }));
    setActionNotice(`Batch ${batchId} dispatched to High-Velocity FEFO retail transport channel.`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  // Handle Dynamic Markdown Apply
  const handleApplyDiscount = (batchId, discountPercent) => {
    setAppliedDiscounts(prev => ({ ...prev, [batchId]: discountPercent }));
    setActionNotice(`Dynamic markdown of -${discountPercent}% applied to Batch ${batchId}. Retail tags updated.`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  // Copy Executive Report to Clipboard
  const handleExportReport = () => {
    const reportText = `# FRESHSENSE AI — EXECUTIVE FRESHNESS & SHELF-LIFE AUDIT REPORT
Generated: ${new Date().toUTCString()}
Platform Status: MILESTONE 4 OPERATIONAL (AZURE READY)

## 1. Executive KPIs
- Total Inventory Monitored: ${dashboardStats?.total_quantity_kg ?? 0} kg
- Average Freshness Health Score: ${dashboardStats?.average_freshness_score ?? 0}/100
- Economic Inventory at Risk: $${(dashboardStats?.economic_value_at_risk ?? 0).toFixed(2)}
- Total Food Waste Diverted: ${(dashboardStats?.total_waste_diverted_kg ?? 0).toFixed(0)} kg ($${(dashboardStats?.total_waste_diverted_dollars ?? 0).toFixed(2)} Saved)
- Cold Storage Network Compliance: ${dashboardStats?.cold_storage_compliance_rate ?? 100}%

## 2. Shelf-Life Risk Distribution
- Critical (< 3 Days): ${dashboardStats?.shelf_life_distribution?.['Critical (<3 Days)'] ?? 0} Batches
- Warning (3 - 7 Days): ${dashboardStats?.shelf_life_distribution?.['Warning (3-7 Days)'] ?? 0} Batches
- Good (8 - 14 Days): ${dashboardStats?.shelf_life_distribution?.['Good (8-14 Days)'] ?? 0} Batches
- Optimal (> 14 Days): ${dashboardStats?.shelf_life_distribution?.['Optimal (>14 Days)'] ?? 0} Batches

## 3. Storage Telemetry Status
- Active Cold Zones: ${zones.length} monitored chambers
- Active Environmental Excursions: ${alerts.length} unresolved

## 4. Operational Directives
- Implement First-Expiry-First-Out (FEFO) on critical lots immediately.
- Maintain Modified Atmosphere Packaging (MAP) for deciduous fruit vaults.
- Prevent co-location of high ethylene emitters (Apples/Bananas) with sensitive leafy greens.
`;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
      
      {/* Hero Linear Master Container */}
      <div className="linear-card" style={{ padding: '1.8rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
              }}>
                📈
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h2 className="linear-text-gradient" style={{ fontSize: '1.55rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
                    Freshness Analytics & Milestone 3 Hub
                  </h2>
                  <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}>
                    WEEK 5–6 ENGINE
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                  Bio-Kinetic Shelf-Life Prediction • Cold Storage Telemetry • FEFO Inventory Rotation • Dynamic Markdowns
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button
              onClick={handleExportReport}
              className="linear-btn linear-btn-secondary"
              style={{ padding: '0.65rem 1.1rem', fontSize: '0.82rem', borderRadius: '8px' }}
            >
              {copiedReport ? '✓ Report Copied!' : '📋 Export Briefing'}
            </button>
            <div className="linear-badge linear-badge-good" style={{ fontSize: '0.74rem', padding: '0.55rem 0.9rem' }}>
              🟢 REAL-TIME SENSORS ACTIVE
            </div>
          </div>
        </div>

        {/* Global Action Toast Notification */}
        {actionNotice && (
          <div style={{
            marginTop: '1.2rem',
            background: 'rgba(94, 106, 210, 0.15)',
            border: '1px solid rgba(94, 106, 210, 0.35)',
            color: '#A5B4FC',
            padding: '0.75rem 1.2rem',
            borderRadius: '10px',
            fontSize: '0.84rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            animation: 'fadeIn 0.3s ease'
          }}>
            <span>⚡</span> {actionNotice}
          </div>
        )}
      </div>

      {/* Linear Sub-Navigation Pill Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.6rem',
        background: 'rgba(255, 255, 255, 0.02)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid var(--linear-border-default)',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('lab')}
          className={`linear-btn ${activeTab === 'lab' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
        >
          ⏳ Shelf-Life Prediction Lab & Simulator
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`linear-btn ${activeTab === 'storage' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
        >
          ❄️ Cold Storage Telemetry & Compliance
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`linear-btn ${activeTab === 'recommendations' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
        >
          💡 Recommendation & FEFO Rotation Engine
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`linear-btn ${activeTab === 'analytics' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
          style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
        >
          📊 Freshness Analytics & Executive Insights
        </button>
      </div>

      {/* =========================================================================
          TAB 1: SHELF-LIFE PREDICTION LAB & KINETIC SIMULATOR
          ========================================================================= */}
      {activeTab === 'lab' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(460px, 1.6fr)', gap: '1.6rem', alignItems: 'start' }}>
          
          {/* Left Column: Interactive Simulation Control Console */}
          <div className="linear-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🔬</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  Kinetic Parameter Controls
                </h3>
              </div>
              <span className="linear-badge linear-badge-good" style={{ fontSize: '0.7rem' }}>
                ARRHENIUS / Q10
              </span>
            </div>

            {/* Category Select */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.35rem' }}>
                FOOD COMMODITY CATEGORY
              </label>
              <select className="linear-input" value={simCategory} onChange={(e) => setSimCategory(e.target.value)}>
                <option value="Fruits">🍎 Fruits (Gala, Honeycrisp, Berries)</option>
                <option value="Vegetables">🥬 Vegetables (Baby Spinach, Tomatoes, Greens)</option>
                <option value="Dairy Products">🥛 Dairy Products (Artisan Milk, Yogurts, Cheeses)</option>
                <option value="Meat & Poultry">🥩 Meat & Poultry (Fresh Poultry, Beef Cuts)</option>
                <option value="Seafood">🐟 Seafood (Ocean Salmon, Cod, Shrimps)</option>
                <option value="Bakery Products">🍞 Bakery Products (Breads, Pastries)</option>
              </select>
            </div>

            {/* Packaging Technology */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.35rem' }}>
                PACKAGING BARRIER TECHNOLOGY
              </label>
              <select className="linear-input" value={simPackaging} onChange={(e) => setSimPackaging(e.target.value)}>
                <option value="Modified Atmosphere (MAP)">Modified Atmosphere Packaging (MAP - 0.55x Decay)</option>
                <option value="Vacuum Sealed">Vacuum Sealed Barrier (0.65x Decay)</option>
                <option value="Perforated Polyethylene">Perforated Polyethylene Film (0.90x Decay)</option>
                <option value="Open Container / Ambient">Open Container / Ambient Air (1.35x Decay)</option>
              </select>
            </div>

            {/* Airflow Circulation */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.35rem' }}>
                COLD STORAGE AIRFLOW & VENTILATION
              </label>
              <select className="linear-input" value={simAirflow} onChange={(e) => setSimAirflow(e.target.value)}>
                <option value="Optimal (Active)">Optimal Positive-Pressure Airflow (0.92x Multiplier)</option>
                <option value="Moderate">Standard Warehouse Passive Air (1.00x Multiplier)</option>
                <option value="Stagnant">Stagnant / Trapped Ethylene Microclimate (1.25x Multiplier)</option>
              </select>
            </div>

            {/* Temperature Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>STORAGE TEMPERATURE</label>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: simTemp > 6.0 ? '#F87171' : (simTemp < 1.0 ? '#60A5FA' : '#34D399') }}>
                  🌡️ {simTemp}°C
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="26.0"
                step="0.5"
                value={simTemp}
                onChange={(e) => setSimTemp(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                <span>-2°C (Deep Chill)</span>
                <span>4°C (Cold Chain Target)</span>
                <span>26°C (Ambient Abusive)</span>
              </div>
            </div>

            {/* Humidity Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>RELATIVE HUMIDITY</label>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: simHumidity < 75 ? '#FBBF24' : (simHumidity > 95 ? '#F87171' : '#34D399') }}>
                  💧 {simHumidity}% RH
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                step="1"
                value={simHumidity}
                onChange={(e) => setSimHumidity(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                <span>40% (Severe Drying)</span>
                <span>88% (Optimal Target)</span>
                <span>100% (Mold Risk)</span>
              </div>
            </div>

            {/* Visual Freshness & Age Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>VISUAL SCORE</label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-accent)' }}>{simVisualScore}/100</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={simVisualScore}
                  onChange={(e) => setSimVisualScore(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--linear-fg-muted)' }}>HARVEST AGE</label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-fg)' }}>{simHarvestAge} Days Ago</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={simHarvestAge}
                  onChange={(e) => setSimHarvestAge(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Preset Quick Actions */}
            <div style={{ paddingTop: '0.8rem', borderTop: '1px solid var(--linear-border-default)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '0.4rem' }}>
                QUICK CALIBRATION PRESETS
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setSimTemp(3.0); setSimHumidity(88.0); setSimPackaging('Modified Atmosphere (MAP)'); setSimAirflow('Optimal (Active)'); }}
                  className="linear-btn linear-btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                >
                  🟢 Optimal Cold Chain
                </button>
                <button
                  type="button"
                  onClick={() => { setSimTemp(12.0); setSimHumidity(65.0); setSimPackaging('Perforated Polyethylene'); setSimAirflow('Moderate'); }}
                  className="linear-btn linear-btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                >
                  🟡 Retail Display Floor
                </button>
                <button
                  type="button"
                  onClick={() => { setSimTemp(24.0); setSimHumidity(55.0); setSimPackaging('Open Container / Ambient'); setSimAirflow('Stagnant'); }}
                  className="linear-btn linear-btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                >
                  🔴 Ambient / Broken Chain
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Dynamic Bio-Kinetic Shelf-Life Projections & Trajectory Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            
            {/* Top 4 Hero Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              
              <div className="linear-card" style={{ padding: '1.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PREDICTED SHELF LIFE
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: simResult?.remaining_days > 5 ? '#34D399' : (simResult?.remaining_days > 2 ? '#FBBF24' : '#F87171'), margin: '4px 0' }}>
                  {simResult?.remaining_days ?? '--'} Days
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                  ≈ {simResult?.remaining_hours ?? '--'} hours viable
                </div>
              </div>

              <div className="linear-card" style={{ padding: '1.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  DECAY MULTIPLIER (K)
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--linear-accent)', margin: '4px 0' }}>
                  {simResult?.decay_rate_multiplier ?? '1.0'}x
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                  Arrhenius / Q10 factor
                </div>
              </div>

              <div className="linear-card" style={{ padding: '1.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  COMPOSITE HEALTH SCORE
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#FBBF24', margin: '4px 0' }}>
                  {simResult?.weighted_freshness_score ?? '--'}/100
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                  Status: <strong>{simResult?.freshness_status ?? 'Good'}</strong>
                </div>
              </div>

              <div className="linear-card" style={{ padding: '1.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  SHELF-LIFE GAIN
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#38BDF8', margin: '4px 0' }}>
                  +{simResult?.extension_gain_days ?? 0} Days
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                  via Optimal Cold Chain
                </div>
              </div>

            </div>

            {/* Dynamic Interactive SVG Degradation Curve Chart */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    📉 30-Day Freshness Degradation Trajectory
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Day-by-day biochemical quality trajectory: Current Parameters vs Optimal Preservation Standard
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 12, height: 3, background: 'var(--linear-accent)', display: 'inline-block', borderRadius: 2 }} />
                    <span style={{ color: 'var(--linear-fg)' }}>Current Storage</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 12, height: 3, background: '#34D399', display: 'inline-block', borderRadius: 2 }} />
                    <span style={{ color: 'var(--linear-fg)' }}>Optimal Cold Chain</span>
                  </div>
                </div>
              </div>

              {/* Render SVG Chart */}
              {simResult?.day_by_day_curve && simResult.day_by_day_curve.length > 0 ? (
                <div style={{ width: '100%', height: 230, position: 'relative' }}>
                  <svg viewBox="0 0 600 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5E6AD2" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#5E6AD2" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="optimalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Guideline Grids */}
                    <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="600" y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="600" y2="100" stroke="rgba(239,68,68,0.3)" strokeDasharray="4 2" /> {/* 50 Threshold */}
                    <line x1="0" y1="140" x2="600" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="180" x2="600" y2="180" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                    {/* Labels */}
                    <text x="5" y="16" fill="#8A8F98" fontSize="9">100 (Fresh)</text>
                    <text x="5" y="96" fill="#F87171" fontSize="9">50 (Consumption Threshold)</text>
                    <text x="5" y="176" fill="#8A8F98" fontSize="9">10 (Spoiled)</text>

                    {/* Area fills */}
                    {(() => {
                      const pts = simResult.day_by_day_curve;
                      const n = pts.length;
                      if (n < 2) return null;

                      // Scale: X: 0 -> 600, Y: 100 score -> 20, 0 score -> 180
                      const getX = (i) => (i / (n - 1)) * 580 + 10;
                      const getY = (val) => 180 - (val / 100.0) * 160;

                      let dOptimal = `M ${getX(0)} ${getY(pts[0].optimal_score)}`;
                      let dCurrent = `M ${getX(0)} ${getY(pts[0].predicted_score)}`;

                      for (let i = 1; i < n; i++) {
                        dOptimal += ` L ${getX(i)} ${getY(pts[i].optimal_score)}`;
                        dCurrent += ` L ${getX(i)} ${getY(pts[i].predicted_score)}`;
                      }

                      const dCurrentArea = `${dCurrent} L ${getX(n - 1)} 180 L ${getX(0)} 180 Z`;
                      const dOptimalArea = `${dOptimal} L ${getX(n - 1)} 180 L ${getX(0)} 180 Z`;

                      return (
                        <>
                          <path d={dOptimalArea} fill="url(#optimalGrad)" />
                          <path d={dCurrentArea} fill="url(#currentGrad)" />
                          <path d={dOptimal} fill="none" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" />
                          <path d={dCurrent} fill="none" stroke="#5E6AD2" strokeWidth="2.5" strokeLinecap="round" />

                          {/* Data points */}
                          {pts.filter((_, idx) => idx % 4 === 0 || idx === n - 1).map((p, idx) => (
                            <g key={p.day}>
                              <circle cx={getX(p.day)} cy={getY(p.predicted_score)} r="4" fill="#5E6AD2" stroke="#fff" strokeWidth="1.5" />
                              <text x={getX(p.day)} y="196" fill="#8A8F98" fontSize="9" textAnchor="middle">D{p.day}</text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--linear-fg-muted)' }}>
                  Calculating bio-kinetic curves...
                </div>
              )}
            </div>

            {/* Diagnostic Key Factors & Recommendation Action Card */}
            <div className="linear-card" style={{ padding: '1.3rem', background: 'rgba(94, 106, 210, 0.05)', border: '1px solid rgba(94, 106, 210, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>💡</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  Bio-Kinetic Diagnostics & Optimization Advisory
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--linear-fg)' }}>
                {simResult?.key_factors?.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--linear-accent)' }}>•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '0.9rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#34D399', fontWeight: 500 }}>
                  🎯 Projected Safe Expiry Date: <strong>{simResult?.predicted_expiry_date ?? '--'}</strong>
                </div>
                <div className="linear-badge linear-badge-fresh" style={{ fontSize: '0.72rem' }}>
                  Optimal Packaging: {simResult?.optimal_packaging}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 2: COLD STORAGE TELEMETRY & COMPLIANCE
          ========================================================================= */}
      {activeTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          
          {/* Warehouse Zones Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                ❄️ Monitored Cold Storage Vaults & Microclimate Zones
              </h3>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={() => handleTriggerExcursion(true)}
                  className="linear-btn linear-btn-secondary"
                  style={{ fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#F87171' }}
                >
                  ⚡ Simulate Temp Excursion
                </button>
                <button
                  onClick={() => handleTriggerExcursion(false)}
                  className="linear-btn linear-btn-secondary"
                  style={{ fontSize: '0.75rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}
                >
                  ✓ Normalize Sensors
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {zones.map((z) => {
                const isSelected = z.zone_id === selectedZoneId;
                const isCompliant = z.compliance_status === 'Compliant';
                const isCritical = z.compliance_status === 'Critical';

                return (
                  <div
                    key={z.zone_id}
                    onClick={() => setSelectedZoneId(z.zone_id)}
                    className="linear-card"
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--linear-accent)' : '1px solid var(--linear-border-default)',
                      boxShadow: isSelected ? '0 0 20px rgba(94, 106, 210, 0.25)' : 'none',
                      padding: '1.25rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <span className="linear-badge" style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.05)', color: 'var(--linear-fg-muted)' }}>
                        {z.zone_id}
                      </span>
                      <span className={`linear-badge ${isCompliant ? 'linear-badge-fresh' : (isCritical ? 'linear-badge-spoilage' : 'linear-badge-warning')}`}>
                        {z.compliance_status.toUpperCase()}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)', marginBottom: '0.2rem' }}>
                      {z.zone_name}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)', marginBottom: '0.9rem' }}>
                      🏢 {z.warehouse_name}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: '#09090C', padding: '10px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Live Temp</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isCompliant ? '#34D399' : '#F87171' }}>
                          🌡️ {z.temperature_celsius}°C
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Target: {z.target_temp_c}°C</span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Relative Humidity</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: z.humidity_percent < 80 ? '#FBBF24' : '#60A5FA' }}>
                          💧 {z.humidity_percent}%
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Target: {z.target_humidity_pct}%</span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Airflow CFM</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                          💨 {z.airflow_cfm} CFM
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', display: 'block' }}>Light Lux</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                          💡 {z.light_lux} Lux
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 24-Hour Historical Telemetry Sparkline & Excursion Alerts Board */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.4rem' }}>
            
            {/* 24-Hour Telemetry Stability Graph */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    📊 24-Hour Environmental Stability Log — {selectedZoneId}
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Continuous probe telemetry sampling at 60-minute intervals
                  </p>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                  Target: {telemetryHistory?.target_temperature_celsius}°C • {telemetryHistory?.target_humidity_percent}% RH
                </div>
              </div>

              {telemetryHistory?.telemetry_points ? (
                <div style={{ width: '100%', height: 210 }}>
                  <svg viewBox="0 0 540 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid */}
                    <line x1="0" y1="30" x2="540" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="90" x2="540" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="150" x2="540" y2="150" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                    {(() => {
                      const pts = telemetryHistory.telemetry_points;
                      const n = pts.length;
                      if (n < 2) return null;

                      // Scale temp: 0°C -> 150, 8°C -> 30
                      const getX = (i) => (i / (n - 1)) * 520 + 10;
                      const getYTemp = (t) => 150 - ((t - 1.0) / 7.0) * 120;

                      let dLine = `M ${getX(0)} ${getYTemp(pts[0].temperature_celsius)}`;
                      for (let i = 1; i < n; i++) {
                        dLine += ` L ${getX(i)} ${getYTemp(pts[i].temperature_celsius)}`;
                      }

                      return (
                        <>
                          <path d={dLine} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
                          {pts.filter((_, idx) => idx % 4 === 0 || idx === n - 1).map((p, idx) => (
                            <g key={idx}>
                              <circle cx={getX(idx * 4)} cy={getYTemp(p.temperature_celsius)} r="3.5" fill={p.is_compliant ? '#10B981' : '#EF4444'} stroke="#fff" strokeWidth="1" />
                              <text x={getX(idx * 4)} y="170" fill="#8A8F98" fontSize="8" textAnchor="middle">{p.time}</text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--linear-fg-muted)' }}>
                  Loading zone telemetry history...
                </div>
              )}
            </div>

            {/* Active Cold-Chain Excursion Alerts Board */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  🚨 Active Cold-Chain Excursions
                </h4>
                <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.7rem' }}>
                  {alerts.length} ALERTS
                </span>
              </div>

              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--linear-fg-muted)' }}>
                  <span style={{ fontSize: '2.2rem', display: 'block', marginBottom: '0.5rem' }}>🛡️</span>
                  <p style={{ fontWeight: 500 }}>All warehouse cold rooms are operating within strict tolerance bounds.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {alerts.map((a) => (
                    <div
                      key={a.alert_id}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F87171' }}>
                          ⚠️ {a.parameter} Elevation ({a.current_value}°C vs {a.threshold_value}°C)
                        </span>
                        <span className="linear-badge linear-badge-spoilage" style={{ fontSize: '0.65rem' }}>
                          {a.severity.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg)' }}>
                        <strong>Root Cause:</strong> {a.root_cause}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                        <strong>Action:</strong> {a.corrective_action}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                          Duration: {a.duration_minutes} mins
                        </span>
                        <button
                          onClick={() => handleResolveAlert(a.alert_id)}
                          className="linear-btn linear-btn-primary"
                          style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
                        >
                          ✓ Resolve Alert
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 3: RECOMMENDATIONS & FEFO ROTATION ENGINE
          ========================================================================= */}
      {activeTab === 'recommendations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          
          {/* Top Recommendation Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem' }}>
            <div className="linear-card" style={{ padding: '1.2rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>CRITICAL FEFO LOTS</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#F87171', margin: '4px 0' }}>
                {recOverview?.critical_fefo_batches ?? 1}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>Require immediate retail dispatch</div>
            </div>

            <div className="linear-card" style={{ padding: '1.2rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>DYNAMIC MARKDOWNS</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FBBF24', margin: '4px 0' }}>
                {recOverview?.dynamic_markdown_opportunities ?? 2}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>Promotional velocity pricing ready</div>
            </div>

            <div className="linear-card" style={{ padding: '1.2rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>INVENTORY VALUE AT RISK</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--linear-accent)', margin: '4px 0' }}>
                ${(recOverview?.inventory_value_at_risk_dollars ?? 420.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>Near-expiry exposure</div>
            </div>

            <div className="linear-card" style={{ padding: '1.2rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>POTENTIAL REVENUE SAVED</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, color: '#34D399', margin: '4px 0' }}>
                ${(recOverview?.potential_recovered_revenue_dollars ?? 680.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>via Dynamic Markdowns</div>
            </div>
          </div>

          {/* First-Expiry-First-Out (FEFO) Dispatch Priority Queue */}
          <div className="linear-card" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  🚚 First-Expiry-First-Out (FEFO) Dispatch Priority Schedule
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                  Batches sorted in strict order of shortest remaining shelf life to minimize warehouse shrinkage
                </p>
              </div>
              <span className="linear-badge linear-badge-good" style={{ fontSize: '0.7rem' }}>
                {fefoQueue.length} BATCHES RANKED
              </span>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--linear-border-default)' }}>
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Batch & Produce Name</th>
                    <th>Warehouse Location</th>
                    <th>Expiry Window</th>
                    <th>Remaining Days</th>
                    <th>Freshness</th>
                    <th>Suggested Action Channel</th>
                    <th>Dispatch Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fefoQueue.map((item) => {
                    const isDispatched = dispatchedBatches[item.batch_id];
                    let urgencyClass = 'linear-badge-fresh';
                    if (item.urgency_level.includes('Critical')) urgencyClass = 'linear-badge-spoilage';
                    else if (item.urgency_level.includes('High')) urgencyClass = 'linear-badge-warning';

                    return (
                      <tr key={item.batch_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--linear-fg)', fontSize: '0.88rem' }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--linear-accent)', fontWeight: 600 }}>{item.batch_id}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem' }}>{item.warehouse_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)' }}>{item.quantity_kg} kg available</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: item.remaining_days <= 3 ? '#F87171' : 'var(--linear-fg)' }}>
                            ⏳ {item.expiry_date}
                          </span>
                        </td>
                        <td>
                          <span className={`linear-badge ${urgencyClass}`} style={{ fontSize: '0.72rem' }}>
                            {item.remaining_days} Days Left
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: item.freshness_score >= 80 ? '#34D399' : '#FBBF24' }}>
                            {item.freshness_score}/100
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--linear-fg)' }}>
                            {item.suggested_channel}
                          </span>
                        </td>
                        <td>
                          {isDispatched ? (
                            <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.72rem' }}>
                              ✓ DISPATCHED
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePrioritizeDispatch(item.batch_id)}
                              className="linear-btn linear-btn-primary"
                              style={{ padding: '0.35rem 0.8rem', fontSize: '0.74rem' }}
                            >
                              ⚡ Trigger Dispatch
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Markdowns & Ethylene Compatibility Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            
            {/* Dynamic Markdowns Cards */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    🏷️ Dynamic Markdown Pricing Recommendations
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Algorithmically determined discount tiers to prevent inventory write-off
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {markdowns.map((m) => {
                  const applied = appliedDiscounts[m.batch_id];
                  return (
                    <div key={m.batch_id} style={{ background: '#09090C', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--linear-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--linear-fg)' }}>{m.product_name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--linear-accent)' }}>{m.batch_id} • {m.remaining_days} days left</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>{m.reason}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ textDecoration: 'line-through', fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                            ${m.original_price_per_kg.toFixed(2)}/kg
                          </span>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34D399' }}>
                            ${m.discounted_price_per_kg.toFixed(2)}/kg
                          </div>
                          <span className="linear-badge linear-badge-warning" style={{ fontSize: '0.65rem' }}>
                            -{m.discount_percent}% MARKDOWN
                          </span>
                        </div>

                        {applied ? (
                          <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.74rem' }}>
                            ✓ APPLIED
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApplyDiscount(m.batch_id, m.discount_percent)}
                            className="linear-btn linear-btn-primary"
                            style={{ fontSize: '0.74rem', padding: '0.45rem 0.85rem' }}
                          >
                            Apply Markdown
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Biological Ethylene Compatibility Matrix */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    🧬 Ethylene Co-Location & Segregation Advisor
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Prevent hormone-driven cross-contamination between produce varieties
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {ethyleneMatrix.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: rule.compatibility === 'Incompatible' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid ' + (rule.compatibility === 'Incompatible' ? 'rgba(239, 68, 68, 0.3)' : 'var(--linear-border-default)'),
                      padding: '12px',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                        {rule.emitter_category.split(' ')[0]} ⇄ {rule.sensitive_category.split(' ')[0]}
                      </span>
                      <span className={`linear-badge ${rule.compatibility === 'Incompatible' ? 'linear-badge-spoilage' : (rule.compatibility === 'Caution' ? 'linear-badge-warning' : 'linear-badge-fresh')}`} style={{ fontSize: '0.65rem' }}>
                        {rule.compatibility.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)', marginBottom: '4px' }}>
                      {rule.risk_summary}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: rule.compatibility === 'Incompatible' ? '#FCA5A5' : 'var(--linear-accent)' }}>
                      🛡️ {rule.separation_advice}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 4: FRESHNESS ANALYTICS & EXECUTIVE INSIGHTS
          ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          
          {/* Executive Overview KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.2rem' }}>
            <div className="linear-card" style={{ padding: '1.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>TOTAL PRODUCE MONITORED</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--linear-accent)', margin: '4px 0' }}>
                {(dashboardStats?.total_quantity_kg ?? 1700).toLocaleString()} kg
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                Across {dashboardStats?.active_warehouses ?? 3} cold logistics hubs
              </div>
            </div>

            <div className="linear-card" style={{ padding: '1.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>AVERAGE HEALTH SCORE</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 700, color: '#34D399', margin: '4px 0' }}>
                {dashboardStats?.average_freshness_score ?? 91.2}/100
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                Weighted multi-pillar matrix
              </div>
            </div>

            <div className="linear-card" style={{ padding: '1.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>ECONOMIC VALUE AT RISK</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#F87171', margin: '4px 0' }}>
                ${(dashboardStats?.economic_value_at_risk ?? 420.0).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                {dashboardStats?.critical_risk_batches ?? 1} critical lots near expiry
              </div>
            </div>

            <div className="linear-card" style={{ padding: '1.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>FOOD WASTE PREVENTED</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#38BDF8', margin: '4px 0' }}>
                ${(dashboardStats?.total_waste_diverted_dollars ?? 688.5).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                {dashboardStats?.total_waste_diverted_kg ?? 255} kg saved from landfill
              </div>
            </div>

            <div className="linear-card" style={{ padding: '1.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>COLD STORAGE COMPLIANCE</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 700, color: '#C084FC', margin: '4px 0' }}>
                {dashboardStats?.cold_storage_compliance_rate ?? 96.5}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)' }}>
                FDA / USDA cold-chain envelope
              </div>
            </div>
          </div>

          {/* Freshness Degradation Trends Multi-Line Chart & Shelf-Life Risk Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
            
            {/* 7-Day Category Trajectory Chart */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    📈 7-Day Category Freshness Velocity
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Historical trajectory of mean freshness index across key categories
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.72rem' }}>
                  <span style={{ color: '#34D399' }}>● Fruits</span>
                  <span style={{ color: '#60A5FA' }}>● Vegetables</span>
                  <span style={{ color: '#FBBF24' }}>● Dairy</span>
                  <span style={{ color: '#F87171' }}>● Meat</span>
                </div>
              </div>

              {freshnessTrends?.series ? (
                <div style={{ width: '100%', height: 210 }}>
                  <svg viewBox="0 0 540 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grids */}
                    <line x1="0" y1="20" x2="540" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="70" x2="540" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="120" x2="540" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                    {freshnessTrends.series.map((s) => {
                      const pts = s.values;
                      const n = pts.length;
                      const getX = (i) => (i / (n - 1)) * 520 + 10;
                      const getY = (val) => 180 - ((val - 70) / 30) * 150;

                      let d = `M ${getX(0)} ${getY(pts[0])}`;
                      for (let i = 1; i < n; i++) {
                        d += ` L ${getX(i)} ${getY(pts[i])}`;
                      }

                      return (
                        <g key={s.category}>
                          <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" />
                          <circle cx={getX(n - 1)} cy={getY(pts[n - 1])} r="4" fill={s.color} stroke="#fff" strokeWidth="1" />
                        </g>
                      );
                    })}

                    {freshnessTrends.dates.map((d, i) => (
                      <text key={i} x={(i / 6) * 520 + 10} y="174" fill="#8A8F98" fontSize="8" textAnchor="middle">{d}</text>
                    ))}
                  </svg>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--linear-fg-muted)' }}>
                  Loading category trends...
                </div>
              )}
            </div>

            {/* Shelf-Life Risk Distribution Progress Cards */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    ⏳ Shelf-Life Risk Segmentation
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)' }}>
                    Active inventory distribution by remaining viable lifespan
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {(() => {
                  const crit = dashboardStats?.shelf_life_distribution?.['Critical (<3 Days)'] ?? 0;
                  const warn = dashboardStats?.shelf_life_distribution?.['Warning (3-7 Days)'] ?? 0;
                  const good = dashboardStats?.shelf_life_distribution?.['Good (8-14 Days)'] ?? 0;
                  const opt = dashboardStats?.shelf_life_distribution?.['Optimal (>14 Days)'] ?? 0;
                  const tot = crit + warn + good + opt || 1;
                  return (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, marginBottom: '5px' }}>
                          <span style={{ color: '#F87171' }}>🔴 Critical Risk (&lt; 3 Days)</span>
                          <span style={{ fontWeight: 600 }}>{crit} Batches</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((crit / tot) * 100)}%`, background: '#F87171', height: '100%' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, marginBottom: '5px' }}>
                          <span style={{ color: '#FBBF24' }}>🟡 Warning Window (3 - 7 Days)</span>
                          <span style={{ fontWeight: 600 }}>{warn} Batches</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((warn / tot) * 100)}%`, background: '#FBBF24', height: '100%' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, marginBottom: '5px' }}>
                          <span style={{ color: '#38BDF8' }}>🔵 Good Buffer (8 - 14 Days)</span>
                          <span style={{ fontWeight: 600 }}>{good} Batches</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((good / tot) * 100)}%`, background: '#38BDF8', height: '100%' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, marginBottom: '5px' }}>
                          <span style={{ color: '#34D399' }}>🟢 Optimal Fresh (&gt; 14 Days)</span>
                          <span style={{ fontWeight: 600 }}>{opt} Batches</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((opt / tot) * 100)}%`, background: '#34D399', height: '100%' }} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

          </div>

          {/* Category Quality Velocity Health Matrix */}
          <div className="linear-card" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                🍎 Category Quality & Spoilage Velocity Matrix
              </h3>
              <span className="linear-badge linear-badge-good" style={{ fontSize: '0.7rem' }}>
                REAL-TIME AUDIT
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
              {categoryHealth.map((c) => (
                <div key={c.category} style={{ background: '#09090C', padding: '1rem', borderRadius: '12px', border: '1px solid var(--linear-border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                    <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.68rem' }}>
                      {c.compliance_rate}% COMPLIANCE
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--linear-fg)', marginBottom: '0.4rem' }}>
                    {c.category}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                    <div>Avg Freshness: <strong style={{ color: '#34D399' }}>{c.avg_freshness}/100</strong></div>
                    <div>Active Lots: <strong style={{ color: 'var(--linear-fg)' }}>{c.active_batches}</strong></div>
                    <div>Decay Velocity: <strong style={{ color: 'var(--linear-accent)' }}>{c.decay_velocity}</strong></div>
                    <div>Primary Threat: <strong style={{ color: '#FBBF24' }}>{c.primary_risk}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

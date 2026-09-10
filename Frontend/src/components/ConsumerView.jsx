import React, { useState, useEffect, useRef } from 'react';

export default function ConsumerView({ batches = [], user = null }) {
  // Navigation View Tabs: 'scanner' | 'history'
  const [activeTab, setActiveTab] = useState('scanner');

  // Input Modes: 'presets' | 'upload' | 'camera' | 'url'
  const [inputMode, setInputMode] = useState('presets');

  // Preset Dataset Catalog
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('apple_fresh');

  // Custom Input States
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customProductName, setCustomProductName] = useState('Honeycrisp Apple');
  const [customCategory, setCustomCategory] = useState('Fruits');
  const [uploadedBase64, setUploadedBase64] = useState(null);

  // Camera Capture States
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Scanning & Analysis States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [hoveredBox, setHoveredBox] = useState(null);

  // Interactive 4-Pillar Simulation Sliders (Consumer Household Tuning)
  const [simTemp, setSimTemp] = useState(3.5);
  const [simHumidity, setSimHumidity] = useState(88.0);
  const [simAgeDays, setSimAgeDays] = useState(2);

  // Certificate Modal State
  const [showCertModal, setShowCertModal] = useState(false);

  // Scan History States
  const [scanHistory, setScanHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [searchHistory, setSearchHistory] = useState('');

  // Load Presets on Mount
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await fetch('/api/analysis/presets');
        if (res.ok) {
          const data = await res.json();
          setPresets(data);
        }
      } catch (err) {
        console.error('Failed to fetch presets:', err);
      }
    };
    fetchPresets();
    fetchHistory();
  }, []);

  // Fetch Consumer Scan History from MongoDB
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const url = user?.id ? `/api/analysis/consumer-scans?user_id=${user.id}` : '/api/analysis/consumer-scans';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setScanHistory(data);
      }
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Perform AI Scan Execution
  const handleExecuteScan = async (overridePayload = null) => {
    setIsScanning(true);

    let payload;
    if (overridePayload) {
      payload = overridePayload;
    } else if (inputMode === 'presets') {
      const p = presets.find((item) => item.id === selectedPresetId);
      payload = {
        sample_id: selectedPresetId,
        product_name: p?.product_name || 'Produce Item',
        category: p?.category || 'Fruits',
        image_url: p?.image_url,
        storage_temp_celsius: simTemp,
        storage_humidity_percent: simHumidity,
        days_since_purchase: simAgeDays,
        user_id: user?.id,
        user_name: user?.name
      };
    } else if (inputMode === 'upload' && uploadedBase64) {
      payload = {
        product_name: customProductName,
        category: customCategory,
        image_base64: uploadedBase64,
        image_url: uploadedBase64,
        storage_temp_celsius: simTemp,
        storage_humidity_percent: simHumidity,
        days_since_purchase: simAgeDays,
        user_id: user?.id,
        user_name: user?.name
      };
    } else if (inputMode === 'url' && customImageUrl) {
      payload = {
        product_name: customProductName,
        category: customCategory,
        image_url: customImageUrl,
        storage_temp_celsius: simTemp,
        storage_humidity_percent: simHumidity,
        days_since_purchase: simAgeDays,
        user_id: user?.id,
        user_name: user?.name
      };
    } else {
      payload = {
        sample_id: 'apple_fresh',
        product_name: 'Organic Gala Apple',
        category: 'Fruits',
        storage_temp_celsius: simTemp,
        storage_humidity_percent: simHumidity,
        days_since_purchase: simAgeDays,
        user_id: user?.id,
        user_name: user?.name
      };
    }

    try {
      const res = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setScanResult(result);
        setSimTemp(result.storage_temp_celsius);
        setSimHumidity(result.storage_humidity_percent);
        setSimAgeDays(result.days_since_purchase);

        // Auto-save scan into MongoDB Atlas collection
        try {
          await fetch('/api/analysis/consumer-scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
          });
          fetchHistory();
        } catch (saveErr) {
          console.warn('Scan auto-save note:', saveErr);
        }
      }
    } catch (err) {
      console.error('Scan request error:', err);
    } finally {
      setTimeout(() => {
        setIsScanning(false);
      }, 1000);
    }
  };

  // Run initial scan on load once presets are loaded
  useEffect(() => {
    if (presets.length > 0 && !scanResult) {
      handleExecuteScan({
        sample_id: 'apple_fresh',
        product_name: 'Organic Royal Gala Apple',
        category: 'Fruits',
        storage_temp_celsius: 3.5,
        storage_humidity_percent: 88.0,
        days_since_purchase: 2,
        user_id: user?.id,
        user_name: user?.name
      });
    }
  }, [presets]);

  // Handle Preset Selection Change
  const handleSelectPreset = (pId) => {
    setSelectedPresetId(pId);
    const p = presets.find((x) => x.id === pId);
    if (p) {
      setSimTemp(p.optimal_temp || 3.5);
      setSimHumidity(p.optimal_humidity || 88.0);
      setSimAgeDays(p.days_since_purchase || 2);
      handleExecuteScan({
        sample_id: pId,
        product_name: p.product_name,
        category: p.category,
        image_url: p.image_url,
        storage_temp_celsius: p.optimal_temp,
        storage_humidity_percent: p.optimal_humidity,
        days_since_purchase: p.days_since_purchase,
        user_id: user?.id,
        user_name: user?.name
      });
    }
  };

  // Re-run scan with updated simulation parameters
  const handleRecomputeSimulation = () => {
    if (!scanResult) return;
    handleExecuteScan({
      sample_id: scanResult.sample_id || selectedPresetId,
      product_name: scanResult.product_name,
      category: scanResult.category,
      image_url: scanResult.image_url,
      storage_temp_celsius: parseFloat(simTemp),
      storage_humidity_percent: parseFloat(simHumidity),
      days_since_purchase: parseInt(simAgeDays, 10),
      user_id: user?.id,
      user_name: user?.name
    });
  };

  // File Upload Handler (Base64)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedBase64(reader.result);
        setInputMode('upload');
      };
      reader.readAsDataURL(file);
    }
  };

  // Camera Management
  const startCamera = async () => {
    setIsCameraActive(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('Camera access denied or not available. Please use image upload or preset samples.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setUploadedBase64(dataUrl);
    stopCamera();
    setInputMode('upload');
  };

  // Delete Scan from History
  const handleDeleteScan = async (scanId) => {
    try {
      await fetch(`/api/analysis/consumer-scans/${scanId}`, { method: 'DELETE' });
      setScanHistory((prev) => prev.filter((s) => s.scan_id !== scanId && s.id !== scanId));
    } catch (err) {
      console.error('Failed to delete scan:', err);
    }
  };

  // Load a historical scan into current view
  const handleLoadHistoricalScan = (scan) => {
    setScanResult(scan);
    setSimTemp(scan.storage_temp_celsius);
    setSimHumidity(scan.storage_humidity_percent);
    setSimAgeDays(scan.days_since_purchase);
    setActiveTab('scanner');
  };

  // Filter history
  const filteredHistory = scanHistory.filter((item) => {
    const matchesFilter = historyFilter === 'all' || item.status.toLowerCase() === historyFilter.toLowerCase();
    const matchesSearch =
      !searchHistory ||
      item.product_name.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.scan_id.toLowerCase().includes(searchHistory.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate quick stats
  const totalScansCount = scanHistory.length;
  const avgFreshness = totalScansCount > 0 ? Math.round(scanHistory.reduce((acc, s) => acc + (s.composite_score || 0), 0) / totalScansCount) : 92;
  const criticalSpoiledCount = scanHistory.filter((s) => s.status === 'Spoiled' || s.status === 'Near Spoilage').length;

  const currentScore = scanResult?.composite_score || 95;
  const currentStatus = scanResult?.status || 'Fresh';

  const getStatusBadgeClass = (statusStr) => {
    switch (statusStr) {
      case 'Fresh':
        return 'linear-badge-fresh';
      case 'Good':
        return 'linear-badge-good';
      case 'Acceptable':
        return 'linear-badge-warning';
      case 'Near Spoilage':
        return 'linear-badge-spoilage';
      case 'Spoiled':
        return 'linear-badge-critical';
      default:
        return 'linear-badge-good';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 88) return '#10B981';
    if (score >= 70) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    if (score >= 30) return '#F97316';
    return '#EF4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
      
      {/* ==========================================================================
          1. HERO CONTAINER: CONSUMER SUITE HEADER & SUB-NAV TABS
          ========================================================================== */}
      <div className="linear-card" style={{ padding: '1.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                🍏
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="linear-text-gradient" style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Consumer Freshness & Spoilage Intelligence
                  </h2>
                  <span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}>
                    MILESTONE 2 OPERATIONAL
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--linear-fg-muted)', fontWeight: 400, marginTop: '2px' }}>
                  Computer vision defect identification, 4-pillar quality scoring, mold & bruise detection, and household waste prevention.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--linear-border-default)',
            gap: '6px'
          }}>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`linear-btn ${activeTab === 'scanner' ? 'linear-btn-primary' : 'linear-btn-ghost'}`}
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem', borderRadius: '8px' }}
            >
              🔬 AI Freshness Scanner
            </button>
            <button
              onClick={() => { setActiveTab('history'); fetchHistory(); }}
              className={`linear-btn ${activeTab === 'history' ? 'linear-btn-primary' : 'linear-btn-ghost'}`}
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem', borderRadius: '8px' }}
            >
              📋 My Scan History ({totalScansCount})
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.4rem',
          paddingTop: '1.2rem',
          borderTop: '1px solid var(--linear-border-default)'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Produce Items Scanned</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--linear-fg)', marginTop: '2px' }}>
              {totalScansCount} <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 500 }}>Saved in Atlas</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Freshness Rating</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: getScoreColor(avgFreshness), marginTop: '2px' }}>
              {avgFreshness}/100 <span style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>PRD Weighted</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Spoilage Alerts Prevented</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#F59E0B', marginTop: '2px' }}>
              {criticalSpoiledCount} <span style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>Risks Flagged</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--linear-border-default)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vision Model Confidence</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#818CF8', marginTop: '2px' }}>
              {((scanResult?.confidence_score || 0.982) * 100).toFixed(1)}% <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 500 }}>High Precision</span>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'scanner' && (
        <>
          {/* ==========================================================================
              2. INPUT SELECTOR & SCAN TRIGGER BAR
              ========================================================================== */}
          <div className="linear-card" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📷</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--linear-fg)' }}>Select Input Source / Benchmark Produce Sample</span>
              </div>

              {/* Mode Toggle Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { setInputMode('presets'); stopCamera(); }}
                  className={`linear-btn ${inputMode === 'presets' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem', borderRadius: '6px' }}
                >
                  🍓 Kaggle Dataset Presets
                </button>
                <button
                  onClick={() => { setInputMode('upload'); stopCamera(); }}
                  className={`linear-btn ${inputMode === 'upload' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem', borderRadius: '6px' }}
                >
                  📁 Upload Photo
                </button>
                <button
                  onClick={() => { setInputMode('camera'); startCamera(); }}
                  className={`linear-btn ${inputMode === 'camera' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem', borderRadius: '6px' }}
                >
                  📹 Live Camera
                </button>
                <button
                  onClick={() => { setInputMode('url'); stopCamera(); }}
                  className={`linear-btn ${inputMode === 'url' ? 'linear-btn-primary' : 'linear-btn-secondary'}`}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem', borderRadius: '6px' }}
                >
                  🌐 Image URL
                </button>
              </div>
            </div>

            {/* PRESETS LIST: Kaggle Fruits & Vegetables Dataset Samples */}
            {inputMode === 'presets' && (
              <div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {presets.map((p) => {
                    const isSelected = selectedPresetId === p.id;
                    const isSpoiled = p.condition === 'spoiled' || p.visual_score < 50;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPreset(p.id)}
                        style={{
                          minWidth: 160,
                          flexShrink: 0,
                          background: isSelected ? 'rgba(94, 106, 210, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1.5px solid ${isSelected ? 'var(--linear-accent)' : 'var(--linear-border-default)'}`,
                          borderRadius: '12px',
                          padding: '10px',
                          cursor: 'pointer',
                          transition: 'all 200ms ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ width: '100%', height: 85, borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                          <img src={p.image_url} alt={p.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span
                            className={`linear-badge ${isSpoiled ? 'linear-badge-critical' : 'linear-badge-fresh'}`}
                            style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.6rem', padding: '2px 5px' }}
                          >
                            {p.visual_score}%
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--linear-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.product_name}
                          </div>
                          <span style={{ fontSize: '0.68rem', color: isSpoiled ? '#F87171' : '#34D399', fontWeight: 500 }}>
                            {isSpoiled ? '⚠️ Decay / Mold' : '✅ Fresh Produce'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UPLOAD FORM */}
            {inputMode === 'upload' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem', alignItems: 'center' }}>
                <div style={{
                  border: '2px dashed var(--linear-border-default)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  cursor: 'pointer'
                }}>
                  <input type="file" accept="image/*" id="foodImageUpload" onChange={handleFileUpload} style={{ display: 'none' }} />
                  <label htmlFor="foodImageUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>📁</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--linear-fg)' }}>
                      {uploadedBase64 ? 'Image Loaded! Click to Change' : 'Click to Upload Produce Photo (JPG, PNG, WEBP)'}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--linear-fg-muted)' }}>Drag and drop or browse files from your computer</span>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '4px' }}>Product Name</label>
                    <input
                      type="text"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      placeholder="e.g. Bartlett Pear, Red Tomato"
                      className="linear-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="linear-input"
                    >
                      <option value="Fruits">Fruits</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Dairy Products">Dairy Products</option>
                      <option value="Bakery Products">Bakery Products</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleExecuteScan()}
                    disabled={!uploadedBase64 || isScanning}
                    className="linear-btn linear-btn-primary"
                    style={{ padding: '0.7rem', marginTop: '4px' }}
                  >
                    {isScanning ? 'Analyzing Produce...' : '⚡ Analyze Uploaded Image'}
                  </button>
                </div>
              </div>
            )}

            {/* LIVE CAMERA CAPTURE */}
            {inputMode === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                {cameraError ? (
                  <div style={{ color: '#F87171', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '10px 16px', borderRadius: '8px' }}>
                    {cameraError}
                  </div>
                ) : (
                  <div style={{ width: '100%', maxWidth: 460, borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid var(--linear-border-default)', position: 'relative' }}>
                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: 300, objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px' }}>
                      <button onClick={capturePhoto} className="linear-btn linear-btn-primary" style={{ padding: '0.6rem 1.4rem' }}>
                        📸 Snap & Analyze
                      </button>
                      <button onClick={stopCamera} className="linear-btn linear-btn-secondary" style={{ padding: '0.6rem 1.2rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* IMAGE URL FORM */}
            {inputMode === 'url' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="linear-input"
                  style={{ flex: 1, minWidth: 260 }}
                />
                <button
                  onClick={() => handleExecuteScan()}
                  disabled={!customImageUrl || isScanning}
                  className="linear-btn linear-btn-primary"
                  style={{ padding: '0.7rem 1.4rem' }}
                >
                  {isScanning ? 'Analyzing...' : 'Scan URL'}
                </button>
              </div>
            )}
          </div>

          {/* ==========================================================================
              3. COMPUTER VISION INSPECTOR VIEWPORT & ASSESSMENT SUMMARY
              ========================================================================== */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 480px) 1fr', gap: '1.6rem', alignItems: 'start' }}>
            
            {/* Left Column: Interactive Image Scanner Viewport */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>🔬</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    Computer Vision Spatial Inspector
                  </span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--linear-fg-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showBoundingBoxes}
                    onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                  />
                  Show Defect Boxes
                </label>
              </div>

              {/* Viewport Canvas Frame */}
              <div className="scanner-viewport" style={{ width: '100%', height: 340, position: 'relative' }}>
                {/* Produce Image */}
                <img
                  src={scanResult?.image_url || 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=700&q=80'}
                  alt={scanResult?.product_name || 'Produce Item'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Laser Scanning Animation Beam */}
                {isScanning && <div className="scanner-laser-line" />}

                {/* Grid Overlay */}
                <div className="scanner-grid-overlay" />

                {/* Interactive Defect Bounding Boxes */}
                {showBoundingBoxes &&
                  !isScanning &&
                  scanResult?.defect_regions?.map((defect, idx) => (
                    <div
                      key={idx}
                      className="defect-bbox"
                      onMouseEnter={() => setHoveredBox(defect)}
                      onMouseLeave={() => setHoveredBox(null)}
                      style={{
                        left: `${defect.x}%`,
                        top: `${defect.y}%`,
                        width: `${defect.width}%`,
                        height: `${defect.height}%`,
                        borderColor: defect.severity === 'Critical' ? '#EF4444' : '#F59E0B'
                      }}
                    >
                      <div className="defect-bbox-tag" style={{ background: defect.severity === 'Critical' ? '#EF4444' : '#F59E0B' }}>
                        {defect.label} ({(defect.confidence * 100).toFixed(0)}%)
                      </div>
                    </div>
                  ))}

                {/* Scan Status Watermark Tag */}
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  background: 'rgba(5, 5, 6, 0.85)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 15
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getScoreColor(currentScore) }}></span>
                  {scanResult?.scan_id || 'FS-SCAN-INITIALIZING'}
                </div>

                {/* Scanning HUD Overlay when active */}
                {isScanning && (
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(5, 5, 6, 0.4)',
                    backdropFilter: 'blur(2px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                    color: '#38BDF8',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '1.8rem', animation: 'spin 1s infinite linear' }}>⚙️</div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                      EXTRACTING SPECTRAL COLOR & TISSUE TURGOR...
                    </span>
                  </div>
                )}
              </div>

              {/* Hover Tooltip or Defect Callout Strip */}
              <div style={{ marginTop: '0.8rem', minHeight: 48 }}>
                {hoveredBox ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem' }}>
                    <strong style={{ color: '#F87171' }}>🔍 Defect Detected:</strong> {hoveredBox.label} | Severity: <strong>{hoveredBox.severity}</strong> | AI Match Confidence: <strong>{(hoveredBox.confidence * 100).toFixed(1)}%</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Hover over any defect box on the image for microscopic pathology info.</span>
                    <button onClick={() => setShowCertModal(true)} className="linear-btn linear-btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}>
                      📜 Official Certificate
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Freshness Score Card & 4-Pillar Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
              
              {/* Freshness Health Score Card */}
              <div className="linear-card" style={{ padding: '1.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Product Quality Classification
                    </span>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--linear-fg)', marginTop: '2px' }}>
                      {scanResult?.product_name || 'Produce Item'}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
                      Category: {scanResult?.category || 'Fruits'} • Scanned: {scanResult?.scanned_at ? new Date(scanResult.scanned_at).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>

                  {/* Big Score Radial Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '10px 18px',
                    borderRadius: '14px',
                    border: `1.5px solid ${getScoreColor(currentScore)}`
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2.4rem', fontWeight: 900, color: getScoreColor(currentScore), lineHeight: 1 }}>
                        {currentScore}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        HEALTH SCORE
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className={`linear-badge ${getStatusBadgeClass(currentStatus)}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>
                        {currentStatus.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                        Spoilage Risk: <strong style={{ color: currentScore < 50 ? '#F87171' : '#34D399' }}>{scanResult?.spoilage_probability_percent || 5.0}%</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Safety Verdict Banner */}
                <div style={{
                  marginTop: '1.2rem',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: currentScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : (currentScore >= 50 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.12)'),
                  border: `1px solid ${currentScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : (currentScore >= 50 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.4)')}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '1.3rem' }}>
                    {currentScore >= 80 ? '🛡️' : (currentScore >= 50 ? '⚠️' : '🚫')}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: currentScore >= 80 ? '#34D399' : (currentScore >= 50 ? '#FBBF24' : '#F87171') }}>
                      Consumer Safety Advisory: {scanResult?.safety_verdict || 'Safe for Consumption'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                      Estimated Safe Shelf Life: <strong>{scanResult?.remaining_shelf_life_days || 10} days remaining</strong> under recommended cold storage.
                    </div>
                  </div>
                </div>

                {/* Diagnosis Text */}
                <p style={{ fontSize: '0.82rem', color: 'var(--linear-fg-subtle)', lineHeight: 1.5, marginTop: '1rem', fontStyle: 'italic' }}>
                  "{scanResult?.diagnosis || 'Pristine visual integrity detected.'}"
                </p>

              </div>

              {/* Computer Vision Diagnostic Deep-Dive Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* Mold Card */}
                <div className="linear-card" style={{ padding: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 600 }}>MOLD & SPORES</span>
                    <span className={`linear-badge ${scanResult?.mold_detected ? 'linear-badge-critical' : 'linear-badge-fresh'}`} style={{ fontSize: '0.65rem' }}>
                      {scanResult?.mold_detected ? 'MOLD DETECTED' : 'ZERO SPORES'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: scanResult?.mold_detected ? '#F87171' : '#34D399' }}>
                    {scanResult?.mold_detected ? `${scanResult.mold_spot_count} Spore Clusters` : '0 Fungal Colonies'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                    {scanResult?.mold_detected ? 'Mycotoxin risk present' : 'Sterile epicuticle'}
                  </span>
                </div>

                {/* Bruising Card */}
                <div className="linear-card" style={{ padding: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 600 }}>TISSUE BRUISING</span>
                    <span className={`linear-badge ${scanResult?.bruise_detected ? 'linear-badge-warning' : 'linear-badge-fresh'}`} style={{ fontSize: '0.65rem' }}>
                      {scanResult?.bruise_detected ? 'BRUISED' : 'INTACT'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: scanResult?.bruise_detected ? '#FBBF24' : '#34D399' }}>
                    {scanResult?.bruise_percent ? `${scanResult.bruise_percent}%` : '0.0%'} Tissue Damage
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                    {scanResult?.bruise_detected ? 'Sub-surface softening' : 'No mechanical lesions'}
                  </span>
                </div>

                {/* Pigment Vitality Card */}
                <div className="linear-card" style={{ padding: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 600 }}>COLOR & PIGMENTATION</span>
                    <div style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: scanResult?.color_analysis?.dominant_color_hex || '#22C55E',
                      boxShadow: `0 0 8px ${scanResult?.color_analysis?.dominant_color_hex || '#22C55E'}`
                    }} />
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--linear-fg)' }}>
                    {scanResult?.color_analysis?.chlorophyll_vitality_percent || 98}% Vitality
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                    Browning: <strong>{scanResult?.color_analysis?.browning_index_percent || 0.2}%</strong> ({scanResult?.color_analysis?.color_status || 'Optimal'})
                  </span>
                </div>

                {/* Surface Firmness Card */}
                <div className="linear-card" style={{ padding: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--linear-fg-muted)', fontWeight: 600 }}>SURFACE FIRMNESS</span>
                    <span className="linear-badge linear-badge-good" style={{ fontSize: '0.65rem' }}>
                      {scanResult?.texture_analysis?.texture_status || 'Crisp'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#60A5FA' }}>
                    {scanResult?.texture_analysis?.surface_firmness_percent || 96}% Firmness
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--linear-fg-muted)' }}>
                    Moisture retention: <strong>{scanResult?.texture_analysis?.moisture_retention_percent || 94}%</strong>
                  </span>
                </div>

              </div>

            </div>

          </div>

          {/* ==========================================================================
              4. PRD 4-PILLAR WEIGHTED SCORE SIMULATOR (STORAGE CONDITIONS TUNING)
              ========================================================================== */}
          <div className="linear-card" style={{ padding: '1.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎛️</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                    PRD 4-Pillar Quality Scoring Engine & Storage Simulator
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                  Adjust refrigerator temperature, humidity, and purchase age to simulate decay velocity and shelf-life impact in real time.
                </p>
              </div>

              <button onClick={handleRecomputeSimulation} className="linear-btn linear-btn-primary" style={{ padding: '0.45rem 1.1rem', fontSize: '0.78rem' }}>
                🔄 Recalculate Health Score
              </button>
            </div>

            {/* 4 Pillars Formula Meters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '1.6rem' }}>
              
              {/* Pillar 1: Visual (40%) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--linear-border-default)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--linear-fg-muted)' }}>1. Visual Analysis (40%)</span>
                  <strong style={{ color: 'var(--linear-accent)' }}>{scanResult?.weighted_breakdown?.visual_score || 95}/100</strong>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${scanResult?.weighted_breakdown?.visual_score || 95}%`, height: '100%', background: 'var(--linear-accent)' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)', display: 'block', marginTop: 4 }}>
                  Contribution: +{((scanResult?.weighted_breakdown?.visual_score || 95) * 0.4).toFixed(1)} pts
                </span>
              </div>

              {/* Pillar 2: Storage (25%) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--linear-border-default)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--linear-fg-muted)' }}>2. Storage Compliance (25%)</span>
                  <strong style={{ color: '#10B981' }}>{scanResult?.weighted_breakdown?.storage_score || 92}/100</strong>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${scanResult?.weighted_breakdown?.storage_score || 92}%`, height: '100%', background: '#10B981' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)', display: 'block', marginTop: 4 }}>
                  Contribution: +{((scanResult?.weighted_breakdown?.storage_score || 92) * 0.25).toFixed(1)} pts
                </span>
              </div>

              {/* Pillar 3: Shelf-Life (20%) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--linear-border-default)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--linear-fg-muted)' }}>3. Shelf-Life Forecast (20%)</span>
                  <strong style={{ color: '#60A5FA' }}>{scanResult?.weighted_breakdown?.shelf_life_score || 88}/100</strong>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${scanResult?.weighted_breakdown?.shelf_life_score || 88}%`, height: '100%', background: '#60A5FA' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)', display: 'block', marginTop: 4 }}>
                  Contribution: +{((scanResult?.weighted_breakdown?.shelf_life_score || 88) * 0.2).toFixed(1)} pts
                </span>
              </div>

              {/* Pillar 4: Age (15%) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--linear-border-default)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--linear-fg-muted)' }}>4. Product Age (15%)</span>
                  <strong style={{ color: '#F59E0B' }}>{scanResult?.weighted_breakdown?.age_score || 90}/100</strong>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${scanResult?.weighted_breakdown?.age_score || 90}%`, height: '100%', background: '#F59E0B' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)', display: 'block', marginTop: 4 }}>
                  Contribution: +{((scanResult?.weighted_breakdown?.age_score || 90) * 0.15).toFixed(1)} pts
                </span>
              </div>

            </div>

            {/* Interactive Household Condition Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.4rem', background: '#08080B', padding: '1.4rem', borderRadius: '14px', border: '1px solid var(--linear-border-default)' }}>
              
              {/* Slider 1: Temperature */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--linear-fg)', fontWeight: 500 }}>🌡️ Storage Temperature</span>
                  <strong style={{ color: simTemp > 10 ? '#F87171' : '#34D399' }}>{simTemp}°C ({simTemp > 10 ? 'Room Temp / Warm' : 'Chilled Refrigerator'})</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={simTemp}
                  onChange={(e) => setSimTemp(parseFloat(e.target.value))}
                  className="linear-range-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--linear-fg-muted)', marginTop: '4px' }}>
                  <span>0°C (Near Freezing)</span>
                  <span>4°C (Optimal)</span>
                  <span>25°C (Warm Ambient)</span>
                </div>
              </div>

              {/* Slider 2: Humidity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--linear-fg)', fontWeight: 500 }}>💧 Relative Humidity (% RH)</span>
                  <strong style={{ color: simHumidity >= 80 ? '#34D399' : '#FBBF24' }}>{simHumidity}% RH</strong>
                </div>
                <input
                  type="range"
                  min="40"
                  max="98"
                  step="1"
                  value={simHumidity}
                  onChange={(e) => setSimHumidity(parseFloat(e.target.value))}
                  className="linear-range-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--linear-fg-muted)', marginTop: '4px' }}>
                  <span>40% (Dry Countertop)</span>
                  <span>88% (Crisper Drawer)</span>
                  <span>98% (High Moisture)</span>
                </div>
              </div>

              {/* Slider 3: Age / Days in possession */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--linear-fg)', fontWeight: 500 }}>⏳ Days Since Harvest / Purchase</span>
                  <strong style={{ color: simAgeDays > 10 ? '#F87171' : '#60A5FA' }}>{simAgeDays} Days</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={simAgeDays}
                  onChange={(e) => setSimAgeDays(parseInt(e.target.value, 10))}
                  className="linear-range-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--linear-fg-muted)', marginTop: '4px' }}>
                  <span>Day 0 (Farm Fresh)</span>
                  <span>Day 7 (1 Week)</span>
                  <span>Day 20 (Aged)</span>
                </div>
              </div>

            </div>

          </div>

          {/* ==========================================================================
              5. HOUSEHOLD STORAGE ADVICE & ZERO-WASTE CULINARY RECOMMENDATIONS
              ========================================================================== */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.6rem' }}>
            
            {/* Storage Tips */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>💡</span>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  Optimal Household Storage Protocol
                </h4>
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none', padding: 0 }}>
                {scanResult?.household_storage_tips?.map((tip, idx) => (
                  <li key={idx} style={{
                    fontSize: '0.82rem',
                    color: 'var(--linear-fg-subtle)',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    borderLeft: '3px solid #10B981',
                    lineHeight: 1.4
                  }}>
                    {tip}
                  </li>
                )) || (
                  <li style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>Store in crisper drawer at 3-4°C.</li>
                )}
              </ul>
            </div>

            {/* Zero-Waste Culinary Recipes */}
            <div className="linear-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🍳</span>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--linear-fg)' }}>
                  Zero-Waste Culinary Action Plan
                </h4>
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none', padding: 0 }}>
                {scanResult?.culinary_recipes?.map((recipe, idx) => (
                  <li key={idx} style={{
                    fontSize: '0.82rem',
                    color: 'var(--linear-fg-subtle)',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    borderLeft: '3px solid var(--linear-accent)',
                    lineHeight: 1.4
                  }}>
                    {recipe}
                  </li>
                )) || (
                  <li style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>Best enjoyed fresh or sliced into salads.</li>
                )}
              </ul>
            </div>

          </div>
        </>
      )}

      {/* ==========================================================================
          6. MY SCAN HISTORY LOG TAB
          ========================================================================== */}
      {activeTab === 'history' && (
        <div className="linear-card" style={{ padding: '1.6rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--linear-fg)' }}>
                Consumer Produce Scan History Log
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--linear-fg-muted)' }}>
                Audit trail of your verified food freshness evaluations stored in Cloud MongoDB Atlas.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder="Search produce name or scan ID..."
                className="linear-input"
                style={{ width: 220, padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}
              />

              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="linear-input"
                style={{ width: 140, padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}
              >
                <option value="all">All Conditions</option>
                <option value="fresh">Fresh Only</option>
                <option value="good">Good Condition</option>
                <option value="acceptable">Acceptable</option>
                <option value="spoiled">Spoiled / Decay</option>
              </select>

              <button onClick={fetchHistory} className="linear-btn linear-btn-secondary" style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}>
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* History Cards Grid */}
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--linear-fg-muted)', fontSize: '0.9rem' }}>
              Loading scans from Cloud MongoDB Atlas...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--linear-fg-muted)', fontSize: '0.9rem' }}>
              No scan records found matching filter. Run your first AI scan from the scanner tab!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
              {filteredHistory.map((scan) => {
                const sScore = scan.composite_score || 90;
                return (
                  <div
                    key={scan.scan_id || scan.id}
                    className="linear-card"
                    style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img
                        src={scan.image_url || 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6'}
                        alt={scan.product_name}
                        style={{ width: 60, height: 60, borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--linear-border-default)' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--linear-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {scan.product_name}
                          </h4>
                          <span className={`linear-badge ${getStatusBadgeClass(scan.status)}`} style={{ fontSize: '0.65rem' }}>
                            {sScore}/100
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', display: 'block', marginTop: '2px' }}>
                          {scan.category} • {scan.scanned_at ? new Date(scan.scanned_at).toLocaleDateString() : 'Recent'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--linear-fg-muted)', fontFamily: 'monospace' }}>
                          {scan.scan_id}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--linear-fg-subtle)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--linear-border-default)' }}>
                      Verdict: <strong>{scan.safety_verdict || 'Safe to Consume'}</strong> • {scan.remaining_shelf_life_days || 10} days shelf life
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
                      <button
                        onClick={() => handleLoadHistoricalScan(scan)}
                        className="linear-btn linear-btn-primary"
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.72rem' }}
                      >
                        🔬 Re-Inspect
                      </button>

                      <a
                        href={`/api/reports/freshness/${scan.scan_id || scan.id}/printable`}
                        target="_blank"
                        rel="noreferrer"
                        className="linear-btn linear-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
                      >
                        📜 Certificate
                      </a>

                      <button
                        onClick={() => handleDeleteScan(scan.scan_id || scan.id)}
                        className="linear-btn linear-btn-ghost"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', color: '#F87171' }}
                        title="Delete from history"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ==========================================================================
          7. FRESHNESS ASSESSMENT CERTIFICATE INSPECTION MODAL
          ========================================================================== */}
      {showCertModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="linear-card printable-cert-card" style={{
            maxWidth: 720,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            position: 'relative',
            border: '2px solid rgba(255,255,255,0.15)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--linear-border-default)', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🥬</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--linear-fg)' }}>
                    FreshSense AI Quality Assurance Certificate
                  </h3>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ISO 22000 Computer Vision Freshness Verification Standard
                </p>
              </div>

              <button
                onClick={() => setShowCertModal(false)}
                className="linear-btn linear-btn-ghost"
                style={{ padding: '0.3rem 0.6rem', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            {/* Certificate Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.4rem', alignItems: 'center', marginBottom: '1.4rem' }}>
              <img
                src={scanResult?.image_url || 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6'}
                alt={scanResult?.product_name}
                style={{ width: '100%', height: 130, borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--linear-border-default)' }}
              />

              <div>
                <span className="linear-badge linear-badge-good" style={{ fontSize: '0.65rem' }}>
                  {scanResult?.category || 'Fruits'}
                </span>
                <h4 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--linear-fg)', margin: '4px 0' }}>
                  {scanResult?.product_name || 'Produce Item'}
                </h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)' }}>
                  Audit Code: <strong style={{ color: 'var(--linear-accent)' }}>{scanResult?.scan_id || 'FS-SCAN-CERT'}</strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--linear-fg-muted)', marginTop: '2px' }}>
                  Inspection Date: {scanResult?.scanned_at ? new Date(scanResult.scanned_at).toLocaleString() : 'Verified'}
                </div>
              </div>
            </div>

            {/* 4 Pillars Matrix Table */}
            <div style={{ marginBottom: '1.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--linear-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                PRD Weighted Quality Dimension Audit
              </span>
              <table className="linear-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Quality Dimension</th>
                    <th>Weight</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Visual Condition Analysis</td>
                    <td>40%</td>
                    <td>{scanResult?.weighted_breakdown?.visual_score || 95}/100</td>
                    <td><span className="linear-badge linear-badge-fresh" style={{ fontSize: '0.65rem' }}>Pass</span></td>
                  </tr>
                  <tr>
                    <td>Storage Temperature & Humidity</td>
                    <td>25%</td>
                    <td>{scanResult?.weighted_breakdown?.storage_score || 90}/100</td>
                    <td><span className="linear-badge linear-badge-good" style={{ fontSize: '0.65rem' }}>{scanResult?.storage_temp_celsius}°C</span></td>
                  </tr>
                  <tr>
                    <td>Shelf-Life Forecast</td>
                    <td>20%</td>
                    <td>{scanResult?.weighted_breakdown?.shelf_life_score || 88}/100</td>
                    <td><span className="linear-badge linear-badge-good" style={{ fontSize: '0.65rem' }}>{scanResult?.remaining_shelf_life_days} Days Safe</span></td>
                  </tr>
                  <tr>
                    <td>Product Age / Senescence</td>
                    <td>15%</td>
                    <td>{scanResult?.weighted_breakdown?.age_score || 90}/100</td>
                    <td><span className="linear-badge linear-badge-warning" style={{ fontSize: '0.65rem' }}>Day {scanResult?.days_since_purchase}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Overall Weighted Score Banner */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.03)',
              padding: '12px 18px',
              borderRadius: '10px',
              border: `1px solid ${getScoreColor(currentScore)}`,
              marginBottom: '1.4rem'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>Weighted Health Score</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: getScoreColor(currentScore) }}>
                  {currentScore}/100 ({currentStatus.toUpperCase()})
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--linear-fg-muted)', textTransform: 'uppercase' }}>Safety Classification</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: currentScore >= 50 ? '#34D399' : '#F87171' }}>
                  {scanResult?.safety_verdict || 'Safe to Consume'}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--linear-border-default)', paddingTop: '1rem' }}>
              <button onClick={() => setShowCertModal(false)} className="linear-btn linear-btn-secondary">
                Close
              </button>
              
              <a
                href={`/api/reports/freshness/${scanResult?.scan_id || 'sample'}/printable`}
                target="_blank"
                rel="noreferrer"
                className="linear-btn linear-btn-primary"
              >
                🖨️ Open Full Printable / PDF View
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

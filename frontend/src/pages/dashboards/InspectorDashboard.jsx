// Inspector dashboard: DB-backed scan history, item-linked AI analysis, persisted reports.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, SearchCheck, AlertTriangle, UploadCloud, Loader2, X, CheckCircle,
  FileText, Image as ImageIcon, Timer, Lightbulb,
} from 'lucide-react';
import { apiGet, apiUpload, apiDownload, imageUrl, riskColor, formatDays, formatDateTime } from '../../api';
import AlertsPanel from '../../components/AlertsPanel';

const getQualityCategory = (score) => {
  if (score >= 90) return { label: 'Fresh', color: '#16a34a' };
  if (score >= 70) return { label: 'Good', color: '#84cc16' };
  if (score >= 50) return { label: 'Acceptable', color: '#eab308' };
  if (score >= 30) return { label: 'Near Spoilage', color: '#f97316' };
  return { label: 'Spoiled', color: '#ef4444' };
};

const card = { backgroundColor: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const labelStyle = { color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' };
const valueStyle = { fontSize: '1.2rem', fontWeight: 700, color: '#111' };
const inputStyle = { width: '100%', backgroundColor: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' };

const InspectorDashboard = () => {
  const [items, setItems] = useState([]);
  const [scans, setScans] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const fileInputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiGet('/api/ml/scans?limit=50');
      setScans(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const inventory = await apiGet('/api/inventory');
        setItems(Array.isArray(inventory) ? inventory : []);
      } catch (err) {
        setScanError(`Failed to load inventory: ${err.message}`);
      }
      await loadHistory();
    })();
  }, [loadHistory]);

  // Clean up object URL to prevent memory leaks (preview only; scans use persisted image_url)
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileSelection = (file) => {
    if (!file.type.startsWith('image/')) {
      setScanError('Please select a valid image file.');
      return;
    }
    setScanError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCurrentAnalysis(null);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCurrentAnalysis(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeFood = async () => {
    if (!selectedFile) return;
    setIsScanning(true);
    setScanError(null);
    setCurrentAnalysis(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedItemId) formData.append('item_id', selectedItemId);
      const result = await apiUpload('/api/ml/predict', formData);
      setCurrentAnalysis(result);
      await loadHistory(); // refresh DB-backed history with the persisted scan
    } catch (err) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const openReport = async (scan) => {
    setSelectedReport(scan); // show scan data immediately
    setReportLoading(true);
    try {
      if (scan.report_id) {
        const report = await apiGet(`/api/reports/${scan.report_id}`);
        setSelectedReport({ ...scan, persistedReport: report });
      }
    } catch {
      /* fall back to the scan record itself */
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => setSelectedReport(null);

  // Summary stats derived ONLY from persisted scans
  const totalScans = scans.length;
  const spoiledCount = scans.filter((s) => s.ml_status === 'Rotten').length;
  const freshCount = scans.filter((s) => s.ml_status === 'Fresh').length;
  const qualityScores = scans.map((s) => s.quality_score).filter((v) => typeof v === 'number');
  const avgScore = qualityScores.length
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : null;

  const r = currentAnalysis;
  const report = selectedReport?.persistedReport;
  const view = report || selectedReport || {};
  const analysis = report?.analysis || view;
  const prediction = report?.prediction || view.shelf_life || selectedReport?.shelf_life;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Quality Inspection</h1>
        <p style={{ color: '#666', margin: 0, fontSize: '1.1rem' }}>
          Upload food images for AI freshness analysis. Select an inventory item first to link the analysis to its batch.
        </p>
      </div>

      {/* Inspection & spoilage alerts (Milestone 4) */}
      <AlertsPanel title="Inspection & Spoilage Alerts" />

      {/* Summary - derived from persisted scans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#4b5563' }}><Camera size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Total Scans</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{historyLoading ? '…' : totalScans}</div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#ecfccb', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#65a30d' }}><CheckCircle size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Fresh Items</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#65a30d' }}>{historyLoading ? '…' : freshCount}</div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#ef4444' }}><AlertTriangle size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Spoilage Detected</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{historyLoading ? '…' : spoiledCount}</div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '50%', marginRight: '16px', color: '#0284c7' }}><SearchCheck size={20} /></div>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Avg Quality</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0284c7' }}>{avgScore !== null ? `${avgScore}%` : 'N/A'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {/* Upload area */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Upload Image for Scan</h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Link to Inventory Item (batch)</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={inputStyle}
            >
              <option value="">- No linked item (standalone scan) -</option>
              {items.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} · Batch {item.batch_number} · {item.quantity} units
                </option>
              ))}
            </select>
            {items.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '6px 0 0' }}>
                No products registered yet. Register products in Inventory to link scans to batches.
              </p>
            )}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]); }}
            style={{
              border: '2px dashed #d1d5db', borderRadius: '16px', padding: previewUrl ? '16px' : '40px 20px',
              textAlign: 'center', backgroundColor: '#f9fafb', cursor: 'pointer', flex: 1,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative',
            }}
            onClick={() => !previewUrl && fileInputRef.current.click()}
          >
            <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])} />
            {previewUrl ? (
              <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={previewUrl} alt="Preview" style={{ maxHeight: '300px', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
                ><X size={16} /></button>
              </div>
            ) : (
              <>
                <UploadCloud size={48} color="#9ca3af" style={{ marginBottom: '16px' }} />
                <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#374151' }}>Drag & drop an image here</p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>or click to browse from your computer</p>
              </>
            )}
          </div>

          {scanError && <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: '12px 0 0' }}>{scanError}</p>}

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button
              onClick={analyzeFood}
              disabled={!selectedFile || isScanning}
              style={{
                flex: 1, padding: '14px', backgroundColor: !selectedFile ? '#e5e7eb' : '#111',
                color: !selectedFile ? '#9ca3af' : '#fff', border: 'none', borderRadius: '12px',
                fontWeight: 600, fontSize: '1rem', cursor: !selectedFile || isScanning ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
              }}
            >
              {isScanning ? <><Loader2 className="animate-spin" size={20} style={{ marginRight: '8px' }} /> Analyzing...</> : 'Analyze Food'}
            </button>
            {selectedFile && !isScanning && (
              <button onClick={clearSelection} style={{ padding: '14px 24px', backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
            )}
          </div>
        </div>

        {/* AI Analysis Result */}
        <div style={{ ...card, backgroundColor: r ? '#fff' : '#f9fafb' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>AI Analysis Result</h2>

          {!r ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#9ca3af' }}>
              <ImageIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Upload and analyze an image to see results here.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {r.status === 'Rotten' && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <AlertTriangle color="#ef4444" style={{ marginRight: '12px', marginTop: '2px' }} />
                  <div>
                    <h4 style={{ color: '#b91c1c', margin: '0 0 4px 0', fontSize: '1rem' }}>Spoilage Detected</h4>
                    <p style={{ color: '#991b1b', margin: 0, fontSize: '0.9rem' }}>The model indicates this item is rotten. It should be removed from inventory.</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={labelStyle}>Linked Item</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111' }}>
                    {r.item_id ? `${r.food_type} (Batch ${r.batch_id ? 'linked' : '-'})` : r.food_type}
                  </div>
                  {r.item_id && <p style={{ color: '#16a34a', fontSize: '0.8rem', margin: '4px 0 0' }}>Saved to inventory record</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={labelStyle}>AI Confidence</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4b5563' }}>{(r.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div>
                    <div style={labelStyle}>Overall Quality Score</div>
                    <div style={{ fontSize: '3rem', fontWeight: 900, color: getQualityCategory(r.quality_assessment?.quality_score ?? r.freshness_score).color, lineHeight: 1 }}>
                      {Math.round(r.quality_assessment?.quality_score ?? r.freshness_score)}<span style={{ fontSize: '1.5rem', color: '#9ca3af' }}>/100</span>
                    </div>
                  </div>
                  <div style={{ padding: '6px 12px', backgroundColor: `${getQualityCategory(r.quality_assessment?.quality_score ?? r.freshness_score).color}20`, color: getQualityCategory(r.quality_assessment?.quality_score ?? r.freshness_score).color, borderRadius: '20px', fontWeight: 700, fontSize: '0.9rem' }}>
                    {r.quality_assessment?.quality_category || getQualityCategory(r.freshness_score).label}
                  </div>
                </div>
                <div style={{ width: '100%', backgroundColor: '#f3f4f6', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${r.quality_assessment?.quality_score ?? r.freshness_score}%` }} transition={{ duration: 1, delay: 0.2 }} style={{ height: '100%', backgroundColor: getQualityCategory(r.quality_assessment?.quality_score ?? r.freshness_score).color, borderRadius: '6px' }} />
                </div>
              </div>

              {/* Estimated shelf life */}
              {r.shelf_life && (
                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Timer size={16} /> Estimated Remaining Shelf Life</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: riskColor(r.shelf_life.risk_level) }}>
                      {formatDays(r.shelf_life.effective_remaining_days)}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: `${riskColor(r.shelf_life.risk_level)}20`, color: riskColor(r.shelf_life.risk_level), fontWeight: 700, fontSize: '0.8rem' }}>
                      {r.shelf_life.risk_level} risk
                    </span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
                    Parametric estimate (not guaranteed) · confidence {r.shelf_life.prediction_confidence}% (input completeness) · {r.shelf_life.estimate_disclaimer}
                  </p>
                </div>
              )}

              {/* Top recommendations */}
              {Array.isArray(r.recommendations) && r.recommendations.length > 0 && (
                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={16} /> Recommendations</h3>
                  {r.recommendations.slice(0, 4).map((rec, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: i < 3 ? '1px solid #e5e7eb' : 'none' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rec.title}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.85rem' }}>{rec.message || rec.action}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual analysis */}
              <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 16px 0' }}>Visual Image Analysis</h3>
                {r.image_analysis ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={labelStyle}>Discoloration</div>
                        <div style={{ ...valueStyle, fontSize: '1rem' }}>{r.image_analysis.degradation_analysis?.discoloration_ratio || '0'}%</div>
                      </div>
                      <div>
                        <div style={labelStyle}>Texture Variance</div>
                        <div style={{ ...valueStyle, fontSize: '1rem' }}>{r.image_analysis.texture_analysis?.texture_variance || '0'}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>Mold Indicator</div>
                        <div style={{ ...valueStyle, fontSize: '1rem', color: r.image_analysis.possible_mold_indicator ? '#ef4444' : '#111' }}>
                          {r.image_analysis.possible_mold_indicator ? 'Detected' : 'None Detected'}
                        </div>
                      </div>
                    </div>
                    {r.image_analysis.disclaimer && (
                      <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic' }}>* {r.image_analysis.disclaimer}</p>
                    )}
                  </>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Data unavailable from backend.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scan History - loaded from the database */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Scan History</h2>
          <button onClick={loadHistory} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#4b5563' }}>
            Refresh
          </button>
        </div>

        {historyError && <p style={{ color: '#ef4444' }}>Failed to load scan history: {historyError}</p>}
        {!historyLoading && !historyError && scans.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
            <SearchCheck size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ margin: 0 }}>No scans recorded yet. Analyze an image above - every scan is saved to the database.</p>
          </div>
        )}
        {historyLoading && scans.length === 0 && <p style={{ color: '#9ca3af' }}>Loading scan history…</p>}

        {scans.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '760px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Image', 'Item', 'Scan Time', 'Status', 'Quality', 'Est. Remaining', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '14px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => {
                  const cat = getQualityCategory(scan.quality_score ?? 0);
                  const days = scan.effective_remaining_days ?? scan.shelf_life?.effective_remaining_days;
                  return (
                    <tr key={scan._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px' }}>
                        {scan.image_url
                          ? <img src={imageUrl(scan.image_url)} alt="scan" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                          : <span style={{ color: '#9ca3af' }}>N/A</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {scan.food_type}
                        {scan.item_id && <span style={{ display: 'block', fontSize: '0.75rem', color: '#16a34a' }}>linked to inventory</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(scan.scanned_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: scan.ml_status === 'Rotten' ? '#fee2e2' : '#dcfce7', color: scan.ml_status === 'Rotten' ? '#b91c1c' : '#15803d', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {scan.ml_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: cat.color, fontWeight: 700 }}>{scan.quality_score ?? 'N/A'}%</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: days != null && scan.shelf_life?.risk_level ? riskColor(scan.shelf_life.risk_level) : '#111' }}>
                        {days != null ? formatDays(days) : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => openReport(scan)} style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <FileText size={14} style={{ marginRight: '6px' }} /> View Report
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

      {/* Persisted Report Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }} onClick={closeReport}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #f3f4f6', paddingBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Freshness Report</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {report && (
                    <>
                      <button
                        onClick={() => apiDownload(`/api/reports/${report._id}/export?format=pdf`, `Freshness_Report_${report._id}.pdf`)}
                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
                      >Export PDF</button>
                      <button
                        onClick={() => apiDownload(`/api/reports/${report._id}/export?format=xlsx`, `Freshness_Report_${report._id}.xlsx`)}
                        style={{ background: '#dcfce7', color: '#15803d', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
                      >Export Excel</button>
                    </>
                  )}
                  <button onClick={closeReport} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, color: '#4b5563' }}>Close</button>
                </div>
              </div>
              {reportLoading && <p style={{ color: '#9ca3af' }}>Loading persisted report…</p>}

              {view.image_url && (
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <img src={imageUrl(view.image_url)} alt="Scanned Food" style={{ maxHeight: '220px', borderRadius: '12px', objectFit: 'contain' }} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Food Information</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.95rem' }}>
                    <div><div style={labelStyle}>Food Type</div><div style={valueStyle}>{report?.item?.name || view.food_type}</div></div>
                    <div><div style={labelStyle}>Batch</div><div style={valueStyle}>{report?.item?.batch_number || '-'}</div></div>
                    <div><div style={labelStyle}>Category</div><div style={valueStyle}>{report?.item?.category || view.category}</div></div>
                    <div><div style={labelStyle}>Inspector</div><div style={{ ...valueStyle, fontSize: '1rem' }}>{view.scanned_by_username || 'Unknown'}</div></div>
                    <div><div style={labelStyle}>Scan Time</div><div style={{ ...valueStyle, fontSize: '1rem' }}>{formatDateTime(view.scanned_at)}</div></div>
                    {report && (
                      <div><div style={labelStyle}>Report ID</div><div style={{ ...valueStyle, fontSize: '0.8rem', wordBreak: 'break-all' }}>{String(report._id)}</div></div>
                    )}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>AI Assessment</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div><div style={labelStyle}>Status</div>
                      <div style={{ ...valueStyle, color: analysis?.ml_status === 'Rotten' ? '#ef4444' : '#16a34a' }}>{analysis?.ml_status}</div></div>
                    <div><div style={labelStyle}>AI Confidence</div><div style={valueStyle}>{analysis?.confidence != null ? `${(analysis.confidence * 100).toFixed(1)}%` : 'N/A'}</div></div>
                    <div><div style={labelStyle}>Quality Score</div><div style={valueStyle}>{analysis?.quality_score ?? 'N/A'} / 100</div></div>
                    <div><div style={labelStyle}>Quality Category</div><div style={valueStyle}>{analysis?.quality_category || 'N/A'}</div></div>
                  </div>
                  {analysis?.quality_assessment?.score_breakdown && (
                    <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#4b5563' }}>
                      <div>ML Freshness (40%): {analysis.quality_assessment.score_breakdown.ml_freshness_score ?? 'N/A'}</div>
                      <div>Color (20%): {analysis.quality_assessment.score_breakdown.color_score ?? 'N/A'} · Texture (20%): {analysis.quality_assessment.score_breakdown.texture_score ?? 'N/A'} · Surface (20%): {analysis.quality_assessment.score_breakdown.surface_score ?? 'N/A'}</div>
                      {analysis.quality_assessment.score_breakdown.rotten_penalty_applied && (
                        <div style={{ color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>Rotten status penalty applied (×0.6)</div>
                      )}
                      <p style={{ color: '#9ca3af', fontStyle: 'italic', margin: '8px 0 0' }}>* Image-based quality score from AI classification and visual heuristics.</p>
                    </div>
                  )}
                </div>

                {prediction && (
                  <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Timer size={16} /> Estimated Remaining Shelf Life</h3>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: riskColor(prediction.risk_level) }}>{formatDays(prediction.effective_remaining_days)}</span>
                      <span style={{ fontWeight: 700, color: riskColor(prediction.risk_level) }}>{prediction.risk_level} risk</span>
                      <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        total estimate {prediction.estimated_total_life_days} d − stored {prediction.storage_duration_days ?? 0} d
                        {prediction.effective_remaining_days !== prediction.estimated_remaining_days && ' (label-expiry capped)'}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '8px 0 0' }}>
                      {prediction.estimate_disclaimer} · Prediction Confidence {prediction.prediction_confidence}% — {prediction.confidence_explanation}
                    </p>
                  </div>
                )}

                {report?.recommendations && (
                  <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={16} /> Recommendations</h3>
                    {report.recommendations.map((rec, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: i < report.recommendations.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <span style={{ fontWeight: 700 }}>{rec.title}</span>
                        <span style={{ color: '#4b5563', marginLeft: '8px', fontSize: '0.9rem' }}>{rec.message || rec.action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {analysis?.image_analysis && (
                  <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Visual Indicators</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '0.9rem' }}>
                      <div><span style={{ color: '#6b7280' }}>Discoloration: </span><b>{analysis.image_analysis.degradation_analysis?.discoloration_ratio ?? 0}%</b></div>
                      <div><span style={{ color: '#6b7280' }}>Texture variance: </span><b>{analysis.image_analysis.texture_analysis?.texture_variance ?? 0}</b></div>
                      <div><span style={{ color: '#6b7280' }}>Brown regions: </span><b>{analysis.image_analysis.color_analysis?.brown_pixel_ratio ?? 0}%</b></div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Mold-like regions: </span>
                        <b style={{ color: analysis.image_analysis.possible_mold_indicator ? '#ef4444' : '#16a34a' }}>
                          {analysis.image_analysis.possible_mold_indicator ? 'Detected' : 'None'}
                        </b>
                      </div>
                    </div>
                    <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem', margin: '12px 0 0' }}>
                      * Visual heuristic indicators only - not a dedicated detection model.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default InspectorDashboard;

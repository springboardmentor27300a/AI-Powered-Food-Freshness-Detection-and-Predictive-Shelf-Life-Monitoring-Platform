/**
 * FreshnessAnalysis page - Upload a food image and receive AI-powered
 * freshness classification, quality scoring, and spoilage detection.
 * Supports pre-selecting a batch via /freshness-analysis/:batchId route.
 */
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import FreshnessResult from '../components/FreshnessResult'
import { FOOD_CATEGORIES } from '../utils/constants'

export default function FreshnessAnalysis() {
  const { batchId: urlBatchId } = useParams()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [foodName, setFoodName] = useState('')
  const [foodCategory, setFoodCategory] = useState('')
  const [batchId, setBatchId] = useState(urlBatchId || '')
  const [loading, setLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  // Auto-fetch batch info when batchId is provided via URL
  useEffect(() => {
    if (urlBatchId) {
      setBatchId(urlBatchId)
      fetchBatchInfo(urlBatchId)
    }
  }, [urlBatchId])

  const fetchBatchInfo = async (id) => {
    setBatchLoading(true)
    try {
      const { data } = await api.get(`/batches/${id}`)
      setFoodName(data.food_name || '')
      setFoodCategory(data.category || '')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load batch details. You can still analyze manually.'))
    } finally {
      setBatchLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (!selected) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
    if (!allowedTypes.includes(selected.type)) {
      setError('Unsupported file type. Please upload JPEG, PNG, WebP, or BMP.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.')
      return
    }

    setFile(selected)
    setError('')
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(selected)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type.startsWith('image/')) {
      if (dropped.size > 10 * 1024 * 1024) {
        setError('File too large. Maximum size is 10 MB.')
        return
      }
      setFile(dropped)
      setError('')
      setResult(null)
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(dropped)
    }
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    if (foodName) formData.append('food_name', foodName)
    if (foodCategory) formData.append('food_category', foodCategory)
    if (batchId) formData.append('batch_id', batchId)

    try {
      const { data } = await api.post('/analysis/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Analysis failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setFoodName('')
    setFoodCategory('')
    setBatchId(urlBatchId || '')
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <h2>Freshness Analysis</h2>
          <p className="muted">
            {urlBatchId
              ? `Analyzing freshness for batch ${urlBatchId}`
              : 'Upload a food image for AI-powered freshness assessment'}
          </p>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {batchLoading && <div className="banner info">Loading batch information...</div>}

      {!result ? (
        <div className="panel">
          <div className="analysis-upload-area" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            {preview ? (
              <div className="image-preview-wrap">
                <img src={preview} alt="Food to analyze" className="image-preview" />
                <button className="btn btn-outline btn-small" onClick={handleReset}>Remove</button>
              </div>
            ) : (
              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                <div className="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <p className="upload-text">Click to upload or drag and drop</p>
                <p className="upload-hint">JPEG, PNG, WebP, BMP up to 10 MB</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/bmp" onChange={handleFileChange} hidden />
              </div>
            )}
          </div>

          <div className="form-grid" style={{ marginTop: 20 }}>
            <div className="field">
              <label>Food Name</label>
              <input
                type="text"
                placeholder="e.g. Apple, Chicken Breast"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Category <small>(optional)</small></label>
              <select value={foodCategory} onChange={(e) => setFoodCategory(e.target.value)}>
                <option value="">Auto-detect</option>
                {FOOD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label>Batch ID <small>(optional - link to existing inventory batch)</small></label>
              <input
                type="text"
                placeholder="e.g. APP-20260821-001"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={!file || loading}
            >
              {loading ? (
                <><span className="spinner" /> Analyzing...</>
              ) : (
                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Analyze Freshness</>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <FreshnessResult result={result} preview={preview} batchId={batchId} imageFile={file} />
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-outline" onClick={handleReset}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>
              Analyze Another Image
            </button>
          </div>
        </>
      )}
    </div>
  )
}

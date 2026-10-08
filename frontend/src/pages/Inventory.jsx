/**
 * Inventory Management page: dynamic table of food batches with search,
 * category/status filters, edit modal (incl. available-quantity updates) and
 * delete with confirmation. All data comes from GET/PUT/DELETE /batches.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import BatchForm from '../components/BatchForm'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import StorageAnalysisResult from '../components/StorageAnalysisResult'
import { PageLoading } from '../components/Spinner'
import { EditIcon, SearchIcon, TrashIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import api, { getErrorMessage } from '../services/api'
import { FOOD_CATEGORIES } from '../utils/constants'
import { formatDate, formatQuantity, expiryPriority } from '../utils/helpers'

const STATUS_OPTIONS = ['Fresh', 'Expiring Soon', 'Expired']

function AnalyzeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

export default function Inventory() {
  const { user } = useAuth()
  const isInspector = user.role === 'quality_inspector'

  const [batches, setBatches] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null) // { type: 'success'|'error', text }

  // Filter state -> sent to the backend as query params.
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Debounce the search box so we don't spam the API on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim()
      if (category) params.category = category
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/batches', { params })
      setBatches(res.data)
    } catch (err) {
      setBanner({ type: 'error', text: getErrorMessage(err) })
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, category, statusFilter])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const clearFilters = () => {
    setSearch('')
    setCategory('')
    setStatusFilter('')
  }
  const hasFilters = Boolean(search || category || statusFilter)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Inventory Management</h2>
          <p className="muted">
            {user.role === 'consumer' ? 'Your personal food inventory.' : 'All registered food batches across the platform.'}
          </p>
        </div>
        {!isInspector && (
          <Link to="/add-food-item" className="btn btn-primary">+ Add Food Item</Link>
        )}
      </div>

      {banner && (
        <div className={`banner ${banner.type}`}>
          {banner.text}
          <button type="button" className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Search + filters toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by food name or batch ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search batches"
          />
        </div>

        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All Categories</option>
          {FOOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {hasFilters && (
          <button type="button" className="btn btn-small btn-outline" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {loading ? (
        <PageLoading text="Loading inventory…" />
      ) : batches && batches.length === 0 ? (
        <div className="empty-state tall">
          <h3>{hasFilters ? 'No batches match your filters' : 'No food batches yet'}</h3>
          <p>{hasFilters ? 'Try adjusting the search or clearing the filters.' : 'Register your first food item to start tracking freshness.'}</p>
          {!isInspector && !hasFilters && <Link className="btn btn-primary" to="/add-food-item">Add Food Item</Link>}
        </div>
      ) : batches && (
        <div className="panel">
          <div className="table-meta muted small">
            Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Food Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Available Qty</th>
                  <th>Unit</th>
                  <th>Received</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Storage Location</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.batch_id}</code></td>
                    <td className="strong">{b.food_name}</td>
                    <td>{b.category}</td>
                    <td>{formatQuantity(b.quantity)}</td>
                    <td>{formatQuantity(b.available_quantity)}</td>
                    <td>{b.unit}</td>
                    <td>{formatDate(b.received_date)}</td>
                    <td>{formatDate(b.expiry_date)}</td>
                    <td>
                      <StatusBadge status={b.freshness_status} />
                      <div className="small muted">{b.expiry_priority_status || expiryPriority(b.expiry_date).label}</div>
                    </td>
                    <td>{b.storage_location}</td>
                    <td className="actions-col">
                      <Link
                        to={`/freshness-analysis/${b.batch_id}`}
                        className="icon-btn action"
                        title="Analyze Freshness"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AnalyzeIcon />
                      </Link>
                      {!isInspector && (
                        <RowActions
                          batch={b}
                          onChanged={(msg) => { setBanner({ type: 'success', text: msg }); fetchBatches() }}
                          onError={(msg) => setBanner({ type: 'error', text: msg })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Edit/delete controls for one table row (kept separate for clarity). */
function RowActions({ batch, onChanged, onError }) {
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleUpdate = async (payload) => {
    setBusy(true)
    try {
      await api.put(`/batches/${batch.batch_id}`, payload)
      setSaved(true) // show the storage-condition analysis for the new values
      onChanged(`Batch ${batch.batch_id} was updated successfully.`)
    } catch (err) {
      // Surface server validation errors inside the modal form itself.
      return getErrorMessage(err)
    } finally {
      setBusy(false)
    }
  }

  const closeModal = () => {
    setEditing(false)
    setSaved(false)
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await api.delete(`/batches/${batch.batch_id}`)
      setConfirmOpen(false)
      onChanged(`Batch ${batch.batch_id} was deleted successfully.`)
    } catch (err) {
      onError(getErrorMessage(err))
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="icon-btn action" title="Edit details" onClick={() => setEditing(true)}>
        <EditIcon />
      </button>
      <button type="button" className="icon-btn action danger" title="Delete batch" onClick={() => setConfirmOpen(true)}>
        <TrashIcon />
      </button>

      {editing && (
        <Modal title={`Edit Batch ${batch.batch_id}`} onClose={closeModal}>
          {saved ? (
            <div>
              <div className="banner success">Batch {batch.batch_id} was updated successfully.</div>
              <StorageAnalysisResult batchId={batch.batch_id} />
              <div className="success-actions">
                <button type="button" className="btn btn-primary" onClick={closeModal}>Done</button>
              </div>
            </div>
          ) : (
            <BatchForm
              initial={batch}
              submitLabel="Save Changes"
              busy={busy}
              onSubmit={handleUpdate}
            />
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this batch?"
        message={`This will permanently remove "${batch.food_name}" (${batch.batch_id}) from the inventory. This action cannot be undone.`}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

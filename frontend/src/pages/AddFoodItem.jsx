/**
 * Add Food Item page: registers a new batch via POST /batches.
 * The backend generates the unique batch ID (<FOOD>-<YYYYMMDD>-<seq>).
 * Food Quality Inspectors are read-only, so they see a notice instead.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'

import BatchForm from '../components/BatchForm'
import StorageAnalysisResult from '../components/StorageAnalysisResult'
import { useAuth } from '../context/AuthContext'
import api, { getErrorMessage } from '../services/api'
import { ROLE_DESCRIPTIONS } from '../utils/constants'

export default function AddFoodItem() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const [createdBatch, setCreatedBatch] = useState(null)

  if (user.role === 'quality_inspector') {
    return (
      <div className="page">
        <div className="empty-state tall">
          <h3>Read-only role</h3>
          <p>{ROLE_DESCRIPTIONS[user.role]}</p>
          <p>You can review batches and expiry details on the Inventory page.</p>
          <Link className="btn btn-primary" to="/inventory">Go to Inventory</Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (payload) => {
    setBusy(true)
    setServerError('')
    try {
      const res = await api.post('/batches', payload)
      setCreatedBatch(res.data) // success panel shows the generated batch ID
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Success state: confirm the registration, show the storage-condition
  // analysis for the values just entered, and offer next actions.
  if (createdBatch) {
    return (
      <div className="page">
        <div className="success-panel">
          <h3>Food batch registered</h3>
          <p>
            <strong>{createdBatch.food_name}</strong> was added to your inventory with the
            automatically generated batch ID:
          </p>
          <code className="big-code">{createdBatch.batch_id}</code>
          <div className="success-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreatedBatch(null)}>
              Add Another Item
            </button>
            <Link className="btn btn-outline" to="/inventory">View Inventory</Link>
          </div>
        </div>

        {/* Immediate storage-condition analysis for the entered values */}
        <StorageAnalysisResult batchId={createdBatch.batch_id} />
      </div>
    )
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h2>Add Food Item / Batch</h2>
          <p className="muted">
            A unique batch ID (first 3 letters of the food name + received date + sequence,
            e.g. APP-20260821-001) is generated automatically when you save.
          </p>
        </div>
      </div>

      <div className="panel">
        <BatchForm
          submitLabel="Register Food Batch"
          busy={busy}
          serverError={serverError}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}

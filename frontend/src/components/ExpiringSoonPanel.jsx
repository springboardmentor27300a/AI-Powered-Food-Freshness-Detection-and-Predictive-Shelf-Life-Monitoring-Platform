/**
 * Top-of-dashboard "EXPIRING SOON / PRIORITY BATCHES" section (FEFO).
 *
 * Nearest-expiry batches are always listed first (backend returns FEFO order)
 * with a dynamic expiry status, an inventory priority badge and a role-based
 * recommended action for every row.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusBadge from './StatusBadge'
import { AlertIcon } from './icons'
import { useAuth } from '../context/AuthContext'
import api, { getErrorMessage } from '../services/api'
import { describeExpiry, expiryAction, expiryPriority, formatDate, priorityBadgeClass } from '../utils/helpers'

export default function ExpiringSoonPanel() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/batches/expiring', { params: { days: 7, include_expired: true } })
      setBatches(res.data || [])
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <section className="panel" style={{ borderLeft: '4px solid var(--amber-600)', marginBottom: 20 }}>
      <div className="panel-head alert-head">
        <h3><AlertIcon size={18} /> Expiring Soon — Priority Batches (FEFO)</h3>
        <span className="muted small">Nearest expiry first</span>
      </div>

      {error && <div className="banner error">{error}</div>}

      {batches.length === 0 ? (
        <p className="empty-inline">No batches are expiring in the next 7 days.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b, index) => {
                const p = expiryPriority(b.expiry_date)
                return (
                  <tr key={b.batch_id}>
                    <td>{index + 1}</td>
                    <td className="strong">{b.food_name}</td>
                    <td><code>{b.batch_id}</code></td>
                    <td>{formatDate(b.expiry_date)}</td>
                    <td>{describeExpiry(b.expiry_date)}</td>
                    <td>
                      <div className="small strong">{b.expiry_priority_status || p.label}</div>
                      <StatusBadge status={b.freshness_status} />
                    </td>
                    <td>
                      <span className={`badge ${priorityBadgeClass(b.priority_level || p.level)}`}>
                        {b.priority_level || p.level}
                      </span>
                    </td>
                    <td>
                      <div className="small">{expiryAction(b.expiry_date, user?.role)}</div>
                      <Link to={`/shelf-life/${b.batch_id}`} className="small">Review</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

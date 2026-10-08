/**
 * Users page (Administrator only - the route is also protected server-side
 * by a role check on GET /auth/users).
 */
import { useEffect, useState } from 'react'

import StatusBadge from '../components/StatusBadge' // eslint-disable-line no-unused-vars
import { PageLoading } from '../components/Spinner'
import api, { getErrorMessage } from '../services/api'
import { roleLabel } from '../utils/constants'
import { formatDate, initials } from '../utils/helpers'

export default function Users() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/auth/users')
      .then((res) => setUsers(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading text="Loading users…" />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>All Users</h2>
          <p className="muted">{users?.length ?? 0} registered accounts on the platform.</p>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {users && (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td className="strong with-avatar">
                      <span className="avatar avatar-sm">{initials(u.full_name)}</span>
                      {u.full_name}
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-role ${u.role}`}>{roleLabel(u.role)}</span></td>
                    <td>{formatDate(u.created_at.slice(0, 10))}</td>
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

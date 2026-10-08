/** Profile page: the logged-in user's account details and role permissions. */
import { useAuth } from '../context/AuthContext'
import { ROLE_DESCRIPTIONS, roleLabel } from '../utils/constants'
import { formatDate, initials } from '../utils/helpers'

export default function Profile() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h2>My Profile</h2>
          <p className="muted">Your account information and access level.</p>
        </div>
      </div>

      <section className="panel profile-card">
        <span className="avatar avatar-xl">{initials(user.full_name)}</span>
        <div className="profile-info">
          <h3>{user.full_name}</h3>
          <p className="muted">{user.email}</p>
          <span className={`badge badge-role ${user.role}`}>{roleLabel(user.role)}</span>
          <p className="muted small">Member since {formatDate(user.created_at.slice(0, 10))}</p>
        </div>
      </section>

      <section className="panel">
        <h3>What you can do</h3>
        <p>{ROLE_DESCRIPTIONS[user.role]}</p>
        <ul className="perm-list">
          {buildPermissions(user.role).map((perm) => (
            <li key={perm}>{perm}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Session</h3>
        <p className="muted">
          You are signed in with a secure JWT session token issued at login.
          Logging out removes the token from this browser tab.
        </p>
        <button type="button" className="btn btn-outline" onClick={logout}>
          Log out of this device
        </button>
      </section>
    </div>
  )
}

function buildPermissions(role) {
  const common = 'View dashboard summary and expiry alerts'
  switch (role) {
    case 'consumer':
      return [common + ' (own stock)', 'Create food batches in your personal inventory', 'Edit or delete only your own batches']
    case 'retail_manager':
    case 'warehouse_operator':
      return [common + ' (all stock)', 'Create new food batches', 'Update details and available quantities', 'Delete batches with confirmation']
    case 'quality_inspector':
      return ['View all food batches and expiry details', 'Read-only: creating or editing is not permitted']
    case 'administrator':
      return [common + ' (all stock)', 'View all registered users', 'Manage every batch on the platform']
    default:
      return []
  }
}

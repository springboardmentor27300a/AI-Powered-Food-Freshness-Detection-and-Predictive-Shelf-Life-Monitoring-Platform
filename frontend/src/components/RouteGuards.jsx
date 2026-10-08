/** Route guards: require login, or bounce logged-in users away from auth pages. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Spinner } from './Spinner'

export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <SplashScreen />
  if (!isAuthenticated) {
    // Remember where the user wanted to go so Login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Wraps /login and /register: authenticated users belong on the dashboard. */
export function PublicOnlyRoute() {
  const { isAuthenticated, initializing } = useAuth()

  if (initializing) return <SplashScreen />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

/**
 * Role-based route guard. A logged-in user only reaches a route when their
 * role is in `roles`; anyone else is redirected to their OWN dashboard
 * (which resolves to their role), so changing the URL never works.
 */
export function RoleRoute({ roles }) {
  const { user, initializing } = useAuth()

  if (initializing) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function SplashScreen() {
  return (
    <div className="splash">
      <Spinner size={36} />
      <p>Loading your session…</p>
    </div>
  )
}

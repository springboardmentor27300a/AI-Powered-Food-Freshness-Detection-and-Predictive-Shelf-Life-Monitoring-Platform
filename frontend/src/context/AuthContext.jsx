/**
 * AuthContext - the single source of truth for the logged-in user.
 *
 * On mount it re-validates any stored JWT against GET /auth/me so a page
 * refresh keeps you logged in, and an expired token logs you out cleanly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import api, { clearToken, getToken, setToken, setUnauthorizedHandler } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  // Restore the session on first load (if a JWT is stored for this tab).
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setInitializing(false)
      return
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setInitializing(false))
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  // Any 401 on a protected request -> drop the stale session.
  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.data.access_token)
    setUser(res.data.user)
    return res.data.user
  }, [])

  /** Registers the account; the user still logs in explicitly afterwards. */
  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload)
    return res.data
  }, [])

  const value = useMemo(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, initializing, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

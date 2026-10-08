/**
 * Axios-based API client for the Food Freshness Monitoring Platform.
 *
 * - Base URL comes from VITE_API_URL (.env) so dev/prod can differ.
 * - The JWT is attached to every request automatically (Authorization header).
 * - The token lives in sessionStorage, i.e. it survives reloads in this tab
 *   but disappears when the browser tab closes ("securely for the session").
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const TOKEN_KEY = 'ffmp_token'

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Registered by AuthContext: clears the session when a token expires.
let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized && !error.config?.url?.includes('/auth/login')) {
      onUnauthorized()
    }
    return Promise.reject(error)
  }
)

/** Convert an axios error into a human-friendly message for banners. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // Pydantic validation errors -> join the messages.
    return detail.map((d) => d.msg || JSON.stringify(d)).join(' ')
  }
  if (!error.response) return 'Cannot reach the server. Is the backend running?'
  return fallback
}

export default api

/** Login page: JWT-based authentication against POST /auth/login. */
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Spinner } from '../components/Spinner'
import { LeafLogo } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../services/api'
import { isValidEmail } from '../utils/helpers'

const PERKS = [
  { icon: '📦', text: 'Organised batch-level food inventory' },
  { icon: '⏱️', text: 'Live freshness & expiry alerts' },
  { icon: '🔐', text: 'Secure role-based access control' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Pre-fill + success banner when arriving right after registration.
  const registeredEmail = location.state?.registeredEmail || ''
  const [form, setForm] = useState({ email: registeredEmail, password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  const validate = () => {
    const errs = {}
    if (!isValidEmail(form.email)) errs.email = 'Please enter a valid email address.'
    if (!form.password) errs.password = 'Password is required.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    try {
      await login(form.email.trim(), form.password)
      // Send the user where they were originally headed (or the dashboard).
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <div className="brand">
            <span className="brand-mark"><LeafLogo size={22} /></span>
            <div className="brand-text">
              <strong>FreshTrack</strong>
              <small>Food Freshness Platform</small>
            </div>
          </div>
          <div>
            <h2>Turn expiry awareness into action.</h2>
            <p>Monitor every food batch, spot items about to expire and cut food waste across households, retail and warehousing.</p>
            <ul className="auth-perks">
              {PERKS.map((p) => (
                <li key={p.text}><span className="auth-perk-icon"><LeafLogo size={16} /></span>{p.text}</li>
              ))}
            </ul>
          </div>
          <small style={{ opacity: 0.6 }}>Infosys Springboard Internship · Milestone 1</small>
        </aside>

        <div className="auth-card">
          <div className="auth-brand">
            <h1>Welcome back</h1>
            <p>Log in to monitor your food inventory.</p>
          </div>

          {location.state?.registered && (
            <div className="banner success">Account created successfully. Please log in to continue.</div>
          )}
          {serverError && <div className="banner error">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy && <Spinner size={15} />} {busy ? 'Logging in…' : 'Log In'}
            </button>
          </form>

          <p className="auth-switch">
            New to FreshTrack? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

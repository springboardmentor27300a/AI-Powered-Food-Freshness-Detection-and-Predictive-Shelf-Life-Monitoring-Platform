/**
 * Registration page: validates all inputs client-side, then stores the user
 * in PostgreSQL via POST /auth/register (password is bcrypt-hashed server-side).
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Spinner } from '../components/Spinner'
import { LeafLogo } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../services/api'
import { ROLES, ROLE_DESCRIPTIONS } from '../utils/constants'
import { isValidEmail } from '../utils/helpers'

const PERKS = [
  { text: 'Automatic unique batch IDs' },
  { text: 'Live Fresh / Expiring Soon / Expired status' },
  { text: 'Role-based access control for your team' },
]

const EMPTY = { full_name: '', email: '', password: '', confirm_password: '', role: '' }

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.full_name.trim() || form.full_name.trim().length < 2)
      errs.full_name = 'Please enter your full name (min 2 characters).'
    if (!isValidEmail(form.email)) errs.email = 'Please enter a valid email address.'
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters long.'
    if (form.confirm_password !== form.password) errs.confirm_password = 'Passwords do not match.'
    if (!form.role) errs.role = 'Please select your role.'
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
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      // Registration succeeded -> send to Login with a friendly confirmation.
      navigate('/login', {
        state: { registered: true, registeredEmail: form.email.trim() },
        replace: true,
      })
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
            <h2>Start reducing food waste today.</h2>
            <p>Join retailers, warehouses and households using one platform to keep every batch fresh and accounted for.</p>
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
            <h1>Create your account</h1>
            <p>Join the platform and start reducing food waste.</p>
          </div>

          {serverError && <div className="banner error">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="full_name">Full Name *</label>
                <input id="full_name" type="text" autoComplete="name" placeholder="e.g. Priya Sharma"
                       value={form.full_name} onChange={set('full_name')} maxLength={120} />
                {errors.full_name && <span className="field-error">{errors.full_name}</span>}
              </div>

              <div className="field">
                <label htmlFor="email">Email *</label>
                <input id="email" type="email" autoComplete="email" placeholder="you@example.com"
                       value={form.email} onChange={set('email')} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="field">
                <label htmlFor="password">Password * <small>(min 8 characters)</small></label>
                <input id="password" type="password" autoComplete="new-password" placeholder="Create a strong password"
                       value={form.password} onChange={set('password')} />
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              <div className="field">
                <label htmlFor="confirm_password">Confirm Password *</label>
                <input id="confirm_password" type="password" autoComplete="new-password" placeholder="Re-enter your password"
                       value={form.confirm_password} onChange={set('confirm_password')} />
                {errors.confirm_password && <span className="field-error">{errors.confirm_password}</span>}
              </div>

              <div className="field span-2">
                <label htmlFor="role">Register as *</label>
                <select id="role" value={form.role} onChange={set('role')}>
                  <option value="">Select your role…</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {errors.role && <span className="field-error">{errors.role}</span>}
                {form.role && (
                  <p className="field-hint">{ROLE_DESCRIPTIONS[form.role]}</p>
                )}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy && <Spinner size={15} />} {busy ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

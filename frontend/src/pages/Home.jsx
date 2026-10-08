/**
 * Landing page: explains the platform and routes visitors to Login / Register
 * (or straight to the dashboard when already signed in).
 */
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { LeafLogo } from '../components/icons'

const FEATURES = [
  {
    title: 'Track Every Batch',
    text: 'Register food batches with automatic batch IDs, quantities, storage locations and packaging details in one organised inventory.',
    tone: 'green',
  },
  {
    title: 'Expiry Alerts',
    text: 'Freshness is calculated live - green when fresh, orange within 3 days of expiry, red once expired - so nothing is missed.',
    tone: 'amber',
  },
  {
    title: 'Built for Teams',
    text: 'Consumers, retail managers, warehouse operators, quality inspectors and administrators each get exactly the access they need.',
    tone: 'blue',
  },
  {
    title: 'AI-Ready Platform',
    text: 'The architecture is prepared for image-based freshness detection and shelf-life prediction arriving in the next milestones.',
    tone: 'violet',
  },
]

const STEPS = [
  { n: '1', title: 'Create your account', text: 'Register with your name, email and role. Passwords are securely encrypted (bcrypt) in PostgreSQL.' },
  { n: '2', title: 'Add food batches', text: 'Record each delivery with category, quantity, dates and storage location - a unique batch ID is generated automatically.' },
  { n: '3', title: 'Act before expiry', text: 'Monitor the dashboard summary and expiry alerts to use, discount or rotate stock on time.' },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="landing">
      <header className="landing-topbar">
        <div className="container topbar-inner">
          <div className="brand landing-brand">
            <span className="brand-mark"><LeafLogo size={22} /></span>
            <strong>FreshTrack</strong>
          </div>
          <nav className="landing-actions">
            {user ? (
              <Link className="btn btn-primary" to="/dashboard">Go to Dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-outline" to="/login">Log In</Link>
                <Link className="btn btn-primary" to="/register">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Infosys Springboard Internship · Milestone 1</span>
            <h1>
              Reduce food waste.<br />
              <span className="text-green">Monitor freshness</span> from shelf to store.
            </h1>
            <p>
              The <strong>Food Freshness Monitoring Platform</strong> helps households, retailers and warehouses keep
              track of every food batch they receive. One third of all food produced globally is lost or wasted -
              most of it because nobody knew what was expiring. This platform makes expiry visible before it becomes waste.
            </p>
            <div className="hero-cta">
              {user ? (
                <Link className="btn btn-primary btn-lg" to="/dashboard">Open My Dashboard</Link>
              ) : (
                <>
                  <Link className="btn btn-primary btn-lg" to="/register">Get Started Free</Link>
                  <Link className="btn btn-outline btn-lg" to="/login">I already have an account</Link>
                </>
              )}
            </div>
            <ul className="hero-points">
              <li>Automatic unique batch IDs</li>
              <li>Live Fresh / Expiring Soon / Expired status</li>
              <li>Role-based access control</li>
            </ul>
          </div>

          {/* Decorative mock stat cards */}
          <div className="hero-visual" aria-hidden="true">
            <div className="mock-card mock-main">
              <div className="mock-title">Today's Overview</div>
              <div className="mock-stats">
                <div><b>128</b><small>Batches</small></div>
                <div><b>942 kg</b><small>In stock</small></div>
                <div><b>14</b><small>Expiring soon</small></div>
              </div>
            </div>
            <div className="mock-card mock-alert">
              <span className="dot dot-red" />
              <div>
                <b>Milk - MIL-{new Date().getFullYear()}0101-003</b>
                <small>Expired yesterday · Chiller Unit 2</small>
              </div>
            </div>
            <div className="mock-card mock-ok">
              <span className="dot dot-green" />
              <div>
                <b>Apples - APP-...-001</b>
                <small>Fresh · expires in 12 days</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <h2 className="section-title">Everything you need to fight food waste</h2>
        <p className="section-sub">Milestone 1 delivers a production-style foundation: authentication, roles and complete inventory management.</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className={`feature-card tone-${f.tone}`}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <h2 className="section-title">How it works</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="step-card">
              <span className="step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container footer-inner">
          <span>FreshTrack - Food Freshness Monitoring Platform</span>
          <small>Built with React, FastAPI, SQLAlchemy &amp; PostgreSQL · Infosys Springboard Internship 2026</small>
        </div>
      </footer>
    </div>
  )
}

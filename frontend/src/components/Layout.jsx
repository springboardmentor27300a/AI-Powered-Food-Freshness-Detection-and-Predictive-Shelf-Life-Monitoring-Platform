/**
 * App shell for authenticated pages: responsive sidebar navigation + topbar.
 */
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils/constants'
import { initials } from '../utils/helpers'
import {
  BellIcon, BoxIcon, CameraIcon, ChartIcon, CloseIcon, DashboardIcon,
  LeafLogo, ListIcon, LogoutIcon, MenuIcon, PlusCircleIcon,
  PulseIcon, ReportIcon, SparkleIcon, StarIcon, ThermometerIcon, UserIcon, UsersIcon,
} from './icons'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/add-food-item': 'Add Food Item',
  '/inventory': 'Inventory Management',
  '/freshness-analysis': 'Freshness Analysis',
  '/reports': 'Centralized Quality Reports',
  '/shelf-life': 'Shelf-Life Prediction',
  '/storage': 'Storage Conditions',
  '/scoring': 'Freshness Scoring',
  '/insights': 'Inventory Insights',
  '/analytics': 'Analytics Dashboard',
  '/recommendations': 'Recommendations',
  '/alerts': 'Alerts',
  '/users': 'All Users',
  '/profile': 'My Profile',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => setSidebarOpen(false), [location.pathname])

  if (!user) return null

  // Every navigable page, keyed once and re-used by the per-role menus below.
  const NAV_ITEMS = {
    dashboard: { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
    addFood: { to: '/add-food-item', label: 'Add Food Item', icon: PlusCircleIcon },
    inventory: { to: '/inventory', label: 'Inventory', icon: BoxIcon },
    analysis: { to: '/freshness-analysis', label: 'Freshness Analysis', icon: CameraIcon },
    reports: { to: '/reports', label: 'Reports', icon: ReportIcon },
    shelfLife: { to: '/shelf-life', label: 'Shelf-Life', icon: PulseIcon },
    storage: { to: '/storage', label: 'Storage Conditions', icon: ThermometerIcon },
    scoring: { to: '/scoring', label: 'Freshness Scoring', icon: StarIcon },
    insights: { to: '/insights', label: 'Inventory Insights', icon: SparkleIcon },
    analytics: { to: '/analytics', label: 'Analytics', icon: ChartIcon },
    recommendations: { to: '/recommendations', label: 'Recommendations', icon: ListIcon },
    alerts: { to: '/alerts', label: 'Alerts', icon: BellIcon },
    users: { to: '/users', label: 'Users', icon: UsersIcon },
    profile: { to: '/profile', label: 'Profile', icon: UserIcon },
  }

  // Role-based sidebar: users ONLY ever see their own permitted pages.
  // There is no role switcher - /dashboard always renders the user's own role.
  const ROLE_NAV = {
    consumer: [
      { items: ['dashboard', 'addFood', 'inventory'] },
      { label: 'Freshness Intelligence', items: ['analysis', 'shelfLife', 'storage', 'recommendations'] },
      { items: ['alerts', 'reports', 'profile'] },
    ],
    retail_manager: [
      { items: ['dashboard', 'addFood', 'inventory'] },
      { label: 'Freshness Intelligence', items: ['analysis', 'shelfLife', 'storage', 'scoring'] },
      { label: 'Retail Insights', items: ['insights', 'analytics', 'recommendations', 'alerts'] },
      { items: ['reports', 'profile'] },
    ],
    warehouse_operator: [
      { items: ['dashboard', 'addFood', 'inventory'] },
      { label: 'Storage & Freshness', items: ['storage', 'analysis', 'shelfLife', 'scoring'] },
      { label: 'Warehouse Insights', items: ['recommendations', 'alerts'] },
      { items: ['reports', 'profile'] },
    ],
    quality_inspector: [
      { items: ['dashboard', 'inventory'] },
      { label: 'Quality Inspection', items: ['analysis', 'scoring', 'shelfLife'] },
      { label: 'Quality Insights', items: ['analytics', 'alerts'] },
      { items: ['reports', 'profile'] },
    ],
    administrator: [
      { items: ['dashboard', 'addFood', 'inventory'] },
      { label: 'Platform Analytics', items: ['analytics', 'insights', 'scoring'] },
      { label: 'Freshness Intelligence', items: ['analysis', 'shelfLife', 'storage', 'recommendations'] },
      { items: ['users', 'alerts', 'reports', 'profile'] },
    ],
  }

  const navGroups = (ROLE_NAV[user.role] || ROLE_NAV.consumer).map((group) => ({
    ...group,
    items: group.items.map((key) => NAV_ITEMS[key]).filter(Boolean),
  }))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getPageTitle = () => {
    if (location.pathname.startsWith('/freshness-analysis/')) return 'Freshness Analysis'
    if (location.pathname.startsWith('/shelf-life/')) return 'Shelf-Life Prediction'
    if (location.pathname.startsWith('/storage/')) return 'Storage Conditions'
    return PAGE_TITLES[location.pathname] || 'Food Freshness Monitoring'
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><LeafLogo size={22} /></span>
          <div className="brand-text">
            <strong>FreshTrack</strong>
            <small>Food Freshness Platform</small>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        <nav className="side-nav">
          {navGroups.map((group, gi) => (
            <div key={gi} className="nav-group">
              {group.label && <div className="nav-label">{group.label}</div>}
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-footer">
          <button type="button" className="btn btn-outline btn-block" onClick={handleLogout}>
            <LogoutIcon size={16} /> Logout
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <h1 className="page-title">{getPageTitle()}</h1>
          <div className="user-chip" title={user.email}>
            <span className="avatar">{initials(user.full_name)}</span>
            <span className="chip-text">
              <strong>{user.full_name}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

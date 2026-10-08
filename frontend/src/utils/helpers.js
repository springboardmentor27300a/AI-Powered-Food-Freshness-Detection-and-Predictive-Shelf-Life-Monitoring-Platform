/** Small formatting / freshness helpers shared by pages. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-08-21" -> "21 Aug 2026" */
export function formatDate(isoDate) {
  if (!isoDate) return '-'
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`
}

export function formatDateTime(isoDateTime) {
  if (!isoDateTime) return '-'
  const dt = new Date(isoDateTime)
  if (Number.isNaN(dt.getTime())) return isoDateTime
  return `${formatDate(dt.toISOString().slice(0, 10))}, ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** Signed days from today until the given ISO date (negative when past). */
export function daysUntil(isoDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${isoDate}T00:00:00`)
  return Math.round((target - today) / 86400000)
}

export function getFreshnessStatus(expiryIsoDate) {
  const d = daysUntil(expiryIsoDate)
  if (d < 0) return 'Expired'
  if (d <= 3) return 'Expiring Soon'
  return 'Fresh'
}

export function describeExpiry(isoDate) {
  const d = daysUntil(isoDate)
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Expires tomorrow'
  if (d > 1) return `Expires in ${d} days`
  if (d === -1) return 'Expired yesterday'
  return `Expired ${Math.abs(d)} days ago`
}

/**
 * Granular, dynamically computed expiry status (never hardcoded).
 * Returns { label, tone, days, level } where level is the inventory priority.
 */
export function expiryPriority(isoDate) {
  const d = daysUntil(isoDate)
  if (d < 0) return { label: 'EXPIRED', tone: 'red', days: d, level: 'CRITICAL' }
  if (d === 0) return { label: 'EXPIRING TODAY', tone: 'red', days: d, level: 'HIGH' }
  if (d <= 3) return { label: 'EXPIRING WITHIN 3 DAYS', tone: 'amber', days: d, level: d <= 1 ? 'HIGH' : 'MEDIUM' }
  if (d <= 7) return { label: 'EXPIRING WITHIN 7 DAYS', tone: 'amber', days: d, level: 'MEDIUM' }
  return { label: 'SAFE', tone: 'green', days: d, level: 'LOW' }
}

/** Inventory priority badge class for CRITICAL/HIGH/MEDIUM/LOW. */
export function priorityBadgeClass(level) {
  const map = { CRITICAL: 'badge-red', HIGH: 'badge-red', MEDIUM: 'badge-amber', LOW: 'badge-green' }
  return map[level] || 'badge-amber'
}

/** Role-specific recommended action for a batch approaching (or past) expiry. */
export function expiryAction(isoDate, role) {
  const d = daysUntil(isoDate)
  if (d < 0) {
    return 'Do not sell or consume. Remove or inspect according to safety procedure.'
  }
  const actions = {
    consumer: 'Consume this food soon.',
    retail_manager: 'Sell this batch first / apply inventory rotation (FEFO).',
    warehouse_operator: 'Prioritize this batch for dispatch using FEFO.',
    quality_inspector: 'Inspect this batch first and record the quality assessment.',
    administrator: 'Prioritize this batch for dispatch/sale and review platform stock.',
  }
  if (d === 0) return `Use today. ${actions[role] || actions.administrator}`
  return actions[role] || actions.administrator
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function formatQuantity(value) {
  const n = Number(value)
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')
}

/** Get badge class for a freshness classification. */
export function classificationBadge(cls) {
  const map = {
    Fresh: 'badge-green',
    Good: '',
    Acceptable: 'badge-amber',
    'Near Spoilage': 'badge-red',
    Spoiled: 'badge-red',
  }
  return map[cls] || 'badge-amber'
}

/** Get badge class for a spoilage risk level. */
export function riskBadge(level) {
  const map = {
    low: 'badge-green',
    moderate: 'badge-amber',
    high: 'badge-red',
    critical: 'badge-red',
  }
  return map[level] || 'badge-amber'
}

/** Tone for the OVERALL freshness status (Milestone 3). */
export function getFreshnessTone(status) {
  const map = {
    Fresh: 'green',
    Acceptable: 'blue',
    'Needs Attention': 'amber',
    Spoiled: 'red',
  }
  return map[status] || 'amber'
}

/** Tone for a storage parameter status. */
export function storageStatusTone(status) {
  const map = {
    good: 'green',
    warning: 'amber',
    critical: 'red',
    unknown: 'neutral',
    not_applicable: 'neutral',
  }
  return map[status] || 'neutral'
}

export function formatScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
}

/** Trigger a browser download for a blob from the API (PDF/Excel exports). */
export async function downloadReport(url, filename) {
  const { default: api } = await import('../services/api')
  const res = await api.get(url, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}

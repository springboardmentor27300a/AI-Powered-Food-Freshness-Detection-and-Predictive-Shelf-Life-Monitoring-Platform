/** Colored pill for the dynamically computed freshness status. */
export default function StatusBadge({ status }) {
  const cls =
    status === 'Fresh' ? 'badge badge-green' : status === 'Expiring Soon' ? 'badge badge-amber' : 'badge badge-red'
  return <span className={cls}>{status}</span>
}

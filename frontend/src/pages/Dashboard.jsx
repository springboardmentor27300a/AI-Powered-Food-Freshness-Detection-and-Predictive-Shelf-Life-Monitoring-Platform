/**
 * Centralized Dashboard Controller.
 *
 * Renders EXACTLY ONE dashboard: the one that belongs to the authenticated
 * user's role (Consumer / Retail Manager / Warehouse Operator / Food Quality
 * Inspector / Administrator). There is no role switcher - the route always
 * resolves to the logged-in user's own dashboard, and the backend only ever
 * returns data that role is allowed to see.
 */
import ExpiringSoonPanel from '../components/ExpiringSoonPanel'
import { useAuth } from '../context/AuthContext'
import ConsumerDashboard from '../components/dashboards/ConsumerDashboard'
import RetailManagerDashboard from '../components/dashboards/RetailManagerDashboard'
import WarehouseOperatorDashboard from '../components/dashboards/WarehouseOperatorDashboard'
import QualityInspectorDashboard from '../components/dashboards/QualityInspectorDashboard'
import AdministratorDashboard from '../components/dashboards/AdministratorDashboard'

const DASHBOARDS = {
  consumer: ConsumerDashboard,
  retail_manager: RetailManagerDashboard,
  warehouse_operator: WarehouseOperatorDashboard,
  quality_inspector: QualityInspectorDashboard,
  administrator: AdministratorDashboard,
}

export default function Dashboard() {
  const { user } = useAuth()

  if (!user) return null

  // The dashboard is determined solely by the authenticated user's role.
  const ActiveDashboard = DASHBOARDS[user.role] || ConsumerDashboard

  return (
    <div className="page dashboard-container">
      {/* Top priority: nearest-expiry batches first (FEFO) with role-based actions */}
      <ExpiringSoonPanel />

      <ActiveDashboard user={user} />
    </div>
  )
}

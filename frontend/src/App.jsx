import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './components/RouteGuards'
import { AuthProvider } from './context/AuthContext'
import AddFoodItem from './pages/AddFoodItem'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import Dashboard from './pages/Dashboard'
import FreshnessAnalysis from './pages/FreshnessAnalysis'
import Reports from './pages/Reports'
import Home from './pages/Home'
import Insights from './pages/Insights'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Recommendations from './pages/Recommendations'
import Register from './pages/Register'
import Scoring from './pages/Scoring'
import ShelfLife from './pages/ShelfLife'
import StorageMonitoring from './pages/StorageMonitoring'
import Users from './pages/Users'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Authenticated app shell (sidebar layout) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Role-restricted routes: everyone else is bounced to their own /dashboard */}
              <Route element={<RoleRoute roles={['consumer', 'retail_manager', 'warehouse_operator', 'administrator']} />}>
                <Route path="/add-food-item" element={<AddFoodItem />} />
              </Route>

              <Route path="/inventory" element={<Inventory />} />
              <Route path="/freshness-analysis" element={<FreshnessAnalysis />} />
              <Route path="/freshness-analysis/:batchId" element={<FreshnessAnalysis />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/freshness-reports" element={<Navigate to="/reports" replace />} />
              <Route path="/shelf-life" element={<ShelfLife />} />
              <Route path="/shelf-life/:batchId" element={<ShelfLife />} />
              <Route path="/storage" element={<StorageMonitoring />} />
              <Route path="/storage/:batchId" element={<StorageMonitoring />} />
              <Route path="/scoring" element={<Scoring />} />
              <Route path="/recommendations" element={<Recommendations />} />

              <Route element={<RoleRoute roles={['retail_manager', 'warehouse_operator', 'administrator']} />}>
                <Route path="/insights" element={<Insights />} />
              </Route>

              <Route element={<RoleRoute roles={['retail_manager', 'warehouse_operator', 'quality_inspector', 'administrator']} />}>
                <Route path="/analytics" element={<Analytics />} />
              </Route>

              <Route path="/alerts" element={<Alerts />} />

              <Route element={<RoleRoute roles={['administrator']} />}>
                <Route path="/users" element={<Users />} />
              </Route>

              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

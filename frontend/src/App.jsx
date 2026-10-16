import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import NotFound from "./pages/NotFound.jsx";
import FreshnessAnalysis from "./pages/FreshnessAnalysis.jsx";

import ConsumerDashboard from "./pages/dashboards/ConsumerDashboard.jsx";
import RetailDashboard from "./pages/dashboards/RetailDashboard.jsx";
import WarehouseDashboard from "./pages/dashboards/WarehouseDashboard.jsx";
import InspectorDashboard from "./pages/dashboards/InspectorDashboard.jsx";
import AdminDashboard from "./pages/dashboards/AdminDashboard.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      {/* Default route */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Role-protected dashboards */}

      <Route
        path="/consumer/dashboard"
        element={
          <ProtectedRoute allowedRoles={["consumer"]}>
            <ConsumerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/retail/dashboard"
        element={
          <ProtectedRoute allowedRoles={["retail_manager"]}>
            <RetailDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/warehouse/dashboard"
        element={
          <ProtectedRoute allowedRoles={["warehouse_operator"]}>
            <WarehouseDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspector/dashboard"
        element={
          <ProtectedRoute allowedRoles={["food_quality_inspector"]}>
            <InspectorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Freshness Analysis */}
      <Route
        path="/freshness-analysis"
        element={
          <ProtectedRoute
            allowedRoles={[
              "consumer",
              "retail_manager",
              "warehouse_operator",
              "food_quality_inspector",
              "administrator",
            ]}
          >
            <FreshnessAnalysis />
          </ProtectedRoute>
        }
      />

      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedLayout from "./components/layout/ProtectedLayout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Batches from "./pages/Batches";
import InventoryOverview from "./pages/InventoryOverview";
import FoodDetails from "./pages/FoodDetails";
import BatchDetails from "./pages/BatchDetails";
import FEFO from "./pages/FEFO";

import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";

import ImageUpload from "./pages/ImageUpload";

import FreshnessReports from "./pages/FreshnessReports";
import ReportDetail from "./pages/ReportDetail";

import ShelfLifePrediction from "./pages/ShelfLifePrediction";
import ShelfLifeReports from "./pages/ShelfLifeReports";

import Recommendations from "./pages/Recommendations";
import WasteReduction from "./pages/WasteReduction";

import InventoryQualityReports from "./pages/InventoryQualityReports";
import WasteReductionReports from "./pages/WasteReductionReports";
import StorageComplianceReports from "./pages/StorageComplianceReports";

import StorageMonitoring from "./pages/StorageMonitoring";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        }
      />

      {/* Food Management */}
      <Route
        path="/inventory"
        element={
          <ProtectedLayout>
            <Inventory />
          </ProtectedLayout>
        }
      />

      <Route
        path="/inventory/:id"
        element={
          <ProtectedLayout>
            <FoodDetails />
          </ProtectedLayout>
        }
      />

      <Route
        path="/inventory-overview"
        element={
          <ProtectedLayout>
            <InventoryOverview />
          </ProtectedLayout>
        }
      />

      <Route
        path="/fefo"
        element={
          <ProtectedLayout>
            <FEFO />
          </ProtectedLayout>
        }
      />

      <Route
        path="/batches"
        element={
          <ProtectedLayout>
            <Batches />
          </ProtectedLayout>
        }
      />

      <Route
        path="/batches/:id"
        element={
          <ProtectedLayout>
            <BatchDetails />
          </ProtectedLayout>
        }
      />

      {/* Food Image Analysis */}
      <Route
        path="/upload"
        element={
          <ProtectedLayout
            allowedRoles={["quality_inspector", "administrator"]}
          >
            <ImageUpload />
          </ProtectedLayout>
        }
      />

      {/* Freshness Reports */}
      <Route
        path="/reports"
        element={
          <ProtectedLayout>
            <FreshnessReports />
          </ProtectedLayout>
        }
      />

      <Route
        path="/reports/:id"
        element={
          <ProtectedLayout>
            <ReportDetail />
          </ProtectedLayout>
        }
      />

      {/* Shelf Life */}
      <Route
        path="/shelf-life"
        element={
          <ProtectedLayout>
            <ShelfLifePrediction />
          </ProtectedLayout>
        }
      />

      <Route
        path="/shelf-life-reports"
        element={
          <ProtectedLayout>
            <ShelfLifeReports />
          </ProtectedLayout>
        }
      />

      {/* AI Insights */}
      <Route
        path="/recommendations"
        element={
          <ProtectedLayout>
            <Recommendations />
          </ProtectedLayout>
        }
      />

      <Route
        path="/waste-reduction"
        element={
          <ProtectedLayout>
            <WasteReduction />
          </ProtectedLayout>
        }
      />

      {/* Remaining Reports */}
      <Route
        path="/inventory-quality-reports"
        element={
          <ProtectedLayout>
            <InventoryQualityReports />
          </ProtectedLayout>
        }
      />

      <Route
        path="/waste-reduction-reports"
        element={
          <ProtectedLayout>
            <WasteReductionReports />
          </ProtectedLayout>
        }
      />

      <Route
        path="/storage-compliance-reports"
        element={
          <ProtectedLayout>
            <StorageComplianceReports />
          </ProtectedLayout>
        }
      />

      {/* Storage & Analytics */}
      <Route
        path="/storage"
        element={
          <ProtectedLayout>
            <StorageMonitoring />
          </ProtectedLayout>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedLayout>
            <Analytics />
          </ProtectedLayout>
        }
      />

      {/* Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedLayout>
            <Profile />
          </ProtectedLayout>
        }
      />

      {/* Administration */}
      <Route
        path="/admin/users"
        element={
          <ProtectedLayout allowedRoles={["administrator"]}>
            <AdminUsers />
          </ProtectedLayout>
        }
      />

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
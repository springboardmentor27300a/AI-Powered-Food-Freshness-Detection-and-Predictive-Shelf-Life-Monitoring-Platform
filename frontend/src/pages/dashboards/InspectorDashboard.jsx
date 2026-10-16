import React from "react";
import DashboardLayout from "../../components/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ProfileTable } from "./ConsumerDashboard.jsx";
import ReportDownloads from "../../components/dashboard/ReportDownloads.jsx";

export default function InspectorDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Food Quality Inspector Dashboard">
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Welcome, {user?.full_name?.split(" ")[0]} 👋
      </h2>
      <p className="text-gray-500 mb-8">
        Quality inspections, spoilage detection reviews, and compliance validation.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Pending Inspections" value="0" />
        <StatCard label="Spoilage Flags" value="0" />
        <StatCard label="Compliance Rate" value="—" />
      </div>

      <div className="mt-10">
        <ReportDownloads subtitle="Download PDF or Excel reports for the shared inventory" />
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-800 mb-2">Account details</h3>
        <ProfileTable user={user} />
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

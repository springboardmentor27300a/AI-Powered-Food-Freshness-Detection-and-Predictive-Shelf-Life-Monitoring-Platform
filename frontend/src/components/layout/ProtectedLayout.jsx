import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AppShell from "./AppShell";

export default function ProtectedLayout({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <AppShell>
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-600">Access denied</p>
          <p className="mt-1 text-sm text-slate-600">
            Your role does not have permission to view this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}

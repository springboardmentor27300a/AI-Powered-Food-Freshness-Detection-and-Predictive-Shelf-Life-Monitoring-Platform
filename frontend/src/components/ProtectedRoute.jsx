import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
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
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-danger-500/30 bg-danger-500/5 p-6 text-center">
        <p className="font-medium text-danger-500">Access denied</p>
        <p className="mt-1 text-sm text-slate-600">
          Your role does not have permission to view this page.
        </p>
      </div>
    );
  }

  return children;
}

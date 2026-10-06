import React, { useEffect, useState } from "react";
import { listUsers, updateUserRole } from "../api/admin";

const ROLES = ["consumer", "retail_manager", "warehouse_operator", "quality_inspector", "administrator"];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setUsers(await listUsers());
    } catch {
      setError("Could not load users.");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRoleChange(userId, role) {
    await updateUserRole(userId, role);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">User Management</h1>
      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">{u.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

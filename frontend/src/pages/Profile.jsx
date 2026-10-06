import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.full_name || "", email: user.email });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const res = await client.put("/users/me", form);
      setUser(res.data);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">My Profile</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-400">Username</dt><dd>{user.username}</dd></div>
          <div><dt className="text-slate-400">Role</dt><dd className="capitalize">{user.role.replace("_", " ")}</dd></div>
        </dl>

        {message && <div className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</div>}
        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save changes
          </button>
        </form>
      </div>
    </div>
  );
}

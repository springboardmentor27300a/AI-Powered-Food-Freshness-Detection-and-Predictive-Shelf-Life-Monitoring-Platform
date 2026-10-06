import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listReports } from "../api/reports";
import FreshnessBadge from "../components/FreshnessBadge";

const CATEGORY_OPTIONS = ["", "fresh", "good", "acceptable", "near_spoilage", "spoiled"];

export default function FreshnessReports() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: 15, sort_by: sortBy, sort_dir: sortDir };
      if (category) params.category = category;
      const res = await listReports(params);
      setReports(res.items);
      setTotal(res.total);
    } catch {
      setError("Could not load freshness reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, category, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Freshness Reports</h1>
        <Link to="/upload" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + New Analysis
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c ? c.replace("_", " ") : "All categories"}</option>
          ))}
        </select>
        <select value={`${sortBy}:${sortDir}`} onChange={(e) => {
          const [sb, sd] = e.target.value.split(":"); setSortBy(sb); setSortDir(sd);
        }} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="freshness_score:desc">Highest score</option>
          <option value="freshness_score:asc">Lowest score</option>
        </select>
      </div>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : reports.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No freshness reports yet. Analyze an image to generate one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Report #</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Spoilage Risk</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/reports/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.report_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.freshness_score}</td>
                  <td className="px-4 py-3"><FreshnessBadge category={r.freshness_category} /></td>
                  <td className="px-4 py-3">{r.spoilage_probability_pct}%</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded-md bg-slate-100 px-3 py-1.5 disabled:opacity-40">Prev</button>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="rounded-md bg-slate-100 px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { downloadReport } from "../../api/reports.js";
import { Card, ErrorBanner, SuccessBanner, Note } from "./ui.jsx";

export const INVENTORY_REPORTS = [
  { kind: "freshness", label: "Freshness assessment report", hint: "Latest and past freshness results per item" },
  { kind: "shelf-life", label: "Shelf-life prediction report", hint: "Remaining days, forecast expiry and risk" },
  { kind: "inventory-quality", label: "Inventory quality report", hint: "Freshness, storage and health score per item" },
  { kind: "waste-reduction", label: "Waste-reduction report", hint: "Items at risk of waste and suggested actions" },
  { kind: "storage-compliance", label: "Storage-compliance report", hint: "Recorded readings against recommended ranges" },
];

export const ADMIN_REPORTS = [
  { kind: "platform-summary", label: "Platform summary report", hint: "Aggregate counts only, no personal data" },
];

const btn =
  "rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Download card. `reports` is a list from INVENTORY_REPORTS / ADMIN_REPORTS.
 * `isEmpty` (optional) tells the card there is no inventory yet, so the
 * user knows the file will say so instead of containing data.
 */
export default function ReportDownloads({ reports = INVENTORY_REPORTS, isEmpty = false, id = "reports", subtitle }) {
  const [busy, setBusy] = useState(null); // "kind:format" while downloading
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  const run = async (kind, format, label) => {
    if (busy) return;
    setBusy(`${kind}:${format}`);
    setMessage(null);
    try {
      const filename = await downloadReport(kind, format);
      setMessage({ type: "ok", text: `${label} downloaded as ${filename}.` });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Could not generate the report." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card id={id} title="Reports & Exports" subtitle={subtitle || "Download PDF or Excel reports built from your recorded data"} className="mb-4">
      {message?.type === "error" && <ErrorBanner>{message.text}</ErrorBanner>}
      {message?.type === "ok" && <SuccessBanner>{message.text}</SuccessBanner>}
      {isEmpty && (
        <Note>No inventory items yet. You can still download a report; it will state that there is no data.</Note>
      )}
      <ul className="divide-y divide-gray-100">
        {reports.map((r) => (
          <li key={r.kind} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{r.label}</p>
              <p className="text-xs text-gray-500">{r.hint}</p>
            </div>
            <div className="flex gap-2">
              {[["pdf", "PDF"], ["xlsx", "Excel"]].map(([fmt, text]) => {
                const loading = busy === `${r.kind}:${fmt}`;
                return (
                  <button
                    key={fmt}
                    type="button"
                    className={btn}
                    disabled={busy !== null}
                    onClick={() => run(r.kind, fmt, `${r.label} (${text})`)}
                    aria-label={`Download ${r.label} as ${text}`}
                  >
                    {loading ? "Preparing…" : text}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <Note>Scores and forecasts are heuristic estimates, not a food-safety certification. Missing data is shown as “Not recorded”, never as zero.</Note>
    </Card>
  );
}

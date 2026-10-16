import { useCallback, useEffect, useState } from "react";
import { getInventory } from "../../api/inventory.js";
import { getItemAnalysis } from "../../api/analysis.js";
import { getMyAlerts } from "../../api/alerts.js";
import { buildRows } from "./status.js";

// Loads the logged-in user's own inventory, alerts and per-item analysis
// using the EXISTING API clients. Re-loads analyses whenever the item
// list changes (add / edit / delete), and ignores late responses so
// stale data can never overwrite fresh data.
export default function useDashboardData() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(true);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // 1) inventory + alerts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getInventory(), getMyAlerts().catch(() => [])])
      .then(([inv, al]) => {
        if (cancelled) return;
        setItems(inv);
        setAlerts(al);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your dashboard data. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // 2) per-item analysis (shelf life, health score, storage guidance)
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setAnalyses({});
      return undefined;
    }
    setAnalysesLoading(true);
    Promise.all(
      items.map(async (item) => {
        try {
          return [item.id, await getItemAnalysis(item.id)];
        } catch {
          return [item.id, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setAnalyses(Object.fromEntries(entries));
      setAnalysesLoading(false);
      // refresh alerts too, since they depend on the same items
      getMyAlerts()
        .then((al) => !cancelled && setAlerts(al))
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const rows = buildRows(items, analyses);

  return { items, setItems, alerts, analyses, rows, loading, analysesLoading, error, reload };
}

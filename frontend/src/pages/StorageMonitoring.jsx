import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  addStorageReading,
  getStorageAlerts,
  getStorageTrends,
  listStorageReadings,
} from "../api/storage";
import { listBatches } from "../api/batches";

const AIR_OPTIONS = ["", "poor", "moderate", "good"];
const LIGHT_OPTIONS = ["", "none", "low", "moderate", "high"];

export default function StorageMonitoring() {
  const { user } = useAuth();
  const canLog = ["warehouse_operator", "administrator"].includes(user.role);

  const [readings, setReadings] = useState([]);
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState([]);

  const [form, setForm] = useState({
    batch_id: "",
    storage_location: "",
    temperature_c: "",
    humidity_pct: "",
    air_circulation: "",
    light_exposure: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [trendLocation, setTrendLocation] = useState("");
  const [trend, setTrend] = useState(null);

  async function loadReadings() {
    try {
      const res = await listStorageReadings({ limit: 50 });
      setReadings(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError("Could not load storage readings.");
    }
  }
  const loadAlerts = async () => {
  try {
    const data = await getStorageAlerts();
    setAlerts(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Failed to load storage alerts:", err);
    setAlerts([]);
  }
};
  async function loadBatches() {
    try {
      const res = await listBatches({
        page: 1,
        page_size: 100,
      });

      setBatches(res.items || res || []);
    } catch (err) {
      console.error("Could not load batches:", err);
    }
  }

  useEffect(() => {
  loadReadings();
  loadBatches();
  loadAlerts();
}, []);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    try {
      const payload = {
        batch_id: form.batch_id || null,
        storage_location: form.storage_location,
        temperature_c: Number(form.temperature_c),
        humidity_pct: Number(form.humidity_pct),
        air_circulation: form.air_circulation || null,
        light_exposure: form.light_exposure || null,
      };

      const reading = await addStorageReading(payload);

      setSuccess(
        reading.is_compliant
          ? "Reading logged — within compliant range."
          : `Reading logged — NOT compliant: ${reading.compliance_notes}`
      );

      setForm({
        batch_id: "",
        storage_location: "",
        temperature_c: "",
        humidity_pct: "",
        air_circulation: "",
        light_exposure: "",
      });

      await loadReadings();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not log storage reading."
      );
    }
  }

  async function handleViewTrend() {
    if (!trendLocation) return;

    setError("");

    try {
      const res = await getStorageTrends(trendLocation, 14);
      setTrend(res);
    } catch (err) {
      setError("Could not load storage trend.");
    }
  }

  function getBatchLabel(batch) {
    const batchCode = batch.batch_code || batch.id;

    const foodName =
      batch.food_item?.name ||
      batch.food_item_name ||
      "";

    return foodName
      ? `${batchCode} — ${foodName}`
      : batchCode;
  }

  function getBatchDisplay(batchId) {
    if (!batchId) return "General";

    const batch = batches.find(
      (b) => String(b.id) === String(batchId)
    );

    if (batch) {
      return getBatchLabel(batch);
    }

    return batchId;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Storage Condition Monitoring
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor storage conditions and associate readings with specific food
          batches.
        </p>
      </div>
      {/* Smart Storage Alerts */}
<div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-semibold text-slate-900">
    🌡️ Smart Storage Alerts
  </h2>

  <p className="mt-1 mb-5 text-sm text-slate-500">
    Monitor the latest storage condition associated with each food batch.
  </p>

  {alerts.length === 0 ? (
    <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
      No storage alerts available.
    </div>
  ) : (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.batch_id}
          className={`rounded-xl border p-4 ${
            alert.status === "attention"
              ? "border-orange-200 bg-orange-50"
              : alert.status === "compliant"
              ? "border-green-200 bg-green-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                {alert.status === "attention"
                  ? "⚠️"
                  : alert.status === "compliant"
                  ? "🟢"
                  : "⚪"}{" "}
                {alert.food_name}
              </h3>

              <p className="text-sm text-slate-600">
                Batch: {alert.batch_code}
              </p>

              {alert.storage_location && (
                <p className="text-sm text-slate-600">
                  Location: {alert.storage_location}
                </p>
              )}
            </div>

            <div className="text-right text-sm">
              {alert.temperature_c !== null && (
                <p>Temperature: {alert.temperature_c}°C</p>
              )}

              {alert.humidity_pct !== null && (
                <p>Humidity: {alert.humidity_pct}%</p>
              )}

              <p className="mt-1 text-slate-600">
                {alert.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
      {/* Log reading form */}
      {canLog && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Log a Storage Reading
          </h2>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

            {/* Batch */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Batch
              </label>

              <select
                value={form.batch_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    batch_id: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  General storage reading — no specific batch
                </option>

                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {getBatchLabel(batch)}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-slate-500">
                Select a batch if this reading is for a specific food batch.
              </p>
            </div>

            {/* Storage location */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Storage Location
              </label>

              <input
                required
                placeholder="e.g. Cold Room A"
                value={form.storage_location}
                onChange={(e) =>
                  setForm({
                    ...form,
                    storage_location: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Temperature (°C)
              </label>

              <input
                required
                type="number"
                step="0.1"
                placeholder="e.g. 8"
                value={form.temperature_c}
                onChange={(e) =>
                  setForm({
                    ...form,
                    temperature_c: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Humidity */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Humidity (%)
              </label>

              <input
                required
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="e.g. 65"
                value={form.humidity_pct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    humidity_pct: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Air circulation */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Air Circulation
              </label>

              <select
                value={form.air_circulation}
                onChange={(e) =>
                  setForm({
                    ...form,
                    air_circulation: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {AIR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option
                      ? option.charAt(0).toUpperCase() + option.slice(1)
                      : "Optional"}
                  </option>
                ))}
              </select>
            </div>

            {/* Light exposure */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Light Exposure
              </label>

              <select
                value={form.light_exposure}
                onChange={(e) =>
                  setForm({
                    ...form,
                    light_exposure: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {LIGHT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option
                      ? option.charAt(0).toUpperCase() + option.slice(1)
                      : "Optional"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Log Reading
          </button>
        </form>
      )}

      {/* 14-day trend */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Storage Trend
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            placeholder="Storage location for trend"
            value={trendLocation}
            onChange={(e) => setTrendLocation(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={handleViewTrend}
            className="rounded-md bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200"
          >
            View 14-day trend
          </button>
        </div>

        {trend && (
          <div className="mt-4 text-sm">
            {trend.points.length === 0 ? (
              <p className="text-slate-500">
                No readings for this location in the last 14 days.
              </p>
            ) : (
              <div className="space-y-1">
                {trend.points.map((point, index) => (
                  <div
                    key={index}
                    className="flex justify-between border-b border-slate-50 py-2"
                  >
                    <span className="text-slate-500">
                      {new Date(point.recorded_at).toLocaleString()}
                    </span>

                    <span className="font-medium text-slate-700">
                      {point.temperature_c}°C / {point.humidity_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Readings table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Recent Storage Readings
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Temp</th>
                <th className="px-4 py-3">Humidity</th>
                <th className="px-4 py-3">Compliant</th>
                <th className="px-4 py-3">Recorded</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {readings.map((reading) => (
                <tr key={reading.id}>

                  <td className="px-4 py-3">
                    <span
                      className={
                        reading.batch_id
                          ? "font-medium text-slate-700"
                          : "text-slate-500"
                      }
                    >
                      {getBatchDisplay(reading.batch_id)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {reading.storage_location}
                  </td>

                  <td className="px-4 py-3">
                    {reading.temperature_c}°C
                  </td>

                  <td className="px-4 py-3">
                    {reading.humidity_pct}%
                  </td>

                  <td className="px-4 py-3">
                    {reading.is_compliant ? (
                      <span className="text-brand-700">
                        Yes
                      </span>
                    ) : (
                      <span
                        title={reading.compliance_notes}
                        className="text-red-600"
                      >
                        No
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {new Date(
                      reading.recorded_at
                    ).toLocaleString()}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {readings.length === 0 && (
          <p className="p-6 text-sm text-slate-500">
            No storage readings logged yet ({total} total).
          </p>
        )}
      </div>
    </div>
  );
}
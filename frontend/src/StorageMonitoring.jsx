
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import "./StorageMonitoring.css";

const STORAGE_TYPES = [
  "Cold Room",
  "Refrigerator/Chiller",
  "Freezer",
  "Regular Storage",
];

const emptyForm = {
  name: "",
  storage_type: "Cold Room",
  location: "",
  min_temperature: "2",
  max_temperature: "8",
  target_temperature: "5",
  current_temperature: "5",
};

async function requestJson(path, options = {}) {
  const response = await apiFetch(path, options);
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || `Request failed (${response.status})`
    );
  }

  return data;
}

function getList(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function getStatus(unit) {
  if (unit.is_active === false) {
    return { label: "Inactive", className: "sm-inactive" };
  }

  const current = Number(unit.current_temperature);
  const min = Number(unit.min_temperature);
  const max = Number(unit.max_temperature);

  if (
    unit.current_temperature == null ||
    unit.min_temperature == null ||
    unit.max_temperature == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return { label: "No reading", className: "sm-unknown" };
  }

  if (current < min || current > max) {
    return { label: "Out of range", className: "sm-danger" };
  }

  return { label: "Normal", className: "sm-normal" };
}

function StorageMonitoring({ user, onBack, onLogout }) {
  const [units, setUnits] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [readingTemperature, setReadingTemperature] = useState("");
  const [readingSource, setReadingSource] = useState("Manual entry");
  const [readings, setReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.all([
        requestJson("/storage/units"),
        requestJson("/storage/analytics").catch(() => ({})),
      ]);

      setUnits(
        getList(results[0], ["items", "units", "storage_units"])
      );
      setAnalytics(results[1] || {});
    } catch (err) {
      setError(err.message || "Unable to load storage information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeUnits = units.filter(
    (unit) => unit.is_active !== false
  );

  const outOfRange = activeUnits.filter(
    (unit) => getStatus(unit).label === "Out of range"
  );

  const unitsWithoutReadings = activeUnits.filter(
    (unit) => getStatus(unit).label === "No reading"
  );

  const filteredUnits = units.filter((unit) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      String(unit.name || "").toLowerCase().includes(query) ||
      String(unit.location || "").toLowerCase().includes(query) ||
      String(unit.storage_type || "").toLowerCase().includes(query);

    const matchesType =
      typeFilter === "All" ||
      unit.storage_type === typeFilter;

    const matchesStatus =
      statusFilter === "All" ||
      getStatus(unit).label === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  async function handleCreateUnit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const min = Number(form.min_temperature);
    const max = Number(form.max_temperature);
    const target = Number(form.target_temperature);
    const current = Number(form.current_temperature);

    if (
      !form.name.trim() ||
      !form.location.trim() ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      !Number.isFinite(target) ||
      !Number.isFinite(current)
    ) {
      setError("Complete all fields with valid values.");
      return;
    }

    if (min > max || target < min || target > max) {
      setError(
        "Minimum must not exceed maximum, and target must be within the configured range."
      );
      return;
    }

    setSaving(true);

    try {
      await requestJson("/storage/units", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          storage_type: form.storage_type,
          location: form.location.trim(),
          min_temperature: min,
          max_temperature: max,
          target_temperature: target,
          current_temperature: current,
          is_active: true,
        }),
      });

      setForm(emptyForm);
      setShowForm(false);
      setNotice("Storage unit added successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to add the storage unit.");
    } finally {
      setSaving(false);
    }
  }

  async function openReadings(unit) {
    setSelectedUnit(unit);
    setReadings([]);
    setReadingTemperature(
      unit.current_temperature == null
        ? ""
        : String(unit.current_temperature)
    );
    setReadingSource("Manual entry");
    setError("");
    setNotice("");
    setReadingsLoading(true);

    try {
      const data = await requestJson(
        `/storage/units/${unit.id}/readings`
      );

      setReadings(
        getList(data, ["items", "readings", "temperature_readings"])
      );
    } catch (err) {
      setError(
        `Unable to load readings: ${err.message}`
      );
    } finally {
      setReadingsLoading(false);
    }
  }

  async function handleAddReading(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const temperature = Number(readingTemperature);

    if (
      readingTemperature.trim() === "" ||
      !Number.isFinite(temperature)
    ) {
      setError("Enter a valid temperature.");
      return;
    }

    setSaving(true);

    try {
      await requestJson(
        `/storage/units/${selectedUnit.id}/readings`,
        {
          method: "POST",
          body: JSON.stringify({
            temperature,
            source: readingSource.trim() || "Manual entry",
          }),
        }
      );

      setNotice("Temperature reading recorded.");
      await loadData();

      const updatedUnit = units.find(
        (unit) => unit.id === selectedUnit.id
      );

      const freshData = await requestJson(
        `/storage/units/${selectedUnit.id}/readings`
      );

      setReadings(
        getList(freshData, [
          "items",
          "readings",
          "temperature_readings",
        ])
      );

      if (updatedUnit) {
        setSelectedUnit({
          ...updatedUnit,
          current_temperature: temperature,
        });
      }
    } catch (err) {
      setError(
        err.message || "Unable to record the temperature."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sm-page">
      <nav className="sm-navbar">
        <div className="sm-brand">
          <span className="sm-logo">❄️</span>
          <div>
            <strong>FoodFresh</strong>
            <small>Storage Monitoring</small>
          </div>
        </div>

        <div className="sm-user">
          <div className="sm-user-info">
            <strong>{user?.name || "User"}</strong>
            <small>{user?.role || "Staff"}</small>
          </div>

          <button
            type="button"
            className="sm-button sm-button-light"
            onClick={onBack}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="sm-button sm-button-dark"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="sm-content">
        <header className="sm-heading">
          <div>
            <span className="sm-eyebrow">
              STORAGE & TEMPERATURE CONTROL
            </span>
            <h1>Storage Monitoring</h1>
            <p>
              Monitor cold rooms, chillers, freezers, and
              regular storage using recorded temperature data.
            </p>
          </div>

          <button
            type="button"
            className="sm-button sm-button-primary"
            onClick={() => {
              setError("");
              setNotice("");
              setShowForm(!showForm);
              setSelectedUnit(null);
            }}
          >
            {showForm ? "Cancel" : "+ Add Storage Unit"}
          </button>
        </header>

        {error && (
          <div className="sm-message sm-message-error" role="alert">
            <strong>Something needs attention</strong>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
            >
              Dismiss
            </button>
          </div>
        )}

        {notice && (
          <div className="sm-message sm-message-success">
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="sm-stats">
          <article className="sm-stat">
            <span className="sm-stat-icon">🏢</span>
            <div>
              <p>Active Storage Units</p>
              <strong>
                {analytics.active_storage_units ?? activeUnits.length}
              </strong>
            </div>
          </article>

          <article className="sm-stat">
            <span className="sm-stat-icon">🌡️</span>
            <div>
              <p>Units With Readings</p>
              <strong>
                {analytics.units_with_readings ??
                  activeUnits.length - unitsWithoutReadings.length}
              </strong>
            </div>
          </article>

          <article className="sm-stat sm-stat-warning">
            <span className="sm-stat-icon">⚠️</span>
            <div>
              <p>Out of Range</p>
              <strong>
                {analytics.units_out_of_range ?? outOfRange.length}
              </strong>
            </div>
          </article>

          <article className="sm-stat">
            <span className="sm-stat-icon">📋</span>
            <div>
              <p>Recorded Readings</p>
              <strong>
                {analytics.total_recorded_readings ?? "—"}
              </strong>
            </div>
          </article>
        </section>

        {showForm && (
          <section className="sm-panel">
            <div className="sm-panel-heading">
              <div>
                <h2>Add a Storage Unit</h2>
                <p>
                  Enter the storage unit's configured temperature limits.
                </p>
              </div>
            </div>

            <form
              className="sm-form"
              onSubmit={handleCreateUnit}
            >
              <label>
                Storage Unit Name
                <input
                  required
                  value={form.name}
                  placeholder="e.g. Cold Room A"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Storage Type
                <select
                  value={form.storage_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      storage_type: event.target.value,
                    })
                  }
                >
                  {STORAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Location
                <input
                  required
                  value={form.location}
                  placeholder="e.g. Warehouse Block A"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Minimum Temperature (°C)
                <input
                  required
                  type="number"
                  step="any"
                  value={form.min_temperature}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      min_temperature: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Maximum Temperature (°C)
                <input
                  required
                  type="number"
                  step="any"
                  value={form.max_temperature}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      max_temperature: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Target Temperature (°C)
                <input
                  required
                  type="number"
                  step="any"
                  value={form.target_temperature}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      target_temperature: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Current Temperature (°C)
                <input
                  required
                  type="number"
                  step="any"
                  value={form.current_temperature}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      current_temperature: event.target.value,
                    })
                  }
                />
              </label>

              <div className="sm-form-note">
                Configure limits appropriate for the food being stored.
                The initial temperature is a manually entered value,
                not a live sensor reading.
              </div>

              <div className="sm-form-actions">
                <button
                  type="button"
                  className="sm-button sm-button-light"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sm-button sm-button-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Storage Unit"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="sm-panel">
          <div className="sm-panel-heading">
            <div>
              <h2>Storage Units</h2>
              <p>
                Select a unit to review its temperature readings.
              </p>
            </div>

            <button
              type="button"
              className="sm-button sm-button-light"
              disabled={loading}
              onClick={loadData}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="sm-filters">
            <input
              type="search"
              value={search}
              placeholder="Search by name or location..."
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search storage units"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter storage type"
            >
              <option value="All">All storage types</option>
              {STORAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter storage status"
            >
              <option value="All">All statuses</option>
              <option value="Normal">Normal</option>
              <option value="Out of range">Out of range</option>
              <option value="No reading">No reading</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <div className="sm-empty">
              Loading storage units...
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="sm-empty">
              <span>❄️</span>
              <h3>No storage units found</h3>
              <p>
                Add a storage unit or change your search filters.
              </p>
            </div>
          ) : (
            <div className="sm-unit-grid">
              {filteredUnits.map((unit) => {
                const status = getStatus(unit);

                return (
                  <article
                    className="sm-unit-card"
                    key={unit.id}
                  >
                    <div className="sm-unit-top">
                      <span className="sm-unit-icon">
                        {unit.storage_type === "Cold Room"
                          ? "❄️"
                          : unit.storage_type === "Freezer"
                            ? "🧊"
                            : unit.storage_type === "Refrigerator/Chiller"
                              ? "🥶"
                              : "🏬"}
                      </span>

                      <span className={`sm-status ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <h3>{unit.name}</h3>
                    <p className="sm-unit-type">
                      {unit.storage_type || "Storage"}
                    </p>
                    <p className="sm-unit-location">
                      📍 {unit.location || "Location not recorded"}
                    </p>

                    <div className="sm-current-temp">
                      <span>Current Temperature</span>
                      <strong>
                        {unit.current_temperature == null
                          ? "—"
                          : `${unit.current_temperature}°C`}
                      </strong>
                    </div>

                    <div className="sm-temp-range">
                      <div>
                        <span>Minimum</span>
                        <strong>
                          {unit.min_temperature ?? "—"}°C
                        </strong>
                      </div>
                      <div>
                        <span>Target</span>
                        <strong>
                          {unit.target_temperature ?? "—"}°C
                        </strong>
                      </div>
                      <div>
                        <span>Maximum</span>
                        <strong>
                          {unit.max_temperature ?? "—"}°C
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="sm-button sm-button-primary sm-full-button"
                      onClick={() => openReadings(unit)}
                    >
                      View Readings & Record Temperature
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selectedUnit && (
          <section className="sm-panel sm-readings-panel">
            <div className="sm-panel-heading">
              <div>
                <span className="sm-eyebrow">TEMPERATURE HISTORY</span>
                <h2>{selectedUnit.name}</h2>
                <p>
                  Record a temperature reading or review available history.
                </p>
              </div>

              <button
                type="button"
                className="sm-button sm-button-light"
                onClick={() => setSelectedUnit(null)}
              >
                Close
              </button>
            </div>

            <form
              className="sm-reading-form"
              onSubmit={handleAddReading}
            >
              <label>
                Temperature (°C)
                <input
                  type="number"
                  step="any"
                  required
                  value={readingTemperature}
                  onChange={(event) =>
                    setReadingTemperature(event.target.value)
                  }
                />
              </label>

              <label>
                Reading Source
                <input
                  value={readingSource}
                  onChange={(event) =>
                    setReadingSource(event.target.value)
                  }
                  placeholder="e.g. Manual entry or sensor"
                />
              </label>

              <button
                type="submit"
                className="sm-button sm-button-primary"
                disabled={saving}
              >
                {saving ? "Recording..." : "Record Reading"}
              </button>
            </form>

            <h3 className="sm-history-title">
              Previous Readings
            </h3>

            {readingsLoading ? (
              <p>Loading temperature history...</p>
            ) : readings.length === 0 ? (
              <p className="sm-muted">
                No readings are available for this unit yet.
              </p>
            ) : (
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th>Temperature</th>
                      <th>Source</th>
                      <th>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((reading, index) => (
                      <tr key={reading.id ?? index}>
                        <td>
                          {reading.temperature ?? "—"}°C
                        </td>
                        <td>{reading.source || "Not recorded"}</td>
                        <td>
                          {formatDate(
                            reading.recorded_at || reading.created_at
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <p className="sm-disclaimer">
          Status is based on recorded temperatures and configured limits.
          Manual entries are not live sensor data. Follow applicable food
          safety guidance when setting storage requirements.
        </p>
      </main>
    </div>
  );
}

export default StorageMonitoring;

import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import "./RoleDashboards.css";
import NotificationBell from "../NotificationBell";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getJson(path) {
  const response = await apiFetch(path);

  let data;

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

function Stat({ icon, label, value, hint }) {
  return (
    <div className="rd-stat">
      <div className="rd-stat-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function Action({
  icon,
  title,
  text,
  onClick,
  dark = false
}) {
  return (
    <button
      type="button"
      className={`rd-action${dark ? " rd-dark" : ""}`}
      onClick={onClick}
    >
      <i>{icon}</i>
      <strong>{title}</strong>
      <span>{text}</span>
      <b>→</b>
    </button>
  );
}

function Shell({
  user,
  onLogout,
  eyebrow,
  title,
  subtitle,
  children
}) {
  return (
    <div className="rd">

      <nav>

        <div className="rd-brand">
          <span>🍎</span>

          <div>
            <strong>FoodFresh</strong>
            <small>
              Food Freshness Monitoring Platform
            </small>
          </div>
        </div>

        <div className="rd-user">
          {/* Notification Bell */}
          <NotificationBell />

          <div className="rd-user-info">
            <span>{user?.name || "User"}</span>
            <small>{user?.role || "Warehouse Operator"}</small>
          </div>

          <button
            type="button"
            onClick={onLogout}
          >
            Logout
          </button>

        </div>

      </nav>

      <main>

        <header>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{subtitle}</span>
        </header>

        {children}

      </main>

    </div>
  );
}

export default function WarehouseDashboard({
  user,
  onLogout,
  onNavigate
}) {

  const [foods, setFoods] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {

    let active = true;

    async function load() {

      const requests = await Promise.allSettled([
        getJson("/inventory/food-items"),
        getJson("/inventory/batches"),
        getJson("/analysis/reports")
      ]);

      if (!active) return;

      if (requests[0].status === "fulfilled") {

        const data = requests[0].value;

        setFoods(
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.food_items ||
              []
        );
      }

      if (requests[1].status === "fulfilled") {

        const data = requests[1].value;

        setBatches(
          Array.isArray(data)
            ? data
            : data?.batches || []
        );
      }

      if (requests[2].status === "fulfilled") {

        const data = requests[2].value;

        setReports(
          Array.isArray(data)
            ? data
            : data?.reports || []
        );
      }

    }

    load();

    return () => {
      active = false;
    };

  }, []);

  const expiringSoon =
    batches.filter((batch) => {

      if (!batch.expiry_date) {
        return false;
      }

      const expiry =
        new Date(batch.expiry_date);

      const today =
        new Date();

      const days =
        (expiry - today) /
        (1000 * 60 * 60 * 24);

      return days >= 0 && days <= 7;

    }).length;

  const averageFreshness =
    reports.length > 0
      ? (
          reports.reduce(
            (sum, report) =>
              sum + num(report.freshness_score),
            0
          ) / reports.length
        ).toFixed(1)
      : "0.0";

  return (
    <Shell
      user={user}
      onLogout={onLogout}
      eyebrow="WAREHOUSE OPERATIONS"
      title="Warehouse Health Dashboard"
      subtitle="Monitor inventory health, batch freshness, expiry risk and storage-related quality."
    >

      <section className="rd-stats">

        <Stat
          icon="📦"
          label="Food Items"
          value={foods.length}
          hint="Registered products"
        />

        <Stat
          icon="🏷️"
          label="Batches"
          value={batches.length}
          hint="Warehouse batches"
        />

        <Stat
          icon="⚠️"
          label="Expiring Soon"
          value={expiringSoon}
          hint="Within 7 days"
        />

        <Stat
          icon="🌿"
          label="Avg Freshness"
          value={`${averageFreshness}/100`}
          hint="Quality monitoring"
        />

      </section>

      <section>

        <p className="rd-label">
          WAREHOUSE WORKSPACE
        </p>

        <h2>
          Monitor warehouse operations
        </h2>

        <div className="rd-actions">

          <Action
            icon="📦"
            title="Food Inventory"
            text="View and manage warehouse inventory."
            onClick={() => onNavigate("inventory")}
            dark
          />

          <Action
            icon="🏷️"
            title="Batch Management"
            text="Track warehouse batches and expiry dates."
            onClick={() => onNavigate("batches")}
          />

          <Action
            icon="🔬"
            title="Freshness Analysis"
            text="Analyze food images for freshness indicators."
            onClick={() => onNavigate("analysis")}
          />

          <Action
            icon="📊"
            title="Freshness Analytics"
            text="Review quality and freshness patterns."
            onClick={() => onNavigate("analytics")}
          />

          <Action
            icon="⏳"
            title="Shelf-Life Prediction"
            text="Check remaining shelf life and risk."
            onClick={() => onNavigate("shelf-life")}
          />

          <Action
            icon="📑"
            title="Batch Freshness Reports"
            text="Review stored quality and freshness reports."
            onClick={() => onNavigate("reports")}
          />

          <Action
            icon="💡"
            title="Smart Recommendations"
            text="Prioritize dispatch, monitor expiry risks, and improve storage conditions."
            onClick={() => onNavigate("recommendations")}
          />

        </div>

      </section>

      <div className="rd-two">

        <div className="rd-panel">

          <p>STORAGE & INVENTORY</p>

          <h3>
            Warehouse overview
          </h3>

          <div className="rd-row">
            <span>Food items</span>
            <b>{foods.length}</b>
          </div>

          <div className="rd-row">
            <span>Active batches</span>
            <b>{batches.length}</b>
          </div>

          <div className="rd-row">
            <span>Expiry alerts</span>
            <b>{expiringSoon}</b>
          </div>

        </div>

        <div className="rd-panel">

          <p>QUALITY HEALTH</p>

          <h3>
            Freshness monitoring
          </h3>

          <div className="rd-row">
            <span>Analysis reports</span>
            <b>{reports.length}</b>
          </div>

          <div className="rd-row">
            <span>Average freshness</span>
            <b>{averageFreshness}/100</b>
          </div>

          <div className="rd-row">
            <span>Priority reports</span>
            <b>
              {
                reports.filter((report) => {

                  const text = String(
                    report.freshness_classification ||
                    report.condition ||
                    ""
                  ).toLowerCase();

                  return (
                    text.includes("spoiled") ||
                    text.includes("unsafe") ||
                    text.includes("low")
                  );

                }).length
              }
            </b>
          </div>

        </div>

      </div>

    </Shell>
  );
}
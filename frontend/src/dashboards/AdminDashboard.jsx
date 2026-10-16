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
            <span>{user?.name || "Administrator"}</span>
            <small>
              {user?.role || "Administrator"}
            </small>
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

export default function AdminDashboard({
  user,
  onLogout,
  onNavigate
}) {

  const [reports, setReports] = useState([]);
  const [foods, setFoods] = useState([]);
  const [batches, setBatches] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {

    let active = true;

    async function load() {

      const results = await Promise.allSettled([
        getJson("/analysis/reports"),
        getJson("/inventory/food-items"),
        getJson("/inventory/batches"),
        getJson("/api/health")
      ]);

      if (!active) return;

      if (results[0].status === "fulfilled") {

        const data = results[0].value;

        setReports(
          Array.isArray(data)
            ? data
            : data?.reports || []
        );
      }

      if (results[1].status === "fulfilled") {

        const data = results[1].value;

        setFoods(
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.food_items ||
              []
        );
      }

      if (results[2].status === "fulfilled") {

        const data = results[2].value;

        setBatches(
          Array.isArray(data)
            ? data
            : data?.batches || []
        );
      }

      if (results[3].status === "fulfilled") {
        setHealth(results[3].value);
      }

    }

    load();

    return () => {
      active = false;
    };

  }, []);

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

  const averageConfidence =
    reports.length > 0
      ? (
          reports.reduce(
            (sum, report) =>
              sum + num(report.freshness_confidence),
            0
          ) / reports.length
        ).toFixed(1)
      : "0.0";

  const unsafe =
    reports.filter((report) => {

      const value = String(
        report.freshness_classification ||
        report.condition ||
        ""
      ).toLowerCase();

      return (
        value.includes("spoiled") ||
        value.includes("unsafe")
      );

    }).length;

  const lowFreshness =
    reports.filter((report) => {

      const value = String(
        report.freshness_classification ||
        report.condition ||
        ""
      ).toLowerCase();

      return (
        value.includes("low") ||
        value.includes("near spoilage")
      );

    }).length;

  return (
    <Shell
      user={user}
      onLogout={onLogout}
      eyebrow="ADMINISTRATOR CONTROL CENTER"
      title="Platform Command Dashboard"
      subtitle="Monitor platform inventory, freshness, quality, shelf life and system health."
    >

      <div className="rd-toolbar">

        <span>
          System status:{" "}

          <b
            className={
              health?.status === "healthy"
                ? "ok"
                : "bad"
            }
          >
            {health?.status || "Checking"}
          </b>
        </span>

        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          ↻ Refresh
        </button>

      </div>

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
          hint="Tracked inventory"
        />

        <Stat
          icon="🔬"
          label="Analyses"
          value={reports.length}
          hint="Platform reports"
        />

        <Stat
          icon="🌿"
          label="Avg Freshness"
          value={`${averageFreshness}/100`}
          hint="Platform average"
        />

      </section>

      <section>

        <p className="rd-label">
          PLATFORM MANAGEMENT
        </p>

        <h2>
          Platform modules
        </h2>

        <div className="rd-actions">

          <Action
            icon="📊"
            title="Freshness Analytics"
            text="View platform-wide freshness analytics."
            onClick={() => onNavigate("analytics")}
            dark
          />

          <Action
            icon="🔬"
            title="Freshness Analysis"
            text="Analyze food images with the AI engine."
            onClick={() => onNavigate("analysis")}
          />

          <Action
            icon="📦"
            title="Inventory Management"
            text="Manage food items and inventory."
            onClick={() => onNavigate("inventory")}
          />

          <Action
            icon="🏷️"
            title="Batch Management"
            text="Manage batches and expiry information."
            onClick={() => onNavigate("batches")}
          />

          <Action
            icon="⏳"
            title="Shelf-Life & Risk"
            text="Review shelf-life and risk prediction."
            onClick={() => onNavigate("shelf-life")}
          />

          <Action
            icon="📑"
            title="Reporting Management"
            text="Review saved platform reports."
            onClick={() => onNavigate("reports")}
          />

          <Action
            icon="📈"
            title="Quality Monitoring"
            text="Review freshness and quality performance."
            onClick={() => onNavigate("analytics")}
          />

          <Action
            icon="💡"
            title="Smart Recommendations"
            text="Review priority batches, expiry risks, and suggested actions."
            onClick={() => onNavigate("recommendations")}
          />

          <Action
            icon="❄️"
            title="Storage Monitoring"
            text="Monitor cold rooms, chillers, freezers, and storage temperatures."
            onClick={() => onNavigate("storage-monitoring")}
          />

        </div>

      </section>

      <div className="rd-two">

        <div className="rd-panel">

          <p>QUALITY SNAPSHOT</p>

          <h3>
            Platform freshness health
          </h3>

          <div className="rd-row">
            <span>Fresh</span>

            <b>
              {
                reports.filter(
                  r =>
                    String(
                      r.freshness_classification ||
                      r.condition ||
                      ""
                    ).toLowerCase() === "fresh"
                ).length
              }
            </b>
          </div>

          <div className="rd-row">
            <span>Low freshness</span>
            <b>{lowFreshness}</b>
          </div>

          <div className="rd-row">
            <span>Spoiled / unsafe</span>
            <b>{unsafe}</b>
          </div>

          <div className="rd-row">
            <span>AI confidence</span>
            <b>{averageConfidence}%</b>
          </div>

        </div>

        <div className="rd-panel">

          <p>SYSTEM MONITORING</p>

          <h3>
            Operational status
          </h3>

          <div className="rd-row">
            <span>API</span>
            <b className="ok">
              Online
            </b>
          </div>

          <div className="rd-row">
            <span>Database</span>

            <b
              className={
                health?.database === "connected"
                  ? "ok"
                  : "bad"
              }
            >
              {health?.database || "Unknown"}
            </b>
          </div>

          <div className="rd-row">
            <span>Freshness engine</span>

            <b className="ok">
              Available
            </b>
          </div>

          <div className="rd-row">
            <span>Inventory records</span>
            <b>{foods.length + batches.length}</b>
          </div>

        </div>

      </div>

    </Shell>
  );
}
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
            <small>
              {user?.role || "Food Quality Inspector"}
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

export default function QualityInspectorDashboard({
  user,
  onLogout,
  onNavigate
}) {

  const [reports, setReports] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {

    let active = true;

    async function load() {

      const requests = await Promise.allSettled([
        getJson("/analysis/reports"),
        getJson("/inventory/batches")
      ]);

      if (!active) return;

      if (requests[0].status === "fulfilled") {

        const data = requests[0].value;

        setReports(
          Array.isArray(data)
            ? data
            : data?.reports || []
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

    }

    load();

    return () => {
      active = false;
    };

  }, []);

  const unsafeCount =
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

  const lowCount =
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

  const averageQuality =
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
      eyebrow="FOOD QUALITY INSPECTION"
      title="Quality Inspector Dashboard"
      subtitle="Inspect food quality, identify spoilage indicators and review freshness evidence."
    >

      <section className="rd-stats">

        <Stat
          icon="🔬"
          label="Inspections"
          value={reports.length}
          hint="Available reports"
        />

        <Stat
          icon="⭐"
          label="Avg Quality"
          value={`${averageQuality}/100`}
          hint="Freshness score"
        />

        <Stat
          icon="⚠️"
          label="Low Freshness"
          value={lowCount}
          hint="Needs attention"
        />

        <Stat
          icon="🚨"
          label="Unsafe"
          value={unsafeCount}
          hint="Priority inspections"
        />

      </section>

      <section>

        <p className="rd-label">
          QUALITY CONTROL
        </p>

        <h2>
          Inspection workspace
        </h2>

        <div className="rd-actions">

          <Action
            icon="🔬"
            title="Quality Inspection"
            text="Analyze a food image and inspect its indicators."
            onClick={() => onNavigate("analysis")}
            dark
          />

          <Action
            icon="📊"
            title="Freshness Analytics"
            text="Review freshness patterns across reports."
            onClick={() => onNavigate("analytics")}
          />

          <Action
            icon="📦"
            title="Batch Inspection"
            text="Review batch information and expiry."
            onClick={() => onNavigate("batches")}
          />

          <Action
            icon="⏳"
            title="Shelf-Life Review"
            text="Assess remaining shelf life and risk."
            onClick={() => onNavigate("shelf-life")}
          />

          <Action
            icon="📑"
            title="Inspection Reports"
            text="Review stored inspection and quality reports."
            onClick={() => onNavigate("reports")}
          />

          <Action
            icon="📦"
            title="Inventory Review"
            text="Review food inventory associated with inspections."
            onClick={() => onNavigate("inventory")}
          />

          <Action
            icon="💡"
            title="Smart Recommendations"
            text="Identify questionable batches, review freshness risks, and prioritize inspections."
            onClick={() => onNavigate("recommendations")}
          />

        </div>

      </section>

      <div className="rd-two">

        <div className="rd-panel">

          <p>QUALITY SNAPSHOT</p>

          <h3>
            Inspection status
          </h3>

          <div className="rd-row">
            <span>Total inspections</span>
            <b>{reports.length}</b>
          </div>

          <div className="rd-row">
            <span>Low freshness</span>
            <b>{lowCount}</b>
          </div>

          <div className="rd-row">
            <span>Spoiled / unsafe</span>
            <b>{unsafeCount}</b>
          </div>

        </div>

        <div className="rd-panel">

          <p>BATCH MONITORING</p>

          <h3>
            Inspection coverage
          </h3>

          <div className="rd-row">
            <span>Tracked batches</span>
            <b>{batches.length}</b>
          </div>

          <div className="rd-row">
            <span>Average freshness</span>
            <b>{averageQuality}/100</b>
          </div>

          <div className="rd-row">
            <span>Priority level</span>
            <b className={unsafeCount > 0 ? "bad" : "ok"}>
              {unsafeCount > 0 ? "High" : "Normal"}
            </b>
          </div>

        </div>

      </div>

    </Shell>
  );
}
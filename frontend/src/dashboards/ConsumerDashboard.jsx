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
      <div className="rd-stat-icon">
        {icon}
      </div>

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
            <small>{user?.role || "Consumer"}</small>
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

export default function ConsumerDashboard({
  user,
  onLogout,
  onNavigate
}) {

  const [reports, setReports] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {

    let active = true;

    async function load() {
      try {
        const [reportResult, batchResult] =
          await Promise.allSettled([
            getJson("/analysis/my-reports"),
            getJson("/inventory/batches")
          ]);

        if (!active) return;

        if (reportResult.status === "fulfilled") {
          const reportData = reportResult.value;
          setReports(
            Array.isArray(reportData)
              ? reportData
              : reportData?.reports || []
          );
        }

        if (batchResult.status === "fulfilled") {
          const batchData = batchResult.value;
          setBatches(
            Array.isArray(batchData)
              ? batchData
              : batchData?.batches || []
          );
        }
      } catch (error) {
        console.error(
          "Consumer dashboard error:",
          error
        );
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

  const latest =
    reports.length > 0
      ? reports[0]
      : null;

  const latestStatus =
    latest?.freshness_classification ||
    latest?.condition ||
    "No analysis yet";

  return (
    <Shell
      user={user}
      onLogout={onLogout}
      eyebrow="CONSUMER DASHBOARD"
      title="Your Food Freshness Dashboard"
      subtitle="Check freshness, shelf life, food inventory and storage recommendations in one place."
    >

      <section className="rd-stats">

        <Stat
          icon="🔬"
          label="My Analyses"
          value={reports.length}
          hint="Food images analyzed"
        />

        <Stat
          icon="🌿"
          label="Avg Freshness"
          value={`${averageFreshness}/100`}
          hint="Based on your reports"
        />

        <Stat
          icon="📋"
          label="Latest Status"
          value={latestStatus}
          hint="Most recent analysis"
        />

        <Stat
          icon="📦"
          label="Inventory"
          value={batches.length}
          hint="Tracked batches"
        />

      </section>

      <section>

        <p className="rd-label">
          FOODFRESH SERVICES
        </p>

        <h2>
          What would you like to do?
        </h2>

        <div className="rd-actions">

          <Action
            icon="🔬"
            title="Analyze Food"
            text="Upload a food image and get an AI freshness assessment."
            onClick={() => onNavigate("analysis")}
            dark
          />

          <Action
            icon="📊"
            title="Freshness Analytics"
            text="Review your freshness scores and analysis history."
            onClick={() => onNavigate("analytics")}
          />

          <Action
            icon="⏳"
            title="Shelf-Life Prediction"
            text="Estimate remaining shelf life and expiry risk."
            onClick={() => onNavigate("shelf-life")}
          />

          <Action
            icon="📦"
            title="Food Inventory"
            text="View your available food items and batches."
            onClick={() => onNavigate("inventory")}
          />

          <Action
            icon="📑"
            title="My Reports"
            text="View your saved freshness and quality reports."
            onClick={() => onNavigate("reports")}
          />

          <Action
            icon="🏷️"
            title="Batch Information"
            text="Review batch details and expiry information."
            onClick={() => onNavigate("batches")}
          />

        </div>

      </section>

      <div className="rd-two">

        <div className="rd-panel">

          <p>RECENT RESULT</p>

          <h3>
            Latest freshness assessment
          </h3>

          {latest ? (
            <>
              <div className="rd-row">
                <span>Food image</span>
                <b>
                  {latest.filename || "Food Image"}
                </b>
              </div>

              <div className="rd-row">
                <span>Freshness</span>
                <b>
                  {num(latest.freshness_score).toFixed(1)}/100
                </b>
              </div>

              <div className="rd-row">
                <span>Status</span>
                <b>
                  {latestStatus}
                </b>
              </div>
            </>
          ) : (
            <div className="rd-empty">
              You have not analyzed any food yet.
            </div>
          )}

        </div>

        <div className="rd-panel">

          <p>FOOD SAFETY TIP</p>

          <h3>
            Keep your food fresh
          </h3>

          <div className="rd-row">
            <span>Check freshness regularly</span>
            <b>✓</b>
          </div>

          <div className="rd-row">
            <span>Monitor expiry dates</span>
            <b>✓</b>
          </div>

          <div className="rd-row">
            <span>Follow recommended storage</span>
            <b>✓</b>
          </div>

          <div className="rd-row">
            <span>Use older batches first</span>
            <b>✓</b>
          </div>

        </div>

      </div>

    </Shell>
  );
}
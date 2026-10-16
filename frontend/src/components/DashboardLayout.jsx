import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { getMyAlerts } from "../api/alerts.js";
import { Icon } from "./dashboard/ui.jsx";

const ROLE_LABELS = {
  consumer: "Consumer",
  retail_manager: "Retail Manager",
  warehouse_operator: "Warehouse Operator",
  food_quality_inspector: "Food Quality Inspector",
  administrator: "Administrator",
};

const DASHBOARD_PATHS = {
  consumer: "/consumer/dashboard",
  retail_manager: "/retail/dashboard",
  warehouse_operator: "/warehouse/dashboard",
  food_quality_inspector: "/inspector/dashboard",
  administrator: "/admin/dashboard",
};

// Role-specific navigation. `hash` items scroll to a section of the
// role's own dashboard; `to` items open an existing route.
const FA = { label: "Freshness Analysis", icon: "camera", to: "/freshness-analysis" };
const NAV = {
  consumer: [
    { label: "Dashboard", icon: "home", hash: "" },
    { label: "My Inventory", icon: "list", hash: "inventory" },
    FA,
    { label: "Storage Recommendations", icon: "thermo", hash: "storage" },
    { label: "Alerts", icon: "bell", hash: "alerts" },
    { label: "Reports", icon: "file", hash: "reports" },
  ],
  retail_manager: [
    { label: "Dashboard", icon: "home", hash: "" },
    { label: "Product Inventory", icon: "list", hash: "inventory" },
    FA,
    { label: "Shelf-Life Alerts", icon: "alert", hash: "alerts" },
    { label: "Waste Reduction", icon: "bulb", hash: "waste" },
    { label: "Reports", icon: "file", hash: "reports" },
  ],
  warehouse_operator: [
    { label: "Dashboard", icon: "home", hash: "" },
    { label: "Batches", icon: "box", hash: "batches" },
    FA,
    { label: "Storage Compliance", icon: "check", hash: "compliance" },
    { label: "Environmental Data", icon: "chart", hash: "environment" },
    { label: "Reports", icon: "file", hash: "reports" },
  ],
  administrator: [
    { label: "Dashboard", icon: "home", hash: "" },
    { label: "User Management", icon: "users", hash: "users" },
    { label: "Platform Analytics", icon: "chart", hash: "analytics" },
    { label: "System Monitoring", icon: "alert", hash: "system" },
    { label: "Reports", icon: "file", hash: "reports" },
  ],
  food_quality_inspector: [{ label: "Dashboard", icon: "home", hash: "" }, FA, { label: "Reports", icon: "file", hash: "reports" }],
};

const SEVERITY_DOT = { critical: "bg-red-600", warning: "bg-amber-500", info: "bg-blue-600" };

export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState(null); // null = unknown / not loaded

  const dashboardPath = DASHBOARD_PATHS[user?.role] || "/login";
  const navItems = NAV[user?.role] || NAV.food_quality_inspector;

  useEffect(() => {
    let cancelled = false;
    getMyAlerts()
      .then((a) => !cancelled && setAlerts(a))
      .catch(() => !cancelled && setAlerts(null));
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // Scroll to a #section after navigating to the dashboard (content may load late).
  useEffect(() => {
    if (!location.hash) return undefined;
    const id = location.hash.slice(1);
    const timers = [150, 700, 1500].map((ms) =>
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [location.hash, location.pathname]);

  useEffect(() => setDrawerOpen(false), [location.pathname, location.hash]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const goTo = (item) => {
    setDrawerOpen(false);
    if (item.to) {
      navigate(item.to);
    } else if (location.pathname === dashboardPath) {
      if (item.hash) {
        navigate(`${dashboardPath}#${item.hash}`);
        document.getElementById(item.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        navigate(dashboardPath);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      navigate(item.hash ? `${dashboardPath}#${item.hash}` : dashboardPath);
    }
  };

  const isActive = (item) => {
    if (item.to) return location.pathname === item.to;
    if (location.pathname !== dashboardPath) return false;
    return (location.hash || "") === (item.hash ? `#${item.hash}` : "");
  };

  const sidebar = (
    <nav aria-label="Main navigation" className="flex h-full flex-col">
      <Link to={dashboardPath} className="flex items-center gap-3 px-2 pb-6">
        <span className="h-9 w-9 rounded-[10px] bg-green-600 text-white flex items-center justify-center font-extrabold text-sm">FF</span>
        <span className="text-[13px] font-bold leading-tight text-gray-900">
          Food Freshness
          <br />
          Monitoring
        </span>
      </Link>

      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {ROLE_LABELS[user?.role] || "Menu"}
      </p>
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => goTo(item)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 mb-0.5 text-left text-sm transition ${
              active ? "bg-green-100 text-green-900 font-bold" : "text-gray-600 font-medium hover:bg-gray-50"
            }`}
          >
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-md ${active ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"}`}>
              <Icon name={item.icon} className="h-3.5 w-3.5" />
            </span>
            {item.label}
          </button>
        );
      })}

      <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Account</p>
      <button
        type="button"
        onClick={() => goTo({ hash: "account" })}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 mb-0.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-gray-200 text-gray-600">
          <Icon name="user" className="h-3.5 w-3.5" />
        </span>
        Profile
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700"
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-gray-200 text-gray-600">
          <Icon name="logout" className="h-3.5 w-3.5" />
        </span>
        Log out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-gray-800 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[236px] shrink-0 bg-white border-r border-gray-200 px-3.5 py-5 sticky top-0 h-screen overflow-y-auto">
        {sidebar}
      </aside>

      {/* Mobile / tablet drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-white px-3.5 py-5 overflow-y-auto shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <Icon name="close" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden rounded-lg border border-gray-200 p-2 text-gray-600"
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <h1 className="truncate text-lg sm:text-xl font-bold text-gray-900">{title}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label={`Notifications${alerts ? `, ${alerts.length} alerts` : ""}`}
                aria-expanded={bellOpen}
              >
                <Icon name="bell" />
                {alerts && alerts.length > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {alerts.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-sm font-semibold text-gray-900">Notifications</p>
                  {alerts === null ? (
                    <p className="text-sm text-gray-500">Notifications are unavailable right now.</p>
                  ) : alerts.length === 0 ? (
                    <p className="text-sm text-gray-500">No alerts. Nothing needs attention.</p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {alerts.slice(0, 8).map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[a.severity] || "bg-gray-400"}`} />
                          {a.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="hidden sm:block text-right leading-tight">
              <p className="text-[13px] font-bold text-gray-900">{user?.full_name}</p>
              <p className="text-[11px] text-gray-500">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-7 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  Camera,
  FileText,
  PieChart,
  TrendingUp,
  Lightbulb,
  Recycle,
  Thermometer,
  Activity,
  Users,
  Settings,
  RotateCcw,
  ClipboardCheck,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  CAN_ANALYZE_IMAGES,
  ADMIN_ONLY,
} from "../../constants/roles";

function NavItem({ to, icon: Icon, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`
      }
    >
      <Icon size={17} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );
}

function NavSection({ title, children }) {
  const visibleChildren = React.Children.toArray(children).filter(Boolean);

  if (visibleChildren.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>

      <div className="space-y-0.5">
        {visibleChildren}
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  if (!user) return null;

  const can = (roles) => roles.includes(user.role);
  const close = () => onClose?.();

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={close}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-teal-500 text-sm font-bold text-white">
              F
            </span>

            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">
                FoodCare
              </p>

              <p className="text-[11px] leading-tight text-slate-400">
                FoodCare Platform
              </p>
            </div>
          </div>

          <button
            onClick={close}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">

          {/* Main */}
          <NavSection title="Main">
            <NavItem
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              onNavigate={close}
            />
          </NavSection>

          {/* Food Management */}
          <NavSection title="Food Management">
            <NavItem
              to="/inventory"
              icon={Package}
              label="Food Items"
              onNavigate={close}
            />

            <NavItem
              to="/batches"
              icon={Layers}
              label="Batches"
              onNavigate={close}
            />

            <NavItem
              to="/fefo"
              icon={RotateCcw}
              label="FEFO Rotation"
              onNavigate={close}
            />

            <NavItem
              to="/inventory-overview"
              icon={Boxes}
              label="Inventory"
              onNavigate={close}
            />
          </NavSection>

          {/* Freshness */}
          <NavSection title="Freshness">
            {can(CAN_ANALYZE_IMAGES) && (
              <NavItem
                to="/upload"
                icon={Camera}
                label="Food Image Analysis"
                onNavigate={close}
              />
            )}

            <NavItem
              to="/analytics?tab=freshness"
              icon={PieChart}
              label="Freshness Analytics"
              onNavigate={close}
            />
          </NavSection>

          {/* AI Insights */}
          <NavSection title="AI Insights">
            <NavItem
              to="/shelf-life"
              icon={TrendingUp}
              label="Shelf Life Prediction"
              onNavigate={close}
            />

            <NavItem
              to="/recommendations"
              icon={Lightbulb}
              label="Recommendations"
              onNavigate={close}
            />

            <NavItem
              to="/waste-reduction"
              icon={Recycle}
              label="Waste Reduction"
              onNavigate={close}
            />
          </NavSection>

          {/* Monitoring */}
          <NavSection title="Monitoring">
            <NavItem
              to="/storage"
              icon={Thermometer}
              label="Storage Monitoring"
              onNavigate={close}
            />

            <NavItem
              to="/analytics?tab=storage"
              icon={Activity}
              label="Storage Analytics"
              onNavigate={close}
            />
          </NavSection>

          {/* Reports */}
          <NavSection title="Reports">
            <NavItem
              to="/reports"
              icon={FileText}
              label="Freshness Reports"
              onNavigate={close}
            />

            <NavItem
              to="/shelf-life-reports"
              icon={TrendingUp}
              label="Shelf-Life Reports"
              onNavigate={close}
            />

            <NavItem
              to="/inventory-quality-reports"
              icon={ClipboardCheck}
              label="Inventory Quality Reports"
              onNavigate={close}
            />

            <NavItem
              to="/waste-reduction-reports"
              icon={Recycle}
              label="Waste Reduction Reports"
              onNavigate={close}
            />

            <NavItem
              to="/storage-compliance-reports"
              icon={Thermometer}
              label="Storage Compliance Reports"
              onNavigate={close}
            />
          </NavSection>

          {/* Administration */}
          {can(ADMIN_ONLY) && (
            <NavSection title="Administration">
              <NavItem
                to="/admin/users"
                icon={Users}
                label="Users"
                onNavigate={close}
              />

              <NavItem
                to="/profile"
                icon={Settings}
                label="Settings"
                onNavigate={close}
              />
            </NavSection>
          )}
        </nav>
      </aside>
    </>
  );
}
import { useEffect, useRef, useState } from "react";
import {
  Leaf,
  LogIn,
  UserPlus,
  Package,
  Trash2,
  Plus,
  LogOut,
  ShieldCheck,
  Clock,
  Layers,
  RefreshCw,
  Search,
  Filter,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Microscope,
  History,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  BarChart3,
  ShieldAlert,
  FileText,
  User,
  Edit2,
} from "lucide-react";
import {
  API_BASE_URL,
  register,
  login,
  getInventory,
  addFood,
  updateFood,
  deleteFood,
  updateProfile,
  analyzeFoodImage,
  getAnalysisHistory,
  getAnalysisTrends,
  downloadAnalysisReport,
  createShelfLifePrediction,
  getShelfLifeHistory,
  getM3Analytics,
  getM3Recommendations,
  getStorageConditions,
  getExpiringSoon,
  getDashboardData,
  getAdminUsers,
  getAdminStats,
} from "./api";
import ConsumerDashboard from "./components/ConsumerDashboard";
import RetailDashboard from "./components/RetailDashboard";
import WarehouseDashboard from "./components/WarehouseDashboard";
import AdminDashboard from "./components/AdminDashboard";
import InspectorDashboard from "./components/InspectorDashboard";
import NotificationBell from "./components/NotificationBell";
import ReportsView from "./components/ReportsView";


const ROLES = [
  ["consumer", "Consumer"],
  ["retail_manager", "Retail Manager"],
  ["warehouse_operator", "Warehouse Operator"],
  ["food_quality_inspector", "Food Quality Inspector"],
  ["administrator", "Administrator"],
];

const CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy Products",
  "Meat & Poultry",
  "Seafood",
  "Bakery Products",
  "Packaged Foods",
  "Beverages",
];

// Helper: Calculate Availability Status
function getAvailabilityStatus(quantity) {
  const qty = Number(quantity);
  if (qty <= 0) {
    return { label: "Out of Stock", code: "out_of_stock", className: "badge-out-of-stock" };
  }
  return { label: "In Stock", code: "in_stock", className: "badge-in-stock" };
}

// Helper: Calculate Expiry Status
function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return { label: "Unknown", code: "unknown", className: "badge-neutral" };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = expiryDateStr.split("-").map(Number);
  const expiry = new Date(y, m - 1, d);
  expiry.setHours(0, 0, 0, 0);

  const diffDays = Math.round((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Expired", code: "expired", className: "badge-expired" };
  } else if (diffDays === 0) {
    return { label: "Expiring Today", code: "expiring_today", className: "badge-expiring-today" };
  } else {
    return { label: "Valid", code: "valid", className: "badge-valid" };
  }
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fresh_session") || "null");
    } catch {
      return null;
    }
  });

  // viewMode: "landing" | "auth" | "dashboard"
  const [viewMode, setViewMode] = useState(() => (session ? "dashboard" : "landing"));
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const saveSession = (data) => {
    const next = { token: data.access_token, user: data.user };
    localStorage.setItem("fresh_session", JSON.stringify(next));
    setSession(next);
    setViewMode("dashboard");
  };

  const logout = () => {
    localStorage.removeItem("fresh_session");
    setSession(null);
    setViewMode("landing");
    setError("");
    setNotice("");
  };

  const navigateToAuth = (mode) => {
    setAuthMode(mode);
    setViewMode("auth");
    setError("");
  };

  const handleUpdateUser = (updatedUser) => {
    const next = { ...session, user: updatedUser };
    localStorage.setItem("fresh_session", JSON.stringify(next));
    setSession(next);
  };

  useEffect(() => {
    const checkDemoStatus = async () => {
      try {
        if (!API_BASE_URL) return;
        const res = await fetch(`${API_BASE_URL}/demo/health`);
        const data = await res.json();
        if (data && data.model_status === "demo_mock") {
          setNotice("Demo mode active: mock output shown for presentation only.");
        }
      } catch {
        // ignore demo status check failures
      }
    };
    checkDemoStatus();
  }, []);

  if (session && viewMode === "dashboard") {
    return (
      <Dashboard
        session={session}
        logout={logout}
        error={error}
        setError={setError}
        notice={notice}
        setNotice={setNotice}
        onUpdateUser={handleUpdateUser}
      />
    );
  }

  if (viewMode === "auth") {
    return (
      <Auth
        authMode={authMode}
        setAuthMode={setAuthMode}
        onBackToLanding={() => setViewMode("landing")}
        saveSession={saveSession}
        error={error}
        setError={setError}
      />
    );
  }

  return <LandingPage onNavigateToAuth={navigateToAuth} notice={notice} />;
}

// ==========================================
// 1. LANDING PAGE
// ==========================================
function LandingPage({ onNavigateToAuth, notice }) {
  return (
    <div className="landing-container">
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand">
            <div className="brand-mark">
              <Leaf size={22} />
            </div>
            <div className="brand-text">
              <span className="brand-name">FreshGuard</span>
              <span className="brand-tagline">Food Freshness Monitor</span>
            </div>
          </div>

          <div className="nav-actions">
            <button className="btn-secondary" onClick={() => onNavigateToAuth("login")}>
              <LogIn size={16} />
              Sign In
            </button>
            <button className="btn-primary" onClick={() => onNavigateToAuth("register")}>
              <UserPlus size={16} />
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          Keep Your Food Fresh &amp; Your Inventory Accurate
        </h1>
        <p className="hero-subtitle">
          Track food items, monitor expiry dates, manage stock levels, and
          reduce waste — all in one place.
        </p>

        <div className="hero-buttons">
          <button className="btn-primary btn-large" onClick={() => onNavigateToAuth("register")}>
            Create Account
          </button>
          <button className="btn-secondary btn-large" onClick={() => onNavigateToAuth("login")}>
            Sign In
          </button>
        </div>
      </section>

      {/* Simple Feature Cards */}
      <section className="section-container">
        <div className="purpose-grid">
          <div className="purpose-card">
            <div className="purpose-icon"><Package size={24} /></div>
            <h3>Inventory Management</h3>
            <p>Add and manage food items with batch numbers, quantities, and categories.</p>
          </div>
          <div className="purpose-card">
            <div className="purpose-icon"><Clock size={24} /></div>
            <h3>Expiry Tracking</h3>
            <p>Stay on top of expiry dates with automatic status badges — Valid, Expiring Today, or Expired.</p>
          </div>
          <div className="purpose-card">
            <div className="purpose-icon"><Layers size={24} /></div>
            <h3>Role-Based Access</h3>
            <p>Different roles for consumers, retailers, warehouse teams, inspectors, and admins.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="brand-mark small"><Leaf size={18} /></div>
            <span>FreshGuard</span>
          </div>
          <div className="footer-actions">
            <button className="btn-primary" onClick={() => onNavigateToAuth("register")}>
              Get Started
            </button>
          </div>
        </div>
      </footer>
      {notice && (
        <div className="notice-box warning-box" style={{ maxWidth: 900, margin: "16px auto 0" }}>
          <AlertTriangle size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}


// ==========================================
// 2. AUTHENTICATION (LOGIN & REGISTER)
// ==========================================
function Auth({ authMode, setAuthMode, onBackToLanding, saveSession, error, setError }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "consumer",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data =
        authMode === "register"
          ? await register(form)
          : await login({ email: form.email, password: form.password });
      saveSession(data);
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-top-nav">
        <button className="btn-text" onClick={onBackToLanding}>
          ← Back
        </button>
      </div>

      <section className="auth-card">
        <div className="auth-brand-center">
          <div className="brand-mark">
            <Leaf size={24} />
          </div>
          <span className="brand-title">FreshGuard</span>
        </div>


        <h1>{authMode === "login" ? "Welcome back" : "Create an account"}</h1>
        <p className="muted">
          {authMode === "login"
            ? "Sign in to access your inventory and batch records."
            : "Register with your designated organizational role."}
        </p>

        <div className="tabs">
          <button
            type="button"
            className={authMode === "login" ? "active" : ""}
            onClick={() => {
              setAuthMode("login");
              setError("");
            }}
          >
            <LogIn size={16} /> Login
          </button>
          <button
            type="button"
            className={authMode === "register" ? "active" : ""}
            onClick={() => {
              setAuthMode("register");
              setError("");
            }}
          >
            <UserPlus size={16} /> Register
          </button>
        </div>

        <form onSubmit={submit}>
          {authMode === "register" && (
            <label>
              Full Name
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Sarah Connor"
              />
            </label>
          )}

          <label>
            Email Address
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 6 characters"
            />
          </label>

          {authMode === "register" && (
            <label>
              Assigned Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <div className="error-box">{error}</div>}

          <button className="btn-primary full" disabled={busy}>
            {busy ? "Processing..." : authMode === "login" ? "Sign In" : "Register Account"}
          </button>
        </form>
      </section>
    </main>
  );
}

// ==========================================
// 3. DASHBOARD & FOOD INVENTORY MANAGEMENT
// ==========================================
function Dashboard({ session, logout, error, setError, notice, setNotice, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "inventory" | "analysis" | "m3"
  const [items, setItems] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);    // C3
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const getDefaultExpiry = () => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  };

  const [form, setForm] = useState({
    name: "",
    category: "Fruits",
    batch_number: "",
    quantity: 10,
    expiry_date: getDefaultExpiry(),
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, soonData] = await Promise.all([
        getInventory(session.token),
        getExpiringSoon(session.token, 7),   // C3: default 7-day window
      ]);
      setItems(data);
      setExpiringSoon(soonData);
    } catch (err) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!form.name.trim()) {
      setError("Please enter a food name.");
      return;
    }
    if (!form.batch_number.trim()) {
      setError("Please enter a batch number (e.g. B-101).");
      return;
    }
    if (!form.expiry_date) {
      setError("Please select an expiry date.");
      return;
    }

    try {
      await addFood(session.token, {
        name: form.name.trim(),
        category: form.category,
        batch_number: form.batch_number.trim(),
        quantity: Math.max(0, parseInt(form.quantity, 10) || 0),
        expiry_date: form.expiry_date,
      });
      setForm({
        name: "",
        category: "Fruits",
        batch_number: "",
        quantity: 10,
        expiry_date: getDefaultExpiry(),
      });
      setNotice("Food item added to inventory.");
      refresh();
    } catch (err) {
      setError(err.message || "Failed to save food item");
    }
  };

  const remove = async (id) => {
    setError("");
    setNotice("");
    try {
      await deleteFood(session.token, id);
      setNotice("Food item removed from inventory.");
      refresh();
    } catch (err) {
      setError(err.message || "Failed to delete item");
    }
  };

  const roleLabel =
    ROLES.find(([v]) => v === session.user.role)?.[1] || session.user.role;

  // Filtered inventory list
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "All" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate live summary stats
  const totalCount = items.length;
  const inStockCount = items.filter((i) => Number(i.quantity) > 0).length;
  const outOfStockCount = items.filter((i) => Number(i.quantity) === 0).length;
  const expiredCount = items.filter(
    (i) => getExpiryStatus(i.expiry_date).code === "expired"
  ).length;

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Leaf size={20} />
          </div>
          <div className="brand-text">
            <span className="brand-name">FreshGuard</span>
            <span className="brand-sub">Food Freshness Monitor</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-nav">
          <button
            id="tab-dashboard"
            className={`tab-btn${activeTab === "dashboard" ? " tab-btn-active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <BarChart3 size={16} /> Dashboard
          </button>
          <button
            id="tab-inventory"
            className={`tab-btn${activeTab === "inventory" ? " tab-btn-active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            <Package size={16} /> Inventory
          </button>
          <button
            id="tab-analysis"
            className={`tab-btn${activeTab === "analysis" ? " tab-btn-active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            <Microscope size={16} /> AI Freshness Detection
          </button>
          <button
            id="tab-m3"
            className={`tab-btn${activeTab === "m3" ? " tab-btn-active" : ""}`}
            onClick={() => setActiveTab("m3")}
          >
            <BarChart3 size={16} /> Shelf-Life &amp; Storage
          </button>
          <button
            id="tab-reports"
            className={`tab-btn${activeTab === "reports" ? " tab-btn-active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <FileText size={16} /> Reports
          </button>
        </nav>

        <div className="user-area">
          <NotificationBell session={session} />
          <div
            className="user-chip clickable-chip"
            onClick={() => setShowProfileModal(true)}
            title="Click to edit profile"
            role="button"
            tabIndex={0}
          >
            <strong>{session.user.full_name}</strong>
            <span className="role-tag">{roleLabel}</span>
          </div>
          <button
            className="icon-button"
            onClick={() => setShowProfileModal(true)}
            title="Profile Settings"
          >
            <User size={18} />
          </button>
          <button className="icon-button" onClick={logout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        {activeTab === "dashboard" && (
          <>
            {session.user.role === "consumer" && <ConsumerDashboard session={session} />}
            {session.user.role === "retail_manager" && <RetailDashboard session={session} />}
            {session.user.role === "warehouse_operator" && <WarehouseDashboard session={session} />}
            {session.user.role === "administrator" && <AdminDashboard session={session} />}
            {session.user.role === "food_quality_inspector" && <InspectorDashboard session={session} />}
          </>
        )}
        {activeTab === "reports" && <ReportsView session={session} />}
        {activeTab === "inventory" && (
          <>
            {/* Metric Cards Banner */}
            <section className="metrics-banner">
              <div className="metric-card">
                <span className="metric-label">Total Items</span>
                <strong className="metric-value">{totalCount}</strong>
                <span className="metric-helper">In inventory</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">In Stock</span>
                <strong className="metric-value text-success">{inStockCount}</strong>
                <span className="metric-helper">Available</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Out of Stock</span>
                <strong className="metric-value text-warning">{outOfStockCount}</strong>
                <span className="metric-helper">Need restocking</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Expired</span>
                <strong className="metric-value text-danger">{expiredCount}</strong>
                <span className="metric-helper">Past expiry</span>
              </div>
            </section>

            {notice && <div className="notice-box success-box">{notice}</div>}
            {error && <div className="notice-box error-box">{error}</div>}
            {/* C3: Expiring-soon alert banner */}
            <ExpiringSoonBanner items={expiringSoon} />

        <div className="dashboard-grid">
          {/* Left Panel: Add Food Form */}
          <section className="panel form-panel">
            <div className="panel-head">
              <div>
                <h2>Add Food Item</h2>
                <p>Fill in the details to add a new item to inventory</p>
              </div>
              <div className="panel-badge">
                <Plus size={16} /> Add Food
              </div>
            </div>

            <form className="food-form" onSubmit={submit}>
              <label>
                Food Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Organic Gala Apples"
                />
              </label>

              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Batch Number
                <input
                  required
                  value={form.batch_number}
                  onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                  placeholder="e.g. BATCH-2026-01"
                />
              </label>

              <label>
                Quantity (Units)
                <input
                  required
                  min="0"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </label>

              <label className="wide">
                Expiry Date
                <input
                  required
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </label>

              <button className="btn-primary full wide">Add to Inventory</button>
            </form>
          </section>

          {/* Right Panel: Inventory Display */}
          <section className="panel inventory-panel">
            <div className="panel-head">
              <div>
                <h2>Food Inventory</h2>
                <p>All registered food items and their current status</p>
              </div>
              <button className="icon-button" onClick={refresh} title="Refresh Records">
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search by name or batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="category-select-wrapper">
                <Filter size={16} />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="state-empty">
                <RefreshCw size={28} className="spinner" />
                <span>Loading...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="state-empty">
                <Package size={36} />
                <strong>No inventory records found</strong>
                <span>
                  {items.length === 0
                    ? "Add your first food item using the form on the left."
                    : "No records match your search or category filter."}
                </span>
              </div>
            ) : (
              <div className="inventory-list">
                {filteredItems.map((item) => {
                  const avail = getAvailabilityStatus(item.quantity);
                  const exp = getExpiryStatus(item.expiry_date);

                  return (
                    <article className="inventory-card" key={item.id}>
                      <div className="card-primary">
                        <div className="food-icon">
                          <Leaf size={18} />
                        </div>
                        <div className="food-main-info">
                          <h4 className="food-title">{item.name}</h4>
                          <span className="food-sub">
                            {item.category} &bull; Batch: <code>{item.batch_number}</code>
                          </span>
                        </div>
                      </div>

                      <div className="card-statuses">
                        {/* Quantity & Availability Badge */}
                        <div className="status-group">
                          <span className="status-label">Stock / Quantity</span>
                          <div className="status-row">
                            <span className="quantity-val">{item.quantity} units</span>
                            <span className={`badge ${avail.className}`}>
                              {avail.label}
                            </span>
                          </div>
                        </div>

                        {/* Expiry Date & Expiry Status Badge */}
                        <div className="status-group">
                          <span className="status-label">Expiry Status</span>
                          <div className="status-row">
                            <span className="date-val">{item.expiry_date}</span>
                            <span className={`badge ${exp.className}`}>
                              {exp.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          className="edit-button"
                          onClick={() => setEditingItem(item)}
                          title="Edit item"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => remove(item.id)}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          </div>
          </>
        )}

        {activeTab === "analysis" && (
          <FreshnessAnalysisView session={session} />
        )}

        {activeTab === "m3" && <ShelfLifeView session={session} />}
      </main>

      {showProfileModal && (
        <ProfileModal
          session={session}
          onClose={() => setShowProfileModal(false)}
          onUpdateUser={onUpdateUser}
          setNotice={setNotice}
          setError={setError}
        />
      )}

      {editingItem && (
        <EditFoodModal
          item={editingItem}
          session={session}
          onClose={() => setEditingItem(null)}
          onRefresh={refresh}
          setNotice={setNotice}
          setError={setError}
        />
      )}
    </div>
  );
}

// ==========================================
// USER PROFILE MODAL (T3 Profile Management)
// ==========================================
function ProfileModal({ session, onClose, onUpdateUser, setNotice, setError }) {
  const [fullName, setFullName] = useState(session?.user?.full_name || "");
  const [email, setEmail] = useState(session?.user?.email || "");
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalErr("");
    if (!fullName.trim()) {
      setModalErr("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setModalErr("Email address is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(session.token, {
        full_name: fullName.trim(),
        email: email.trim(),
      });
      if (onUpdateUser) {
        onUpdateUser(updated);
      }
      setNotice("Profile updated successfully.");
      onClose();
    } catch (err) {
      setModalErr(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>User Profile Settings</h3>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {modalErr && <div className="banner banner-error">{modalErr}</div>}
            <div className="form-group">
              <label>Role</label>
              <input
                type="text"
                value={(session?.user?.role || "").replace(/_/g, " ").toUpperCase()}
                disabled
              />
              <small className="form-helper">Role cannot be self-modified.</small>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// EDIT FOOD ITEM MODAL (T3 Inventory Update)
// ==========================================
function EditFoodModal({ item, session, onClose, onRefresh, setNotice, setError }) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    category: item?.category || "Fruits",
    batch_number: item?.batch_number || "",
    quantity: item?.quantity ?? 0,
    expiry_date: item?.expiry_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalErr("");
    if (!formData.name.trim()) {
      setModalErr("Item name is required.");
      return;
    }
    if (!formData.batch_number.trim()) {
      setModalErr("Batch number is required.");
      return;
    }
    if (!formData.expiry_date) {
      setModalErr("Expiry date is required.");
      return;
    }
    setSaving(true);
    try {
      await updateFood(session.token, item.id, {
        name: formData.name.trim(),
        category: formData.category,
        batch_number: formData.batch_number.trim(),
        quantity: Math.max(0, parseInt(formData.quantity, 10) || 0),
        expiry_date: formData.expiry_date,
      });
      setNotice(`Updated "${formData.name.trim()}" successfully.`);
      onRefresh();
      onClose();
    } catch (err) {
      setModalErr(err.message || "Failed to update item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Food Item</h3>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {modalErr && <div className="banner banner-error">{modalErr}</div>}
            <div className="form-group">
              <label>Item Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Batch Number</label>
              <input
                type="text"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Updating..." : "Update Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// C3 — Expiring-soon alert banner (Inventory tab)
// ============================================================

// Risk level colours reused from M3 (defined again here so this component
// doesn't depend on the ShelfLifeView scope).
const EXPIRY_RISK_COLORS = {
  low:      { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  moderate: { bg: "#fef9c3", border: "#fde047", text: "#854d0e" },
  high:     { bg: "#ffedd5", border: "#fdba74", text: "#9a3412" },
  critical: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
};

function ExpiringSoonBanner({ items }) {
  // items is the /inventory/expiring-soon response — array of ExpiringSoonItem
  if (!items || items.length === 0) {
    return (
      <div className="expiry-banner expiry-banner-clear">
        <Clock size={15} />
        <span>No items expiring within the next 7 days.</span>
      </div>
    );
  }

  const expiredItems = items.filter((i) => i.is_expired);
  const soonItems    = items.filter((i) => !i.is_expired);

  return (
    <div className="expiry-banner expiry-banner-alert">
      <div className="expiry-banner-header">
        <AlertTriangle size={16} />
        <strong>
          {expiredItems.length > 0 && `${expiredItems.length} expired`}
          {expiredItems.length > 0 && soonItems.length > 0 && ", "}
          {soonItems.length > 0 && `${soonItems.length} expiring within 7 days`}
        </strong>
      </div>
      <div className="expiry-item-list">
        {items.map((item) => {
          const riskStyle = item.risk_level
            ? EXPIRY_RISK_COLORS[item.risk_level]
            : item.is_expired
              ? EXPIRY_RISK_COLORS.critical
              : EXPIRY_RISK_COLORS.moderate;

          return (
            <div
              key={item.id}
              className="expiry-item"
              style={{
                background: riskStyle.bg,
                borderColor: riskStyle.border,
                color: riskStyle.text,
              }}
            >
              <div className="expiry-item-main">
                <strong className="expiry-item-name">{item.name}</strong>
                {item.batch_number && (
                  <span className="expiry-item-batch">Batch: {item.batch_number}</span>
                )}
              </div>
              <div className="expiry-item-meta">
                <span className="expiry-item-date">
                  {item.is_expired
                    ? `Expired ${Math.abs(item.days_until_expiry)} day${Math.abs(item.days_until_expiry) !== 1 ? "s" : ""} ago`
                    : item.days_until_expiry === 0
                      ? "Expires today"
                      : `Expires in ${item.days_until_expiry} day${item.days_until_expiry !== 1 ? "s" : ""}`}
                </span>
                <span className="expiry-item-expdate">{item.expiry_date}</span>
                {item.risk_level && (
                  <span className="expiry-item-risk">{item.risk_level} risk</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 4. FRESHNESS ANALYSIS VIEW (M2)
// ============================================================
const FRESHNESS_CONFIG = {
  Fresh:       { color: "#22c55e", bg: "#dcfce7", border: "#86efac", icon: CheckCircle2 },
  Good:        { color: "#84cc16", bg: "#ecfccb", border: "#bef264", icon: CheckCircle2 },
  Acceptable:  { color: "#eab308", bg: "#fef9c3", border: "#fde047", icon: AlertTriangle },
  "Near Spoilage": { color: "#f97316", bg: "#ffedd5", border: "#fdba74", icon: AlertTriangle },
  Spoiled:     { color: "#ef4444", bg: "#fee2e2", border: "#fca5a5", icon: AlertCircle },
};

function ScoreGauge({ value, label, color }) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="score-gauge">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="45" cy="45" r={radius} fill="none"
          stroke={color || "#22c55e"} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="45" y="49" textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b">{pct}</text>
      </svg>
      <span className="gauge-label">{label}</span>
    </div>
  );
}

function ProbBar({ value, label, invert }) {
  const pct = Math.round((invert ? 1 - value : value) * 100);
  const color = invert
    ? value < 0.2 ? "#22c55e" : value < 0.5 ? "#eab308" : "#ef4444"
    : value > 0.8 ? "#22c55e" : value > 0.5 ? "#eab308" : "#ef4444";
  return (
    <div className="prob-bar-wrapper">
      <div className="prob-bar-header">
        <span className="prob-bar-label">{label}</span>
        <span className="prob-bar-value" style={{ color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="prob-bar-track">
        <div
          className="prob-bar-fill"
          style={{ width: `${(value * 100).toFixed(1)}%`, background: color, transition: "width 0.6s ease" }}
        />
      </div>
    </div>
  );
}

function FreshnessAnalysisView({ session }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [trendError, setTrendError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [reportError, setReportError] = useState("");
  const fileInputRef = useRef(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setTrendError("");
    try {
      const [historyData, trendData] = await Promise.all([
        getAnalysisHistory(session.token),
        getAnalysisTrends(session.token),
      ]);
      setHistory(historyData);
      setTrends(trendData.points);
    } catch (err) {
      setTrendError(err.message || "Unable to load freshness trends.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleDownloadReport = async (analysisId) => {
    if (!analysisId) return;
    setDownloadingId(analysisId);
    setReportError("");
    try {
      await downloadAnalysisReport(session.token, analysisId);
    } catch (err) {
      setReportError(err.message || "Failed to download PDF report");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const valid = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"];
    if (!valid.includes(file.type)) {
      setError("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10 MB.");
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyze = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await analyzeFoodImage(session.token, selectedFile);
      setResult(data);
      loadHistory();
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const cfg = result ? (FRESHNESS_CONFIG[result.classification] || FRESHNESS_CONFIG["Acceptable"]) : null;
  const StatusIcon = cfg?.icon;

  return (
    <div className="analysis-shell">
      <div className="analysis-grid">
        {/* ── Left Panel: Upload ── */}
        <section className="panel analysis-upload-panel">
          <div className="panel-head">
            <div>
              <h2>Food Freshness Analysis</h2>
              <p>Upload a food image to detect freshness and quality</p>
            </div>
            <div className="panel-badge"><Camera size={16} /> AI Powered</div>
          </div>
          <div className="notice-box warning-box" role="note">
            <AlertTriangle size={18} />
            This image model is limited to apples, bananas, and oranges. Other food images may be mislabeled as one of these fruits.
          </div>

          {/* Dropzone */}
          <div
            id="dropzone"
            className={`dropzone${dragging ? " dropzone-drag" : ""}${preview ? " dropzone-has-image" : ""}`}
            onClick={() => !preview && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          >
            {preview ? (
              <div className="preview-wrapper">
                <img src={preview} alt="Food preview" className="preview-img" />
                <button id="btn-clear-image" className="preview-clear" onClick={(e) => { e.stopPropagation(); clearImage(); }} title="Remove image">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="dropzone-placeholder">
                <div className="dropzone-icon"><Upload size={32} /></div>
                <p className="dropzone-title">Drop a food image here</p>
                <p className="dropzone-sub">or click to browse</p>
                <span className="dropzone-hint">JPEG · PNG · WebP · Max 10 MB</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {error && <div className="notice-box error-box">{error}</div>}

          <div className="upload-actions">
            <button
              id="btn-browse"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              <Upload size={16} /> {preview ? "Change Image" : "Browse Image"}
            </button>
            <button
              id="btn-analyze"
              className="btn-primary"
              disabled={!selectedFile || analyzing}
              onClick={analyze}
            >
              {analyzing ? (
                <><RefreshCw size={16} className="spinner" /> Analysing...</>
              ) : (
                <><Microscope size={16} /> Analyse Freshness</>
              )}
            </button>
          </div>

          {/* Instructions */}
          {!result && !analyzing && (
            <div className="upload-tips">
              <p><strong>Tips for best results:</strong></p>
              <ul>
                <li>Use a clear, well-lit photo of the food item</li>
                <li>Ensure the food fills most of the frame</li>
                <li>Supported classifier labels: apples, bananas, and oranges only</li>
                <li>Avoid blurry or heavily cropped images</li>
              </ul>
            </div>
          )}
        </section>

        {/* ── Right Panel: Results ── */}
        <section className="panel analysis-result-panel">
          {!result && !analyzing && (
            <div className="state-empty analysis-empty">
              <Microscope size={48} />
              <strong>No analysis yet</strong>
              <span>Upload a food image and click Analyse Freshness to see results.</span>
            </div>
          )}

          {analyzing && (
            <div className="state-empty analysis-empty">
              <RefreshCw size={42} className="spinner" />
              <strong>Analysing image...</strong>
              <span>Running CNN model inference and visual analysis</span>
            </div>
          )}

          {result && cfg && (
            <div className="result-content">
              {/* Classification Banner */}
              <div id="result-classification" className="classification-banner" style={{ background: cfg.bg, borderColor: cfg.border }}>
                <StatusIcon size={28} color={cfg.color} />
                <div>
                  <div className="classification-label" style={{ color: cfg.color }}>{result.classification}</div>
                  <div className="classification-sub">{result.model_prediction.food_item} detected</div>
                </div>
              </div>

              {/* Score Gauges Row */}
              <div className="gauges-row">
                <ScoreGauge value={result.quality_score} label="Visual Quality" color={cfg.color} />
                <ScoreGauge value={Math.round(result.confidence * 100)} label="Model Confidence" color="#3b82f6" />
              </div>

              {/* Probability Bars */}
              <div className="prob-bars">
                <ProbBar value={result.spoilage_probability} label="Spoilage Probability" invert={false} />
                <ProbBar value={1 - result.spoilage_probability} label="Freshness Score" invert={false} />
              </div>

              {/* Visual Breakdown */}
              <div className="visual-breakdown">
                <h3>Visual Analysis Breakdown</h3>
                <div className="breakdown-grid">
                  <div className="breakdown-card">
                    <div className="breakdown-title">Colour Analysis</div>
                    <div className="breakdown-row">
                      <span>Dominant Colour</span>
                      <span className="color-swatch-wrapper">
                        <span className="color-swatch" style={{ background: result.visual_analysis.color.dominant_color_hex }} />
                        {result.visual_analysis.color.dominant_color_hex}
                      </span>
                    </div>
                    <div className="breakdown-row">
                      <span>Discoloration Index</span>
                      <span>{(result.visual_analysis.color.discoloration_index * 100).toFixed(1)}%</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Browning Index</span>
                      <span>{(result.visual_analysis.color.browning_index * 100).toFixed(1)}%</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Mean Saturation</span>
                      <span>{(result.visual_analysis.color.mean_saturation * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="breakdown-card">
                    <div className="breakdown-title">Texture Analysis</div>
                    <div className="breakdown-row">
                      <span>Texture Uniformity</span>
                      <span>{(result.visual_analysis.texture.texture_uniformity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Surface Roughness</span>
                      <span>{(result.visual_analysis.texture.surface_roughness * 100).toFixed(1)}%</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Local Contrast</span>
                      <span>{(result.visual_analysis.texture.local_contrast * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Breakdown (for mentor transparency) */}
              <div className="score-note">
                <strong>ℹ️ M2 Visual Quality Score</strong>
                <p>{result.score_breakdown.note}</p>
              </div>

              {/* Download Report Bar */}
              {(() => {
                const currentAnalysisId = result.id || (history[0] && history[0].id);
                return (
                  <div className="report-download-bar" style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>Official Assessment Report</strong>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Download a PDF report with visual metrics &amp; disclaimer</p>
                    </div>
                    <button
                      id="btn-download-report"
                      className="btn-primary"
                      disabled={!currentAnalysisId || downloadingId === currentAnalysisId}
                      onClick={() => handleDownloadReport(currentAnalysisId)}
                    >
                      {downloadingId === currentAnalysisId ? (
                        <><RefreshCw size={16} className="spinner" /> Generating Report...</>
                      ) : (
                        <><FileText size={16} /> Download Report (PDF)</>
                      )}
                    </button>
                  </div>
                );
              })()}
              {reportError && <div className="notice-box error-box" style={{ marginTop: "10px" }}>{reportError}</div>}
            </div>
          )}
        </section>
      </div>

      {/* ── Analysis History ── */}
      <section className="panel history-panel">
        <div className="panel-head">
          <div><h2>Analysis History</h2><p>Your recent freshness scans</p></div>
          <button className="icon-button" onClick={loadHistory} title="Refresh"><RefreshCw size={16} /></button>
        </div>
        <section aria-label="Freshness trends" className="analysis-trends">
          <h3>Freshness trend · last 30 days</h3>
          {trendError ? (
            <p role="alert">{trendError}</p>
          ) : trends.length === 0 ? (
            <p>No trend data for this period yet.</p>
          ) : (
            <div className="analysis-trend-list">
              {trends.slice(-7).map((point) => (
                <div className="analysis-trend-row" key={point.date}>
                  <time dateTime={point.date}>{new Date(`${point.date}T00:00:00`).toLocaleDateString()}</time>
                  <div
                    aria-label={`Average quality score ${point.average_quality_score} out of 100`}
                    className="analysis-trend-track"
                    role="img"
                  >
                    <span style={{ width: `${Math.max(0, Math.min(100, point.average_quality_score))}%` }} />
                  </div>
                  <strong>{point.average_quality_score}</strong>
                  <small>{point.assessment_count} scan{point.assessment_count === 1 ? "" : "s"}</small>
                  <small>Risk {(point.average_spoilage_probability * 100).toFixed(1)}%</small>
                </div>
              ))}
            </div>
          )}
        </section>
        {historyLoading ? (
          <div className="state-empty"><RefreshCw size={24} className="spinner" /><span>Loading...</span></div>
        ) : history.length === 0 ? (
          <div className="state-empty"><History size={32} /><span>No analysis history yet.</span></div>
        ) : (
          <div className="history-list">
            {history.map((h) => {
              const hcfg = FRESHNESS_CONFIG[h.classification] || FRESHNESS_CONFIG["Acceptable"];
              const HIcon = hcfg.icon;
              return (
                <div key={h.id} className="history-card">
                  <HIcon size={18} color={hcfg.color} />
                  <div className="history-info">
                    <strong>{h.item_name || "Unknown"}</strong>
                    <span className="history-badge" style={{ color: hcfg.color, background: hcfg.bg }}>{h.classification}</span>
                  </div>
                  <div className="history-scores">
                    <span>Q: <strong>{h.quality_score}</strong></span>
                    <span>C: <strong>{(h.confidence * 100).toFixed(0)}%</strong></span>
                  </div>
                  <span className="history-date">{new Date(h.created_at).toLocaleString()}</span>
                  <button
                    className="icon-button"
                    disabled={downloadingId === h.id}
                    onClick={() => handleDownloadReport(h.id)}
                    title="Download PDF Report"
                    style={{ padding: "6px", marginLeft: "8px" }}
                  >
                    {downloadingId === h.id ? (
                      <RefreshCw size={15} className="spinner" />
                    ) : (
                      <FileText size={15} color="#059669" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


// ============================================================
// 5. M3 SHELF-LIFE, STORAGE, AND ANALYTICS VIEW
// ============================================================
// ── Inline SVG chart primitives ──────────────────────────────────────────
// No third-party chart library. Consistent with the existing ScoreGauge SVG
// pattern already used in FreshnessAnalysisView (M2).

/**
 * LineChart — renders a polyline SVG from an array of { label, value } points.
 * All values come directly from the backend analytics response — nothing is invented.
 */
function LineChart({ data, height = 110, color = "#173d2a", yLabel = "" }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <BarChart3 size={22} />
        <span>No data yet</span>
      </div>
    );
  }

  const PAD = { top: 14, right: 12, bottom: 28, left: 38 };
  const W = 340 - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const ys = data.map((d) => d.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;

  const pts = data.map((d, i) => {
    const px = PAD.left + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
    const py = PAD.top + H - ((d.value - minY) / rangeY) * H;
    return [px, py];
  });

  const polyline = pts.map((p) => p.join(",")).join(" ");
  const ticks = [minY, (minY + maxY) / 2, maxY].map((v) => ({
    y: PAD.top + H - ((v - minY) / rangeY) * H,
    label: Number.isInteger(v) ? v : v.toFixed(1),
  }));

  return (
    <svg viewBox="0 0 340 110" width="100%" height={height} aria-label={`Line chart: ${yLabel}`} role="img">
      {ticks.map((t, i) => (
        <line key={i} x1={PAD.left} x2={PAD.left + W} y1={t.y} y2={t.y}
          stroke="#e2e8e2" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {ticks.map((t, i) => (
        <text key={i} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="#829288">
          {t.label}
        </text>
      ))}
      {[0, Math.floor((data.length - 1) / 2), data.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((idx) => (
          <text key={idx} x={pts[idx][0]} y={PAD.top + H + 16}
            textAnchor="middle" fontSize="9" fill="#829288">
            {data[idx].label}
          </text>
        ))}
      <polyline
        points={[`${pts[0][0]},${PAD.top + H}`, ...pts.map((p) => p.join(",")),
          `${pts[pts.length - 1][0]},${PAD.top + H}`].join(" ")}
        fill={color} fillOpacity="0.08" stroke="none"
      />
      <polyline points={polyline} fill="none" stroke={color}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />)}
    </svg>
  );
}

/**
 * BarChart — SVG bar chart from { label, value, color? } items.
 * Used for risk level distribution from analytics.risk_counts.
 */
function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <BarChart3 size={22} />
        <span>No data yet</span>
      </div>
    );
  }

  const PAD = { top: 10, right: 10, bottom: 28, left: 32 };
  const W = 340 - PAD.left - PAD.right;
  const H = 110 - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(8, W / data.length - 6);

  return (
    <svg viewBox="0 0 340 110" width="100%" height={110}
      aria-label="Bar chart: risk distribution" role="img">
      <line x1={PAD.left} x2={PAD.left + W} y1={PAD.top + H} y2={PAD.top + H}
        stroke="#e2e8e2" strokeWidth="1" />
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * H;
        const cx = PAD.left + (i + 0.5) * (W / data.length);
        const col = d.color || "#173d2a";
        return (
          <g key={d.label}>
            <rect x={cx - barW / 2} y={PAD.top + H - barH} width={barW}
              height={Math.max(barH, 2)} fill={col} rx="3" fillOpacity="0.85" />
            <text x={cx} y={PAD.top + H + 14} textAnchor="middle" fontSize="9" fill="#829288">
              {d.label}
            </text>
            <text x={cx} y={PAD.top + H - barH - 3} textAnchor="middle"
              fontSize="9" fontWeight="600" fill={col}>
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Risk level -> colour (matches existing CSS palette)
const RISK_COLORS = {
  low:      "#22c55e",
  moderate: "#eab308",
  high:     "#f97316",
  critical: "#ef4444",
};

// ============================================================
// C4 — Food-type options matching backend ML models
// ============================================================
const FOOD_CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy Products",
  "Meat & Poultry",
  "Seafood",
  "Bakery Products",
  "Packaged Foods",
  "Beverages",
];

const FOOD_TYPE_OPTIONS = [
  // Fruits — no model, shown as disabled
  { value: "apple",         label: "Apple",              category: "Fruits",         isApproved: false, isSynthetic: false },
  { value: "banana",        label: "Banana",             category: "Fruits",         isApproved: false, isSynthetic: false },
  { value: "orange",        label: "Orange",             category: "Fruits",         isApproved: false, isSynthetic: false },
  // Vegetables
  { value: "tomato",        label: "Tomato",             category: "Vegetables",     isApproved: true,  isSynthetic: false },
  { value: "vegetables",    label: "Synthetic Vegetables",category: "Vegetables",     isApproved: true,  isSynthetic: true  },
  // Dairy Products
  { value: "paneer",        label: "Paneer",             category: "Dairy Products", isApproved: true,  isSynthetic: false },
  // Meat & Poultry
  { value: "meat_poultry",  label: "Synthetic Meat & Poultry", category: "Meat & Poultry", isApproved: true, isSynthetic: true },
  // Seafood
  { value: "seafood",       label: "Seafood",            category: "Seafood",        isApproved: true,  isSynthetic: false },
  // Bakery Products
  { value: "bakery",        label: "Synthetic Bakery",   category: "Bakery Products",isApproved: true,  isSynthetic: true  },
  // Packaged Foods
  { value: "packaged_foods",label: "Synthetic Packaged Foods", category: "Packaged Foods", isApproved: true, isSynthetic: true },
  // Beverages
  { value: "beverages",     label: "Synthetic Beverages",category: "Beverages",      isApproved: true,  isSynthetic: true  },
];

const APPROVED_PACKAGING = {
  tomato: "uncoated",
  paneer: "sealed",
  seafood: "open",
  vegetables: "perforated",
  meat_poultry: "vacuum_sealed",
  bakery: "paper",
  packaged_foods: "airtight",
  beverages: "sealed",
};

const CATEGORY_DEFAULTS = {
  tomato: { packaging_type: "uncoated", temperature_c: 22.5, humidity_pct: 70, storage_duration_days: 2 },
  paneer: { packaging_type: "sealed", temperature_c: 6.0, humidity_pct: 80, storage_duration_days: 1, nled_level: 0, bwc_level: 0 },
  seafood: { packaging_type: "open", temperature_c: 3.0, humidity_pct: 85, storage_duration_days: 1, species: "mackerel" },
  vegetables: { packaging_type: "perforated", temperature_c: 10.0, humidity_pct: 85, storage_duration_days: 2 },
  meat_poultry: { packaging_type: "vacuum_sealed", temperature_c: 4.0, humidity_pct: 75, storage_duration_days: 2 },
  bakery: { packaging_type: "paper", temperature_c: 21.0, humidity_pct: 55, storage_duration_days: 2 },
  packaged_foods: { packaging_type: "sealed", temperature_c: 6.0, humidity_pct: 55, storage_duration_days: 5 },
  beverages: { packaging_type: "sealed", temperature_c: 8.0, humidity_pct: 60, storage_duration_days: 5 },
};

// ============================================================
// 5. M3 SHELF-LIFE, STORAGE, AND ANALYTICS VIEW
// ============================================================
function ShelfLifeView({ session }) {
  const [analyses, setAnalyses] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [storageHistory, setStorageHistory] = useState([]);   // C2
  const [selectedAnalysis, setSelectedAnalysis] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageOpen, setStorageOpen] = useState(false);      // C2 panel toggle
  const [form, setForm] = useState({
    food_type: "tomato",
    species: "mackerel",
    nled_level: 0,
    bwc_level: 0,
    temperature_c: 22.5,
    humidity_pct: 70,
    packaging_type: "uncoated",
    storage_duration_days: 2,
    air_circulation: "good",
    light_exposure: "low",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const [analysisData, predictionData, analyticsData, storageData] = await Promise.all([
        getAnalysisHistory(session.token),
        getShelfLifeHistory(session.token),
        getM3Analytics(session.token),
        getStorageConditions(session.token),   // C2
      ]);
      setAnalyses(analysisData);
      setPredictions(predictionData);
      setAnalytics(analyticsData);
      setStorageHistory(storageData);
    } catch (err) {
      setError(err.message || "Failed to load M3 data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const selected = analyses.find((item) => String(item.id) === selectedAnalysis);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleAnalysisChange = (analysisId) => {
    setSelectedAnalysis(analysisId);
  };

  const updateFoodType = (value) => {
    const defaults = CATEGORY_DEFAULTS[value] || {};
    setForm((current) => ({
      ...current,
      food_type: value,
      packaging_type: defaults.packaging_type || APPROVED_PACKAGING[value] || current.packaging_type,
      ...(defaults.temperature_c !== undefined ? { temperature_c: defaults.temperature_c } : {}),
      ...(defaults.humidity_pct !== undefined ? { humidity_pct: defaults.humidity_pct } : {}),
      ...(defaults.storage_duration_days !== undefined ? { storage_duration_days: defaults.storage_duration_days } : {}),
      ...(defaults.nled_level !== undefined ? { nled_level: defaults.nled_level } : {}),
      ...(defaults.bwc_level !== undefined ? { bwc_level: defaults.bwc_level } : {}),
      ...(defaults.species !== undefined ? { species: defaults.species } : {}),
    }));
  };

  const predict = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setRecommendations([]);
    try {
      const result = await createShelfLifePrediction(session.token, {
        food_type: form.food_type,
        analysis_id: selected?.id || null,
        freshness_classification: selected?.classification || "Acceptable",
        visual_quality_score: selected?.quality_score || 70,
        spoilage_probability: selected?.spoilage_probability || 0.3,
        temperature_c: Number(form.temperature_c),
        humidity_pct: Number(form.humidity_pct),
        packaging_type: form.packaging_type,
        storage_duration_days: Number(form.storage_duration_days),
        species: form.food_type === "seafood" ? form.species : null,
        nled_level: form.food_type === "tomato" ? Number(form.nled_level || 0) : 0,
        bwc_level: form.food_type === "tomato" ? Number(form.bwc_level || 0) : 0,
        air_circulation: form.air_circulation,
        light_exposure: form.light_exposure,
      });
      setPrediction(result);
      setRecommendationsLoading(true);
      try {
        const recs = await getM3Recommendations(session.token, result.id);
        setRecommendations(recs);
      } catch {
        // Fall back to embedded response recommendations if separate fetch fails
        if (result.recommendations) {
          setRecommendations(result.recommendations);
        }
      } finally {
        setRecommendationsLoading(false);
      }
      await refresh();
    } catch (err) {
      setError(err.message || "Shelf-life prediction failed");
    } finally {
      setBusy(false);
    }
  };

  // C1: Derive chart data from backend analytics — no values are invented.
  const freshnessTrendData = analytics?.freshness_trend?.map((item) => ({
    label: item.date.slice(5),        // show "MM-DD" to save horizontal space
    value: item.average_score,
  })) ?? [];

  const shelfLifeTrendData = analytics?.shelf_life_trend?.map((item) => ({
    label: item.date.slice(5),
    value: item.average_remaining_days,
  })) ?? [];

  const riskBarData = analytics?.risk_counts
    ? Object.entries(analytics.risk_counts).map(([level, count]) => ({
        label: level,
        value: count,
        color: RISK_COLORS[level] ?? "#829288",
      }))
    : [];

  // Only show analytics content when there is real data
  const hasAnalytics = analytics && analytics.total_predictions > 0;

  return (
    <div className="m3-shell">

      {/* ── Heading ── */}
      <section className="m3-heading">
        <div>
          <p className="eyebrow">M3 ML ENGINE</p>
          <h1>Shelf-Life Prediction</h1>
          <p>Predict remaining shelf life using validated category-specific machine-learning regression models.</p>
        </div>
        <div className="m3-model-note"><ShieldAlert size={18} /> Transparent ML prediction — trained models only</div>
      </section>

      {error && <div className="notice-box error-box">{error}</div>}

      {/* ── Forecast form + result ── */}
      <div className="m3-layout">
        <form className="panel m3-form" onSubmit={predict}>
          <div className="panel-head">
            <div>
              <h2>Production ML Models</h2>
              <p>Select an approved category and enter storage conditions.</p>
            </div>
          </div>
          {/* Food-type selector — grouped by official category */}
          <label>Food Category
            <select value={form.food_type} onChange={(e) => updateFoodType(e.target.value)}>
              {FOOD_CATEGORIES.map((cat) => {
                const opts = FOOD_TYPE_OPTIONS.filter((o) => o.category === cat);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {opts.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={!opt.isApproved}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <div className="m3-input-grid">
            <label><span><Thermometer size={14} /> Temperature (°C)</span>
              <input type="number" step="0.1" value={form.temperature_c}
                onChange={(e) => update("temperature_c", e.target.value)} /></label>
            <label><span><Droplets size={14} /> Humidity (%)</span>
              <input type="number" step="1" min="0" max="100" value={form.humidity_pct}
                onChange={(e) => update("humidity_pct", e.target.value)} /></label>
            <label>Packaging
              <select value={form.packaging_type} onChange={(e) => update("packaging_type", e.target.value)}>
                <option value="uncoated">uncoated (Tomato)</option>
                <option value="beeswax_coated">beeswax_coated (Tomato)</option>
                <option value="sealed">sealed (Paneer / Beverages)</option>
                <option value="open">open (Seafood)</option>
                <option value="perforated">perforated (Vegetables)</option>
                <option value="vacuum_sealed">vacuum_sealed (Meat &amp; Poultry)</option>
                <option value="paper">paper (Bakery)</option>
                <option value="airtight">airtight (Packaged Foods)</option>
                <option value="modified_atmosphere">modified_atmosphere</option>
              </select></label>
            <label>Storage duration (days)
              <input type="number" min="0" value={form.storage_duration_days}
                onChange={(e) => update("storage_duration_days", e.target.value)} /></label>
          </div>
          <div className="m3-input-grid">
            {form.food_type === "seafood" && (
              <label>Species (Seafood)
                <select value={form.species || "mackerel"} onChange={(e) => update("species", e.target.value)}>
                  <option value="mackerel">Mackerel (Scomber)</option>
                  <option value="tilapia">Tilapia (Oreochromis)</option>
                  <option value="tuna">Tuna (Thunnus)</option>
                </select></label>
            )}
            {form.food_type === "tomato" && (
              <>
                <label>Nano-LED Level (NLED)
                  <select value={form.nled_level} onChange={(e) => update("nled_level", Number(e.target.value))}>
                    <option value={0}>0 (Control)</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                  </select></label>
                <label>Beeswax Level (BWC %)
                  <select value={form.bwc_level} onChange={(e) => update("bwc_level", Number(e.target.value))}>
                    <option value={0}>0% (Uncoated)</option>
                    <option value={3}>3%</option>
                    <option value={6}>6%</option>
                    <option value={9}>9%</option>
                  </select></label>
              </>
            )}
          </div>
          <button className="btn-primary full wide" disabled={busy || loading}>
            <BarChart3 size={16} /> {busy ? "Forecasting..." : "Predict Remaining Shelf Life"}
          </button>
          <p className="m3-footnote">Powered by FreshGuard M3 ML Engine (Production: Tomato, Paneer, Seafood | Synthetic Demo: Vegetables, Meat, Bakery, Packaged Foods, Beverages).</p>
        </form>

        <section className="panel m3-result">
          {!prediction ? (
            <div className="state-empty">
              <BarChart3 size={42} />
              <strong>No M3 forecast yet</strong>
              <span>Run a forecast to see ML-predicted shelf life, model info, and recommendations.</span>
            </div>
          ) : (
            <>
              <div className="m3-ml-hero">
                <span className="eyebrow">{prediction.data_type === "SYNTHETIC" ? "M3 SYNTHETIC DEMONSTRATION" : "M3 ML PREDICTION"}</span>
                <div className="m3-ml-rsl">
                  <span className="m3-ml-rsl-num">{prediction.remaining_shelf_life_days}</span>
                  <span className="m3-ml-rsl-unit">days remaining</span>
                </div>
              </div>
              <div className="m3-summary-grid">
                <div><span>Food Category</span><strong style={{ textTransform: "capitalize" }}>{prediction.food_type}</strong></div>
                <div><span>Remaining Shelf Life</span><strong>{prediction.remaining_shelf_life_days} days</strong></div>
                <div><span>Model</span><strong style={{ fontSize: "12px", wordBreak: "break-all" }}>{prediction.model_type}</strong></div>
              </div>
              <div className="m3-summary-grid" style={{ marginTop: "10px" }}>
                <div>
                  <span>Data &amp; Validation Status</span>
                  {prediction.data_type === "SYNTHETIC" || (prediction.model_type && prediction.model_type.includes("SYNTHETIC")) ? (
                    <strong style={{ color: "#d97706", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Synthetic Dataset (Demonstration)
                    </strong>
                  ) : (
                    <strong style={{ color: "#059669", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Validated ML Prediction
                    </strong>
                  )}
                </div>
                <div><span>Confidence</span><strong>{prediction.confidence !== null && prediction.confidence !== undefined ? `${Math.round(prediction.confidence * 100)}%` : "Not calibrated"}</strong></div>
                <div><span>Predicted Expiry Date</span><strong>{prediction.predicted_expiry_date}</strong></div>
              </div>
              <div className="m3-recommendations">
                <h3>Storage &amp; Handling Recommendations</h3>
                {recommendationsLoading && <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Loading recommendations...</p>}
                {!recommendationsLoading && recommendations.length === 0 && (
                  <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>No recommendations returned for this item.</p>
                )}
                {recommendations.map((item, index) => (
                  <div className="m3-recommendation" key={`${item.action}-${index}`}>
                    <strong>{item.action}</strong>
                    <span>{item.reason}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── M3 Prediction History ── */}
      <section className="panel m3-prediction-history">
        <div className="panel-head">
          <div>
            <h2>M3 Prediction History</h2>
            <p>Recent ML shelf-life predictions generated for your account.</p>
          </div>
          <button className="icon-button" onClick={refresh} title="Refresh history">
            <RefreshCw size={16} />
          </button>
        </div>
        {predictions.length === 0 ? (
          <div className="state-empty">
            <History size={28} />
            <span>No shelf-life predictions yet.</span>
          </div>
        ) : (
          <div className="history-list">
            {predictions.slice(0, 8).map((p) => (
              <div key={p.id} className="history-card">
                <BarChart3 size={18} color="#059669" />
                <div className="history-info">
                  <strong style={{ textTransform: "capitalize" }}>{p.food_type}</strong>
                  <span className="history-badge" style={{ background: "#edf7ef", color: "#173d2a" }}>
                    {p.remaining_shelf_life_days} days RSL
                  </span>
                </div>
                <div className="history-scores">
                  <span>Model: <strong>{p.model_type}</strong></span>
                  <span>Expiry: <strong>{p.predicted_expiry_date}</strong></span>
                </div>
                <span className="history-date">{new Date(p.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── M3 Shelf-Life Analytics ── */}
      <section className="panel m3-analytics-panel">
        <div className="panel-head">
          <div>
            <h2>M3 Shelf-Life Analytics</h2>
            <p>Aggregated metrics from your authenticated M3 forecasts.</p>
          </div>
          <button className="icon-button" onClick={refresh} title="Refresh analytics">
            <RefreshCw size={16} />
          </button>
        </div>

        {!hasAnalytics ? (
          <div className="state-empty">
            <BarChart3 size={28} />
            <span>No M3 history yet. Run your first forecast to see analytics.</span>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">Total forecasts</span>
                <strong className="kpi-value">{analytics.total_predictions}</strong>
              </div>
              {analytics.average_remaining_shelf_life_days != null && (
                <div className="kpi-card">
                  <span className="kpi-label">Avg remaining life</span>
                  <strong className="kpi-value">
                    {analytics.average_remaining_shelf_life_days}
                    <span className="kpi-unit"> days</span>
                  </strong>
                </div>
              )}
              <div className="kpi-card">
                <span className="kpi-label">Expiring Soon</span>
                <strong className="kpi-value">
                  {analytics.expiring_soon_count > 0 ? analytics.expiring_soon_count : "—"}
                </strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Expired</span>
                <strong className="kpi-value">
                  {analytics.expired_count > 0 ? analytics.expired_count : "—"}
                </strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">High Risk</span>
                <strong className="kpi-value">
                  {analytics.high_risk_count > 0 ? analytics.high_risk_count : "—"}
                </strong>
              </div>
            </div>

            {/* SVG charts */}
            <div className="charts-grid">
              {shelfLifeTrendData.length > 0 && (
                <div className="chart-card">
                  <p className="chart-title">Remaining shelf-life trend (days)</p>
                  <LineChart data={shelfLifeTrendData} color="#0369a1" yLabel="Remaining days" />
                </div>
              )}
              {riskBarData.length > 0 && (
                <div className="chart-card">
                  <p className="chart-title">Risk level distribution</p>
                  <BarChart data={riskBarData} />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── C2: Storage condition history ── */}
      <section className="panel m3-storage-history">
        <div className="panel-head">
          <div>
            <h2>Storage condition history</h2>
            <p>All recorded storage readings for your account.</p>
          </div>
          <button
            className="icon-button"
            onClick={() => setStorageOpen((o) => !o)}
            title={storageOpen ? "Collapse" : "Expand"}
            aria-expanded={storageOpen}
          >
            <RefreshCw size={16} className={storageOpen ? "" : "icon-rotated"} />
          </button>
        </div>

        {storageOpen && (
          storageHistory.length === 0 ? (
            <div className="state-empty">
              <Thermometer size={28} />
              <span>No storage readings yet. They are recorded automatically when you run a forecast.</span>
            </div>
          ) : (
            <div className="sc-table-wrapper">
              <table className="sc-table">
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Temp (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Airflow</th>
                    <th>Light</th>
                    <th>Packaging</th>
                    <th>Duration (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {storageHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="sc-date">{new Date(row.observed_at).toLocaleString()}</td>
                      <td className="sc-num">{row.temperature_c}</td>
                      <td className="sc-num">{row.humidity_pct}</td>
                      <td><StorageConditionBadge value={row.air_circulation} type="air" /></td>
                      <td><StorageConditionBadge value={row.light_exposure} type="light" /></td>
                      <td className="sc-pkg">{row.packaging_type.replace(/_/g, " ")}</td>
                      <td className="sc-num">{row.storage_duration_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {!storageOpen && storageHistory.length > 0 && (
          <p className="m3-baseline-label" style={{ marginTop: 8 }}>
            {storageHistory.length} reading{storageHistory.length === 1 ? "" : "s"} — click to expand
          </p>
        )}
      </section>

    </div>
  );
}

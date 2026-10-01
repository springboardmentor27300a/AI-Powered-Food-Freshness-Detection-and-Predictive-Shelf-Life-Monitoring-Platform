import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:8000";

const CATEGORIES = [
  { name: "Fruits", icon: "🍏", produces: true },
  { name: "Vegetables", icon: "🥦", produces: true },
  { name: "Dairy Products", icon: "🥛", produces: false },
  { name: "Meat & Poultry", icon: "🥩", produces: false },
  { name: "Seafood", icon: "🐟", produces: false },
  { name: "Bakery Products", icon: "🍞", produces: false },
  { name: "Packaged Foods", icon: "📦", produces: false },
  { name: "Beverages", icon: "🥤", produces: false },
];

const ROLES = [
  { id: "consumer", label: "Consumer", icon: "🥑" },
  { id: "retail_manager", label: "Retail Manager", icon: "🏪" },
  { id: "warehouse_operator", label: "Warehouse Operator", icon: "🏭" },
  { id: "inspector", label: "Food Quality Inspector", icon: "🔍" },
  { id: "admin", label: "Administrator", icon: "🛡️" },
];

const PACKAGING_TYPES = ["Loose", "Vacuum Sealed", "Modified Atmosphere", "Refrigerated Pack", "Frozen Pack"];

function App() {
  const [view, setView] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");

  // Auth form states
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("consumer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Food & Summary
  const [foodItems, setFoodItems] = useState([]);
  const [summary, setSummary] = useState(null);

  // New item form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Fruits");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newExpiry, setNewExpiry] = useState("");
  const [newBatch, setNewBatch] = useState("");
  const [newTemp, setNewTemp] = useState("");
  const [newHumidity, setNewHumidity] = useState("");
  const [newPackaging, setNewPackaging] = useState("Loose");

  // Edit item form
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Fruits");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editExpiry, setEditExpiry] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editTemp, setEditTemp] = useState("");
  const [editHumidity, setEditHumidity] = useState("");
  const [editPackaging, setEditPackaging] = useState("Loose");

  // Analysis, Preview & Trend
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analyzeError, setAnalyzeError] = useState({});
  const [previewImage, setPreviewImage] = useState({});
  const [results, setResults] = useState({});
  const [trends, setTrends] = useState({});
  const [recs, setRecs] = useState({});

  // Reports modal
  const [reports, setReports] = useState([]);
  const [showReports, setShowReports] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportRatingFilter, setReportRatingFilter] = useState("All");

  // PDF Report modal
  const [pdfReportItem, setPdfReportItem] = useState(null);
  const [pdfReportResult, setPdfReportResult] = useState(null);

  // Admin
  const [adminUsers, setAdminUsers] = useState([]);
  const [perfMetrics, setPerfMetrics] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Profile
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");

  // Storage Logs
  const [showStorageLogId, setShowStorageLogId] = useState(null);
  const [storageLogs, setStorageLogs] = useState([]);
  const [newStorageTemp, setNewStorageTemp] = useState("");
  const [newStorageHumidity, setNewStorageHumidity] = useState("");
  const [newStorageAir, setNewStorageAir] = useState("Good");
  const [newStorageLight, setNewStorageLight] = useState("Low");

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (token) {
      fetchUser();
      fetchFoodItems();
      fetchDashboardResults();
      fetchSummary();
      fetchNotifications();
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAdminData();
    }
    if (user) {
      setProfileName(user.name || "");
    }
  }, [user]);

  // ── Data Fetchers ─────────────────────────────────────────────────────────

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API}/me`, { headers: authHeader });
      if (res.ok) setUser(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchDashboardResults = async () => {
    try {
      const res = await fetch(`${API}/freshness-reports`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        const rMap = {};
        data.forEach(r => {
          if (!rMap[r.food_item_id] || new Date(r.created_at) > new Date(rMap[r.food_item_id].created_at)) {
             rMap[r.food_item_id] = r;
          }
        });
        setResults(rMap);
      }
    } catch (e) { console.error(e); }
  };

  const fetchFoodItems = async () => {
    try {
      const res = await fetch(`${API}/food`, { headers: authHeader });
      if (res.ok) setFoodItems(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API}/freshness-summary`, { headers: authHeader });
      if (res.ok) setSummary(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API}/notifications`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.alerts || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAdminData = async () => {
    try {
      const [usersRes, perfRes] = await Promise.all([
        fetch(`${API}/users`, { headers: authHeader }),
        fetch(`${API}/metrics/performance`, { headers: authHeader }),
      ]);
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (perfRes.ok) setPerfMetrics(await perfRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchTrend = async (foodId) => {
    try {
      const res = await fetch(`${API}/food/${foodId}/trend`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setTrends((prev) => ({ ...prev, [foodId]: data }));
      }
    } catch (e) { console.error(e); }
  };

  const fetchRecommendations = async (foodId) => {
    try {
      const res = await fetch(`${API}/food/${foodId}/recommendations`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setRecs((prev) => ({ ...prev, [foodId]: data }));
      }
    } catch (e) { console.error(e); }
  };

  const fetchStorageLogs = async (foodId) => {
    try {
      const res = await fetch(`${API}/food/${foodId}/storage-logs`, { headers: authHeader });
      if (res.ok) setStorageLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchReports = async () => {
    const res = await fetch(`${API}/freshness-reports`, { headers: authHeader });
    if (res.ok) {
      setReports(await res.json());
      setShowReports(true);
    }
  };

  // ── Auth Handlers ─────────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("token", data.access_token);
        setUser(data.user);
      } else {
        setAuthError("Invalid email or password");
      }
    } catch (e) {
      setAuthError("Cannot connect to server. Make sure backend is running.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, role: regRole }),
      });
      if (res.ok) {
        setView("login");
        setEmail(regEmail);
        setRegName(""); setRegEmail(""); setRegPassword(""); setRegRole("consumer");
      } else {
        const data = await res.json();
        setAuthError(data.detail || "Registration failed");
      }
    } catch (e) {
      setAuthError("Cannot connect to server.");
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("token");
    setUser(null);
    setFoodItems([]);
    setResults({});
    setPreviewImage({});
    setShowReports(false);
  };

  // ── Food CRUD ─────────────────────────────────────────────────────────────

  const handleAddFood = async (e) => {
    e.preventDefault();
    if (!newName) return;
    try {
      const res = await fetch(`${API}/food`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          name: newName, category: newCategory,
          quantity: Number(newQuantity), expiry_date: newExpiry || null,
          batch_number: newBatch || null,
          storage_temp: newTemp ? Number(newTemp) : null,
          humidity: newHumidity ? Number(newHumidity) : null,
          packaging_type: newPackaging,
        }),
      });
      if (res.ok) {
        setNewName(""); setNewCategory("Fruits"); setNewQuantity(1);
        setNewExpiry(""); setNewBatch(""); setNewTemp("");
        setNewHumidity(""); setNewPackaging("Loose");
        fetchFoodItems();
      fetchDashboardResults(); fetchSummary();
      } else {
        const err = await res.json();
        alert(`Failed to add: ${err.detail || JSON.stringify(err)}`);
      }
    } catch (e) { alert("Network error. Backend may not be running."); }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`${API}/food/${id}`, { method: "DELETE", headers: authHeader });
    if (res.ok) { fetchFoodItems();
      fetchDashboardResults(); fetchSummary(); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category || "Fruits");
    setEditQuantity(item.quantity);
    setEditExpiry(item.expiry_date || "");
    setEditBatch(item.batch_number || "");
    setEditTemp(item.storage_temp ?? "");
    setEditHumidity(item.humidity ?? "");
    setEditPackaging(item.packaging_type || "Loose");
  };

  const saveEdit = async (id) => {
    const res = await fetch(`${API}/food/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        name: editName, category: editCategory,
        quantity: Number(editQuantity), expiry_date: editExpiry || null,
        batch_number: editBatch || null,
        storage_temp: editTemp ? Number(editTemp) : null,
        humidity: editHumidity ? Number(editHumidity) : null,
        packaging_type: editPackaging,
      }),
    });
    if (res.ok) { setEditingId(null); fetchFoodItems();
      fetchDashboardResults(); fetchSummary(); }
  };

  // ── Analysis ──────────────────────────────────────────────────────────────

  const handleFileChange = (foodId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage((prev) => ({ ...prev, [foodId]: { file, url: reader.result } }));
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (foodId) => {
    const preview = previewImage[foodId];
    if (!preview?.file) return;
    setAnalyzingId(foodId);
    setAnalyzeError((prev) => ({ ...prev, [foodId]: null }));

    const formData = new FormData();
    formData.append("file", preview.file);

    try {
      const res = await fetch(`${API}/analyze-freshness?food_item_id=${foodId}`, {
        method: "POST",
        headers: authHeader,
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResults((prev) => ({ ...prev, [foodId]: data }));
        fetchSummary();
        fetchTrend(foodId);
        fetchRecommendations(foodId);
        fetchNotifications();
      } else {
        const err = await res.json();
        setAnalyzeError((prev) => ({ ...prev, [foodId]: err.detail || "Analysis failed" }));
      }
    } catch (e) {
      setAnalyzeError((prev) => ({ ...prev, [foodId]: "Network error - make sure backend is running." }));
    } finally {
      setAnalyzingId(null);
    }
  };

  // ── Storage Logs ──────────────────────────────────────────────────────────

  const handleSaveStorage = async (e, foodId) => {
    e.preventDefault();
    const res = await fetch(`${API}/food/${foodId}/storage-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        temperature: newStorageTemp ? Number(newStorageTemp) : null,
        humidity: newStorageHumidity ? Number(newStorageHumidity) : null,
        air_circulation: newStorageAir,
        light_exposure: newStorageLight,
      }),
    });
    if (res.ok) {
      setNewStorageTemp(""); setNewStorageHumidity("");
      fetchStorageLogs(foodId);
    }
  };

  // ── Profile ───────────────────────────────────────────────────────────────

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const body = { name: profileName };
      if (profilePassword) body.password = profilePassword;
      const res = await fetch(`${API}/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setUser(await res.json());
        setShowProfile(false);
        setProfilePassword("");
      }
    } catch (e) { console.error(e); }
  };

  // ── Excel Export (with auth) ──────────────────────────────────────────────

  const handleExcelExport = async () => {
    try {
      const res = await fetch(`${API}/export/excel`, { headers: authHeader });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "freshness_report.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { alert("Export failed"); }
  };

  // ── Utilities ─────────────────────────────────────────────────────────────

  const categoryColor = (cat) => {
    switch (cat) {
      case "Fresh": return "#10b981";
      case "Good": return "#34d399";
      case "Acceptable": return "#f59e0b";
      case "Near Spoilage": return "#f97316";
      case "Spoiled": return "#ef4444";
      default: return "#64748b";
    }
  };

  const getExpiryStatus = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryDateStr);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "EXPIRED", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    if (diffDays <= 3) return { label: `EXPIRING (${diffDays}d)`, color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    return { label: `FRESH (${diffDays}d left)`, color: "#10b981", bg: "rgba(16,185,129,0.15)" };
  };

  const isProduceCategory = (catName) => {
    const cat = CATEGORIES.find((c) => c.name === catName);
    return cat ? cat.produces : true;
  };

  const getRoleObj = (roleId) => ROLES.find((r) => r.id === roleId) || ROLES[0];

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      reportSearch === "" ||
      r.food_item_id.toString().includes(reportSearch) ||
      (r.label || "").toLowerCase().includes(reportSearch.toLowerCase());
    if (reportRatingFilter === "Waste")
      return matchesSearch && (r.category === "Spoiled" || r.category === "Near Spoilage");
    if (reportRatingFilter === "Compliance")
      return matchesSearch && (r.storage_score ?? 100) < 80;
    const matchesRating = reportRatingFilter === "All" || r.category === reportRatingFilter;
    return matchesSearch && matchesRating;
  });

  // ── Auth Screen ───────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card glass-panel">
          <div className="logo-badge">🥑</div>
          <h1>Food Freshness Engine</h1>
          <p className="subtitle">AI-Powered Multi-Factor Quality & Shelf-Life Platform</p>

          {view === "login" ? (
            <>
              <h2>Log In to Platform</h2>
              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="input-group">
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="primary-btn">Sign In →</button>
              </form>

              {authError && <p className="error">{authError}</p>}
              <p className="switch">
                Don&apos;t have an account?{" "}
                <span onClick={() => { setView("register"); setAuthError(""); }}>Create Account</span>
              </p>
            </>
          ) : (
            <>
              <h2>Create Account</h2>
              <form onSubmit={handleRegister}>
                <div className="input-group">
                  <input placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                </div>
                <div className="input-group">
                  <input type="email" placeholder="Email Address" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                </div>
                <div className="input-group">
                  <input type="password" placeholder="Password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Select Platform Role</label>
                  <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className="role-select">
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="primary-btn">Register Account →</button>
              </form>
              {authError && <p className="error">{authError}</p>}
              <p className="switch">
                Already have an account?{" "}
                <span onClick={() => { setView("login"); setAuthError(""); }}>Sign In</span>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const roleObj = user ? getRoleObj(user.role) : ROLES[0];

  // ── Main Dashboard ────────────────────────────────────────────────────────

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="header-glass">
        <div className="header-left">
          <div className="app-logo">🥑</div>
          <div>
            <h1>{roleObj.label} Dashboard</h1>
            <div className="user-welcome">
              <span>Welcome, <strong>{user?.name || "User"}</strong></span>
              <span className="role-badge">{roleObj.icon} {roleObj.label}</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          {/* Notification Bell */}
          <div className="notification-wrapper">
            <button className="nav-btn icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
              🔔 {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
            </button>
            {showNotifications && (
              <div className="dropdown-panel notifications-dropdown">
                <h4>🔔 System Alerts</h4>
                {notifications.length === 0
                  ? <p style={{ color: "#94a3b8", padding: "10px 0" }}>No new alerts.</p>
                  : notifications.map((n, idx) => (
                    <div key={idx} className="notification-item" style={{ borderLeft: `3px solid ${n.type === "danger" ? "#ef4444" : n.type === "warning" ? "#f59e0b" : "#3b82f6"}` }}>
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <button className="nav-btn outline-btn" onClick={() => { setShowProfile(true); setProfileName(user?.name || ""); }}>
            👤 Profile
          </button>
          <button className="nav-btn accent-btn" onClick={fetchReports}>
            📊 Analytics & Reports
          </button>
          <button className="nav-btn outline-btn" onClick={logout}>Log Out</button>
        </div>
      </header>

      {/* ── Profile Modal ── */}
      {showProfile && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>👤 Edit Profile</h2>
              <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <form onSubmit={updateProfile}>
              <div className="input-group">
                <label>Name</label>
                <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Full Name" />
              </div>
              <div className="input-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} placeholder="New Password" />
              </div>
              <div className="edit-actions">
                <button type="submit" className="save-btn">Save Changes</button>
                <button type="button" className="cancel-btn" onClick={() => setShowProfile(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inspector Banner ── */}
      {user?.role === "inspector" && (
        <div style={{ background: "#fef3c7", color: "#92400e", margin: "20px", borderRadius: "8px", padding: "15px", border: "1px solid #fcd34d" }}>
          <strong>🔍 Inspector Mode Active</strong> — Ensure all flagged batches are verified and storage logs are audited before sign-off.
        </div>
      )}

      {/* ── Summary Banner ── */}
      {summary && (
        <div className="summary-banner">
          <div className="summary-card">
            <span className="summary-icon">📦</span>
            <div><span className="summary-value">{summary.total_items}</span><span className="summary-label">Total Items</span></div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🔬</span>
            <div><span className="summary-value">{summary.total_analyzed}</span><span className="summary-label">AI Scans Run</span></div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🌟</span>
            <div><span className="summary-value">{summary.avg_quality_score}%</span><span className="summary-label">Avg Quality</span></div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🥬</span>
            <div><span className="summary-value" style={{ color: "#10b981" }}>{summary.fresh_count}</span><span className="summary-label">Fresh Detected</span></div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">⚠️</span>
            <div><span className="summary-value" style={{ color: "#ef4444" }}>{summary.spoiled_count}</span><span className="summary-label">Spoiled Detected</span></div>
          </div>
        </div>
      )}

      {/* ── Admin: Platform Performance Metrics (Section 8) ── */}
      {user?.role === "admin" && perfMetrics && (
        <div className="card-panel admin-metrics-panel">
          <h3 className="section-title">🛡️ Section 8: Platform Performance Metrics</h3>
          <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "15px" }}>
            <div className="metric-box" style={{ background: "rgba(255,255,255,0.08)", padding: "15px", borderRadius: "8px" }}>
              <h4>⚡ System Performance</h4>
              <p>API Latency: <strong>{perfMetrics.system.api_response_time_ms} ms</strong></p>
              <p>Prediction Latency: <strong>{perfMetrics.system.prediction_latency_ms} ms</strong></p>
              <p>Concurrent Users: <strong>{perfMetrics.system.concurrent_user_capacity}</strong></p>
              <p>UI Load Speed: <strong>{perfMetrics.system.dashboard_loading_speed_ms} ms</strong></p>
            </div>
            <div className="metric-box" style={{ background: "rgba(255,255,255,0.08)", padding: "15px", borderRadius: "8px" }}>
              <h4>🔬 Freshness Assessment</h4>
              <p>Classification Accuracy: <strong>{perfMetrics.freshness.classification_accuracy}</strong></p>
              <p>Spoilage Detection: <strong>{perfMetrics.freshness.spoilage_detection_accuracy}</strong></p>
              <p>Scoring Consistency: <strong>{perfMetrics.freshness.scoring_consistency}</strong></p>
            </div>
            <div className="metric-box" style={{ background: "rgba(255,255,255,0.08)", padding: "15px", borderRadius: "8px" }}>
              <h4>📅 Shelf-Life Prediction</h4>
              <p>Prediction MAE: <strong>{perfMetrics.shelflife.prediction_mae_days} days</strong></p>
              <p>Forecast Accuracy: <strong>{perfMetrics.shelflife.forecast_accuracy}</strong></p>
              <p>Confidence Score: <strong>{perfMetrics.shelflife.prediction_confidence_score}</strong></p>
            </div>
            <div className="metric-box" style={{ background: "rgba(255,255,255,0.08)", padding: "15px", borderRadius: "8px" }}>
              <h4>💼 Business Impact</h4>
              <p>Waste Reduction: <strong>{perfMetrics.business.waste_reduction_effectiveness}</strong></p>
              <p>Storage Optimization: <strong>{perfMetrics.business.storage_optimization_accuracy}</strong></p>
              <p>Recommendation Relevance: <strong>{perfMetrics.business.recommendation_relevance}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin: User Management Table ── */}
      {user?.role === "admin" && adminUsers.length > 0 && (
        <div className="card-panel admin-panel">
          <h3 className="section-title">👥 System Users Management</h3>
          <table className="inventory-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Registered</th></tr>
            </thead>
            <tbody>
              {adminUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Retail Manager: Waste Reduction Insights ── */}
      {(user?.role === "retail_manager" || user?.role === "admin") && (
        <div className="card-panel" style={{ marginBottom: "20px", background: "rgba(16,185,129,0.05)", border: "1px solid #10b981" }}>
          <h3 className="section-title" style={{ color: "#10b981" }}>♻️ Retail Waste Reduction Insights</h3>
          <div style={{ display: "flex", gap: "20px", padding: "10px 0", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>At Risk Inventory</h4>
              <p style={{ fontSize: "2rem", margin: "10px 0", color: "#f59e0b" }}>
                {foodItems.filter((i) => getExpiryStatus(i.expiry_date)?.label?.includes("EXPIRING")).length}
              </p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Items expiring within 3 days. Discount immediately.</span>
            </div>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>Spoilage / Financial Waste</h4>
              <p style={{ fontSize: "2rem", margin: "10px 0", color: "#ef4444" }}>{summary?.spoiled_count || 0}</p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Items confirmed spoiled by AI scan.</span>
            </div>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>Recovery Potential</h4>
              <p style={{ fontSize: "2rem", margin: "10px 0", color: "#10b981" }}>
                {foodItems.filter((i) => { const r = results[i.id]; return r && r.category === "Near Spoilage"; }).length}
              </p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Items near spoilage but still safe for quick sale.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Warehouse Operator: Environmental & Compliance Analytics ── */}
      {(user?.role === "warehouse_operator" || user?.role === "admin") && (
        <div className="card-panel" style={{ marginBottom: "20px", background: "rgba(59,130,246,0.05)", border: "1px solid #3b82f6" }}>
          <h3 className="section-title" style={{ color: "#3b82f6" }}>🏭 Warehouse Environmental & Compliance Analytics</h3>
          <div style={{ display: "flex", gap: "20px", padding: "10px 0", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>Storage Compliance Violations</h4>
              <p style={{ fontSize: "2rem", margin: "10px 0", color: "#ef4444" }}>
                {foodItems.filter((i) => { const r = results[i.id]; return r && (r.storage_score ?? 100) < 80; }).length}
              </p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Batches failing temperature/humidity standards.</span>
            </div>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>Total Monitored Batches</h4>
              <p style={{ fontSize: "2rem", margin: "10px 0", color: "#3b82f6" }}>
                {foodItems.filter((i) => i.batch_number).length}
              </p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Active inventory with batch tracking IDs.</span>
            </div>
            <div style={{ flex: 1, minWidth: "160px", background: "rgba(0,0,0,0.2)", padding: "15px", borderRadius: "8px" }}>
              <h4>System Audit Status</h4>
              <p style={{ fontSize: "1.2rem", margin: "10px 0", color: "#10b981" }}>🟢 Active & Logging</p>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Environmental sensors online. AI monitoring active.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Form ── */}
      <div className="card-panel add-panel">
        <h3 className="section-title">+ Register Food Inventory Item</h3>
        <form className="add-form" onSubmit={handleAddFood}>
          <div className="form-grid">
            <input placeholder="Item Name (e.g. Organic Apples)" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {CATEGORIES.map((cat) => <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>)}
            </select>
            <input type="number" min="1" placeholder="Qty" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
            <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
            <input placeholder="Batch # (Optional)" value={newBatch} onChange={(e) => setNewBatch(e.target.value)} />
            <input type="number" step="0.1" placeholder="Storage Temp °C" value={newTemp} onChange={(e) => setNewTemp(e.target.value)} />
            <input type="number" step="0.1" placeholder="Humidity %" value={newHumidity} onChange={(e) => setNewHumidity(e.target.value)} />
            <select value={newPackaging} onChange={(e) => setNewPackaging(e.target.value)}>
              {PACKAGING_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="add-submit-btn">+ Add to Inventory</button>
        </form>
      </div>

      {/* ── Inventory Grid ── */}
      <h3 className="section-title">Active Inventory ({foodItems.length})</h3>
      <div className="food-grid">
        {foodItems.length === 0 && (
          <div className="empty-state"><p>🍏 No food items in your inventory yet. Add one above to get started!</p></div>
        )}

        {foodItems.map((item) => {
          const result = results[item.id];
          const preview = previewImage[item.id];
          const itemTrend = trends[item.id] || [];
          const isEditing = editingId === item.id;
          const expiryStatus = getExpiryStatus(item.expiry_date);
          const isProduce = isProduceCategory(item.category);
          const errMsg = analyzeError[item.id];

          return (
            <div className="food-card glass-card" key={item.id}>
              {isEditing ? (
                <div className="edit-form">
                  <h4>Edit Item #{item.id}</h4>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item Name" />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                  </select>
                  <input type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} placeholder="Qty" />
                  <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
                  <input value={editBatch} onChange={(e) => setEditBatch(e.target.value)} placeholder="Batch #" />
                  <input type="number" step="0.1" value={editTemp} onChange={(e) => setEditTemp(e.target.value)} placeholder="Temp °C" />
                  <input type="number" step="0.1" value={editHumidity} onChange={(e) => setEditHumidity(e.target.value)} placeholder="Humidity %" />
                  <select value={editPackaging} onChange={(e) => setEditPackaging(e.target.value)}>
                    {PACKAGING_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveEdit(item.id)}>Save Changes</button>
                    <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="food-card-top">
                    <div>
                      <span className="category-pill">{item.category}</span>
                      <h3 className="item-name">{item.name}</h3>
                    </div>
                    <div className="card-actions">
                      <button className="icon-btn" onClick={() => startEdit(item)} title="Edit">✎</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(item.id)} title="Delete">✕</button>
                    </div>
                  </div>

                  <div className="item-details">
                    <div className="detail-row">
                      <span>Quantity: <strong>{item.quantity}</strong></span>
                      {item.storage_temp !== null && item.storage_temp !== undefined && (
                        <span>Temp: <strong>{item.storage_temp}°C</strong></span>
                      )}
                    </div>
                    {item.humidity != null && (
                      <div className="detail-row"><span>Humidity: <strong>{item.humidity}%</strong></span></div>
                    )}
                    {item.packaging_type && (
                      <div className="detail-row"><span>📦 Packaging: <strong>{item.packaging_type}</strong></span></div>
                    )}
                    {item.batch_number && <div className="batch-tag">🏷️ Batch: {item.batch_number}</div>}
                    {expiryStatus && (
                      <div className="expiry-badge" style={{ color: expiryStatus.color, background: expiryStatus.bg }}>
                        ⏱️ {expiryStatus.label}
                      </div>
                    )}
                  </div>

                  {/* ── AI & CV Analysis Box ── */}
                  <div className="analysis-box">
                    {!isProduce && (
                      <p className="notice-banner">
                        ℹ️ Visual AI model is trained on Produce. Results for {item.category} are advisory.
                      </p>
                    )}

                    <div className="image-picker-zone">
                      {preview?.url ? (
                        <div className="preview-container">
                          <img src={preview.url} alt="Preview" className="preview-img" />
                          <button className="clear-img-btn" onClick={() => setPreviewImage((prev) => ({ ...prev, [item.id]: null }))}>✕</button>
                        </div>
                      ) : (
                        <label className="upload-label">
                          📷 Choose Food Image
                          <input type="file" accept="image/*" hidden onChange={(e) => handleFileChange(item.id, e.target.files[0])} />
                        </label>
                      )}

                      {preview?.url && (
                        <button
                          className="analyze-trigger-btn"
                          onClick={() => handleAnalyze(item.id)}
                          disabled={analyzingId === item.id}
                        >
                          {analyzingId === item.id ? "⏳ Analyzing Image & CV Features..." : "⚡ Run Section 4.7 AI Scan"}
                        </button>
                      )}
                    </div>

                    {errMsg && (
                      <div style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "10px", borderRadius: "6px", marginTop: "10px" }}>
                        ❌ {errMsg}
                      </div>
                    )}

                    {result && (
                      <div className="result-card" style={{ borderColor: categoryColor(result.category) }}>
                        <div className="result-header">
                          <span className="rating-badge" style={{ background: categoryColor(result.category) }}>{result.category}</span>
                          <span className="score-num">{result.quality_score} / 100</span>
                        </div>

                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${result.quality_score}%`, background: categoryColor(result.category) }} />
                        </div>

                        {/* Risk Level Badge */}
                        <div style={{
                          marginTop: "10px", padding: "5px 12px",
                          background: result.risk_level === "High Risk" ? "#fee2e2" : result.risk_level === "Medium Risk" ? "#fef3c7" : "#dcfce7",
                          color: result.risk_level === "High Risk" ? "#991b1b" : result.risk_level === "Medium Risk" ? "#92400e" : "#166534",
                          borderRadius: "5px", display: "inline-block", fontWeight: "600"
                        }}>
                          ⚠️ Risk Level: {result.risk_level || "Low Risk"}
                        </div>

                        {/* CV Sub-Feature Indicators */}
                        <div className="cv-metrics-grid">
                          <div className="cv-metric">
                            <span className="cv-label">🎨 Color Score</span>
                            <span className="cv-val">{result.color_score ?? 100}%</span>
                          </div>
                          <div className="cv-metric">
                            <span className="cv-label">🍄 Mold Free</span>
                            <span className="cv-val">{result.mold_score ?? 100}%</span>
                          </div>
                          <div className="cv-metric">
                            <span className="cv-label">🩹 Bruise Free</span>
                            <span className="cv-val">{result.bruising_score ?? 100}%</span>
                          </div>
                          <div className="cv-metric">
                            <span className="cv-label">⏳ Est Shelf Life</span>
                            <span className="cv-val">{result.shelflife_days ?? 7} days</span>
                          </div>
                        </div>

                        {/* Section 4.7 Weighted Model Breakdown */}
                        <div className="weighted-breakdown">
                          <p className="breakdown-title">Sec 4.7 Weighted Model Breakdown:</p>
                          <div className="weight-row">
                            <span>Visual (40%): <strong>{result.visual_score ?? 100}%</strong></span>
                            <span>Storage (25%): <strong>{result.storage_score ?? 90}%</strong></span>
                          </div>
                          <div className="weight-row">
                            <span>Shelf-Life (20%): <strong>{result.shelflife_days ? `${result.shelflife_days}d` : "7d"}</strong></span>
                            <span>Age (15%): <strong>{result.age_score ?? 80}%</strong></span>
                          </div>
                        </div>

                        {/* Freshness Trend Chart */}
                        {itemTrend.length > 0 && (
                          <div style={{ marginTop: "20px", padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                            <h4>📉 Freshness Trend ({itemTrend.length} scan{itemTrend.length > 1 ? "s" : ""})</h4>
                            <div style={{ display: "flex", alignItems: "flex-end", height: "80px", gap: "4px", marginTop: "10px" }}>
                              {itemTrend.map((t, idx) => (
                                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                                  <div
                                    title={`${t.quality_score}% - ${new Date(t.created_at).toLocaleDateString()}`}
                                    style={{
                                      width: "100%",
                                      backgroundColor: t.quality_score > 80 ? "#10b981" : t.quality_score > 50 ? "#f59e0b" : "#ef4444",
                                      height: `${t.quality_score}%`,
                                      borderRadius: "3px 3px 0 0",
                                      transition: "height 0.3s ease",
                                    }}
                                  />
                                  <span style={{ fontSize: "0.55rem", marginTop: "3px", color: "#94a3b8" }}>
                                    {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Storage Log Button (non-consumer roles only) */}
                        {user?.role !== "consumer" && (
                          <button
                            className="outline-btn"
                            style={{ marginTop: "15px", width: "100%" }}
                            onClick={() => { setShowStorageLogId(item.id); fetchStorageLogs(item.id); }}
                          >
                            🌡️ Log & View Storage Conditions
                          </button>
                        )}

                        {/* AI Recommendations */}
                        {recs[item.id] && (
                          <div className="recommendations-box">
                            <h4 className="recs-title">💡 AI Recommendations</h4>
                            <ul className="recs-list">
                              {recs[item.id].storage?.map((r, i) => <li key={`s-${i}`}>🌡️ {r}</li>)}
                              {recs[item.id].consumption?.map((r, i) => <li key={`c-${i}`}>🍽️ {r}</li>)}
                              {recs[item.id].inventory?.map((r, i) => <li key={`i-${i}`}>📦 {r}</li>)}
                              {recs[item.id].waste_reduction?.map((r, i) => <li key={`w-${i}`}>♻️ {r}</li>)}
                              {recs[item.id].quality?.map((r, i) => <li key={`q-${i}`}>✨ {r}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* PDF Report Button */}
                        <button className="pdf-report-trigger-btn" onClick={() => { setPdfReportItem(item); setPdfReportResult(result); }}>
                          📄 View Single-Page Executive PDF Report
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Storage Log Modal ── */}
      {showStorageLogId && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowStorageLogId(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "620px" }}>
            <div className="modal-header">
              <h2>🌡️ Storage Logs — Item #{showStorageLogId}</h2>
              <button className="close-btn" onClick={() => setShowStorageLogId(null)}>✕</button>
            </div>
            <form onSubmit={(e) => handleSaveStorage(e, showStorageLogId)} style={{ marginBottom: "20px", padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
              <h4>Add New Log Entry</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <input type="number" step="0.1" placeholder="Temperature °C" value={newStorageTemp} onChange={(e) => setNewStorageTemp(e.target.value)} required />
                <input type="number" step="0.1" placeholder="Humidity %" value={newStorageHumidity} onChange={(e) => setNewStorageHumidity(e.target.value)} required />
                <select value={newStorageAir} onChange={(e) => setNewStorageAir(e.target.value)}>
                  <option value="Good">Air Circulation: Good</option>
                  <option value="Poor">Air Circulation: Poor</option>
                </select>
                <select value={newStorageLight} onChange={(e) => setNewStorageLight(e.target.value)}>
                  <option value="Low">Light Exposure: Low</option>
                  <option value="High">Light Exposure: High</option>
                </select>
              </div>
              <button type="submit" className="primary-btn" style={{ marginTop: "10px" }}>💾 Save Log Entry</button>
            </form>
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <h4>History</h4>
              {storageLogs.length === 0
                ? <p style={{ color: "#94a3b8" }}>No logs yet. Add your first entry above.</p>
                : (
                  <table className="inventory-table">
                    <thead><tr><th>Date</th><th>Temp (°C)</th><th>Humidity</th><th>Air</th><th>Light</th></tr></thead>
                    <tbody>
                      {storageLogs.map((l) => (
                        <tr key={l.id}>
                          <td>{new Date(l.recorded_at).toLocaleString()}</td>
                          <td>{l.temperature}°C</td>
                          <td>{l.humidity}%</td>
                          <td>{l.air_circulation}</td>
                          <td>{l.light_exposure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics & Reports Modal ── */}
      {showReports && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowReports(false)}>
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>📊 Freshness Analytics & Historical Scan Log</h2>
              <button className="close-btn" onClick={() => setShowReports(false)}>✕</button>
            </div>

            <div className="filter-bar" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px", alignItems: "center" }}>
              <button className="nav-btn accent-btn" onClick={handleExcelExport}>📥 Export to Excel</button>
              <input placeholder="Search by Item ID or Label..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
            </div>

            {/* Report Tabs */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              {["All", "Waste", "Compliance", "Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"].map((f) => (
                <button
                  key={f}
                  className={`outline-btn ${reportRatingFilter === f ? "active" : ""}`}
                  style={{ opacity: reportRatingFilter === f ? 1 : 0.6, fontWeight: reportRatingFilter === f ? "bold" : "normal" }}
                  onClick={() => setReportRatingFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="reports-list">
              {filteredReports.length === 0 ? (
                <p className="no-reports">No matching freshness reports found.</p>
              ) : (
                filteredReports.map((r) => (
                  <div key={r.id} className="report-row">
                    <div className="report-row-left">
                      <span className="rating-badge" style={{ background: categoryColor(r.category) }}>{r.category}</span>
                      <div>
                        <strong>Food Item #{r.food_item_id}</strong>
                        <div className="small-text">Visual: {r.visual_score ?? 100}% | Storage: {r.storage_score ?? 90}% | Risk: {r.risk_level || "N/A"}</div>
                      </div>
                    </div>
                    <div className="report-row-right">
                      <span className="report-score">{r.quality_score}/100</span>
                      <span className="small-text">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Report Modal ── */}
      {pdfReportItem && pdfReportResult && (
        <div className="modal-backdrop">
          <div className="modal-content pdf-report-modal printable-area">
            <div className="print-no-display modal-header">
              <h2>📄 Single-Page Executive Quality Report</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="nav-btn accent-btn" onClick={() => window.print()}>📥 Download PDF / Print</button>
                <button className="close-btn" onClick={() => { setPdfReportItem(null); setPdfReportResult(null); }}>✕</button>
              </div>
            </div>

            <div className="pdf-sheet">
              <div className="pdf-header">
                <div className="pdf-branding">
                  <div className="pdf-logo">🥑</div>
                  <div>
                    <h1>AI FOOD FRESHNESS MONITORING PLATFORM</h1>
                    <p>Official Single-Page Inspection Certificate & Quality Audit Report</p>
                  </div>
                </div>
                <div className="pdf-doc-meta">
                  <span>Doc ID: <strong>FFM-RPT-{pdfReportResult.id}</strong></span>
                  <span>Issued: <strong>{new Date(pdfReportResult.created_at).toLocaleDateString()}</strong></span>
                </div>
              </div>

              <div className="pdf-grid-body">
                <div className="pdf-col-left">
                  <div className="pdf-img-frame">
                    <img
                      src={previewImage[pdfReportItem.id]?.url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400"}
                      alt={pdfReportItem.name}
                      className="pdf-item-img"
                    />
                  </div>
                  <div className="pdf-info-box">
                    <h2 className="pdf-item-title">{pdfReportItem.name}</h2>
                    <div className="pdf-meta-row"><span>Category:</span> <strong>{pdfReportItem.category}</strong></div>
                    <div className="pdf-meta-row"><span>Quantity:</span> <strong>{pdfReportItem.quantity} units</strong></div>
                    {pdfReportItem.batch_number && <div className="pdf-meta-row"><span>Batch #:</span> <strong>{pdfReportItem.batch_number}</strong></div>}
                    {pdfReportItem.expiry_date && <div className="pdf-meta-row"><span>Expiry Date:</span> <strong>{pdfReportItem.expiry_date}</strong></div>}
                    {pdfReportItem.storage_temp != null && <div className="pdf-meta-row"><span>Storage Temp:</span> <strong>{pdfReportItem.storage_temp} °C</strong></div>}
                    {pdfReportItem.humidity != null && <div className="pdf-meta-row"><span>Humidity:</span> <strong>{pdfReportItem.humidity}%</strong></div>}
                    {pdfReportItem.packaging_type && <div className="pdf-meta-row"><span>Packaging:</span> <strong>{pdfReportItem.packaging_type}</strong></div>}
                  </div>
                </div>

                <div className="pdf-col-right">
                  <div className="pdf-score-banner" style={{ borderColor: categoryColor(pdfReportResult.category) }}>
                    <div>
                      <span className="pdf-score-title">Final Section 4.7 Freshness Rating</span>
                      <h1 className="pdf-score-huge" style={{ color: categoryColor(pdfReportResult.category) }}>
                        {pdfReportResult.quality_score} <span className="pdf-small-max">/ 100</span>
                      </h1>
                    </div>
                    <span className="pdf-rating-stamp" style={{ background: categoryColor(pdfReportResult.category) }}>
                      {pdfReportResult.category.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ marginTop: "12px", padding: "8px 12px", background: pdfReportResult.risk_level === "High Risk" ? "#fee2e2" : "#dcfce7", color: pdfReportResult.risk_level === "High Risk" ? "#991b1b" : "#166534", borderRadius: "6px", fontWeight: "bold" }}>
                    ⚠️ Risk Level: {pdfReportResult.risk_level || "Low Risk"}
                  </div>

                  <h3 className="pdf-sub-heading">🔬 Computer Vision Feature Extraction</h3>
                  <table className="pdf-table">
                    <thead><tr><th>CV Indicator</th><th>Analysis</th><th>Score</th></tr></thead>
                    <tbody>
                      <tr><td>Color Degradation</td><td>Discoloration & Brownness</td><td><strong>{pdfReportResult.color_score ?? 100}%</strong></td></tr>
                      <tr><td>Mold Growth</td><td>Fungal Spot Anomaly</td><td><strong>{pdfReportResult.mold_score ?? 100}%</strong></td></tr>
                      <tr><td>Surface Bruising</td><td>Contour & Texture Variance</td><td><strong>{pdfReportResult.bruising_score ?? 100}%</strong></td></tr>
                      <tr><td>CNN Confidence</td><td>MobileNetV2 Classifier</td><td><strong>{(pdfReportResult.confidence * 100).toFixed(1)}%</strong></td></tr>
                    </tbody>
                  </table>

                  <h3 className="pdf-sub-heading">⚖️ Section 4.7 Weighted Scoring Breakdown</h3>
                  <div className="pdf-weights-grid">
                    <div className="pdf-weight-card"><span className="weight-label">Visual Condition (40%)</span><strong className="weight-score">{pdfReportResult.visual_score ?? 100}%</strong></div>
                    <div className="pdf-weight-card"><span className="weight-label">Storage Compliance (25%)</span><strong className="weight-score">{pdfReportResult.storage_score ?? 90}%</strong></div>
                    <div className="pdf-weight-card"><span className="weight-label">Shelf-Life Prediction (20%)</span><strong className="weight-score">{pdfReportResult.shelflife_days ?? 7} Days</strong></div>
                    <div className="pdf-weight-card"><span className="weight-label">Product Age (15%)</span><strong className="weight-score">{pdfReportResult.age_score ?? 80}%</strong></div>
                  </div>

                  <div className="pdf-recommendation">
                    <strong>💡 Recommendation:</strong>
                    <p>
                      {pdfReportResult.category === "Fresh" || pdfReportResult.category === "Good"
                        ? "Product is in optimal condition. Maintain cold chain and rotate via FIFO."
                        : "Product shows signs of decay. Consume immediately or mark down for urgent sale."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pdf-footer">
                <div className="pdf-sign-box">
                  <div className="sign-line">Inspector / System Sign-off</div>
                  <span>Verified by AI Quality Engine v2.0</span>
                </div>
                <div className="pdf-watermark">FOOD FRESHNESS MONITORING PLATFORM CERTIFIED</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

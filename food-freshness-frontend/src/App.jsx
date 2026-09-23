import { useState, useEffect } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

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

function App() {
  const [view, setView] = useState("login");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");

  // Reg & Login states
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("consumer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Food & Summary state
  const [foodItems, setFoodItems] = useState([]);
  const [summary, setSummary] = useState(null);

  // New item form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Fruits");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newExpiry, setNewExpiry] = useState("");
  const [newBatch, setNewBatch] = useState("");
  const [newTemp, setNewTemp] = useState("");

  // Edit item form
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Fruits");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editExpiry, setEditExpiry] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editTemp, setEditTemp] = useState("");

  // Analysis, Preview & Trend states
  const [analyzingId, setAnalyzingId] = useState(null);
  const [previewImage, setPreviewImage] = useState({});
  const [results, setResults] = useState({});
  const [trends, setTrends] = useState({});
  const [activeTrendId, setActiveTrendId] = useState(null);
  const [recs, setRecs] = useState({});

  // Single-Page PDF Report Modal state
  const [pdfReportItem, setPdfReportItem] = useState(null);
  const [pdfReportResult, setPdfReportResult] = useState(null);

  // Analytics Reports Modal state
  const [reports, setReports] = useState([]);
  const [showReports, setShowReports] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportRatingFilter, setReportRatingFilter] = useState("All");

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (token) {
      fetchUser();
      fetchFoodItems();
      fetchSummary();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API}/me`, { headers: authHeader });
      if (res.ok) setUser(await res.json());
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  };

  const fetchFoodItems = async () => {
    try {
      const res = await fetch(`${API}/food`, { headers: authHeader });
      if (res.ok) setFoodItems(await res.json());
    } catch (e) {
      console.error("Failed to fetch items", e);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API}/freshness-summary`, { headers: authHeader });
      if (res.ok) setSummary(await res.json());
    } catch (e) {
      console.error("Failed to fetch summary", e);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
        }),
      });
      if (res.ok) {
        setView("login");
        setEmail(regEmail);
        setRegName("");
        setRegEmail("");
        setRegPassword("");
        setRegRole("consumer");
      } else {
        const data = await res.json();
        setAuthError(data.detail || "Registration failed");
      }
    } catch (e) {
      setAuthError("Network error during registration");
    }
  };

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
        setUser(data.user);
        setView("dashboard");
      } else {
        setAuthError("Invalid email or password");
      }
    } catch (e) {
      setAuthError("Network error during login");
    }
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    if (!newName) return;
    try {
      const res = await fetch(`${API}/food`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          name: newName,
          category: newCategory,
          quantity: Number(newQuantity),
          expiry_date: newExpiry || null,
          batch_number: newBatch || null,
          storage_temp: newTemp ? Number(newTemp) : null,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewCategory("Fruits");
        setNewQuantity(1);
        setNewExpiry("");
        setNewBatch("");
        setNewTemp("");
        fetchFoodItems();
        fetchSummary();
      } else {
        const err = await res.json();
        alert(`Failed to add item: ${err.detail || JSON.stringify(err)}`);
      }
    } catch (e) {
      alert("Network error while adding food item.");
    }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`${API}/food/${id}`, { method: "DELETE", headers: authHeader });
    if (res.ok) {
      fetchFoodItems();
      fetchSummary();
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category || "Fruits");
    setEditQuantity(item.quantity);
    setEditExpiry(item.expiry_date || "");
    setEditBatch(item.batch_number || "");
    setEditTemp(item.storage_temp ?? "");
  };

  const saveEdit = async (id) => {
    const res = await fetch(`${API}/food/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        name: editName,
        category: editCategory,
        quantity: Number(editQuantity),
        expiry_date: editExpiry || null,
        batch_number: editBatch || null,
        storage_temp: editTemp ? Number(editTemp) : null,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchFoodItems();
      fetchSummary();
    }
  };

  const handleFileChange = (foodId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage((prev) => ({ ...prev, [foodId]: { file, url: reader.result } }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (foodId) => {
    const preview = previewImage[foodId];
    if (!preview || !preview.file) return;
    setAnalyzingId(foodId);

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
      }
    } catch (e) {
      alert("Analysis failed. Make sure backend is running.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const fetchTrend = async (foodId) => {
    try {
      const res = await fetch(`${API}/food/${foodId}/trend`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setTrends((prev) => ({ ...prev, [foodId]: data }));
      }
    } catch (e) {
      console.error("Failed to fetch trend", e);
    }
  };

  const fetchRecommendations = async (foodId) => {
    try {
      const res = await fetch(`${API}/food/${foodId}/recommendations`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setRecs((prev) => ({ ...prev, [foodId]: data }));
      }
    } catch (e) {
      console.error("Failed to fetch recommendations", e);
    }
  };

  const fetchReports = async () => {
    const res = await fetch(`${API}/freshness-reports`, { headers: authHeader });
    if (res.ok) {
      setReports(await res.json());
      setShowReports(true);
    }
  };

  const openPdfReportModal = (item, result) => {
    setPdfReportItem(item);
    setPdfReportResult(result);
  };

  const triggerPrint = () => {
    window.print();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFoodItems([]);
    setResults({});
    setPreviewImage({});
    setShowReports(false);
    setView("login");
  };

  // Utilities
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

  // Auth Screen
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
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="primary-btn">
                  Sign In →
                </button>
              </form>
              {authError && <p className="error">{authError}</p>}
              <p className="switch">
                Don't have an account?{" "}
                <span onClick={() => { setView("register"); setAuthError(""); }}>Create Account</span>
              </p>
            </>
          ) : (
            <>
              <h2>Create Account</h2>
              <form onSubmit={handleRegister}>
                <div className="input-group">
                  <input
                    placeholder="Full Name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Select Platform Role</label>
                  <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className="role-select">
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="primary-btn">
                  Register Account →
                </button>
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

  const filteredReports = reports.filter((r) => {
    const matchesSearch = reportSearch === "" || r.food_item_id.toString().includes(reportSearch) || r.label.toLowerCase().includes(reportSearch.toLowerCase());
    const matchesRating = reportRatingFilter === "All" || r.category === reportRatingFilter;
    return matchesSearch && matchesRating;
  });

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header-glass">
        <div className="header-left">
          <div className="app-logo">🥑</div>
          <div>
            <h1>Food Freshness Engine</h1>
            <div className="user-welcome">
              <span>Welcome, <strong>{user?.name || "User"}</strong></span>
              <span className="role-badge" title="Role-Based Access Level">
                {roleObj.icon} {roleObj.label}
              </span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button className="nav-btn accent-btn" onClick={fetchReports}>
            📊 Analytics & Reports
          </button>
          <button className="nav-btn outline-btn" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      {/* Summary Banner */}
      {summary && (
        <div className="summary-banner">
          <div className="summary-card">
            <span className="summary-icon">📦</span>
            <div>
              <span className="summary-value">{summary.total_items}</span>
              <span className="summary-label">Total Items</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🔬</span>
            <div>
              <span className="summary-value">{summary.total_analyzed}</span>
              <span className="summary-label">AI Scans Run</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🌟</span>
            <div>
              <span className="summary-value">{summary.avg_quality_score}%</span>
              <span className="summary-label">Avg Quality</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🥬</span>
            <div>
              <span className="summary-value" style={{ color: "#10b981" }}>{summary.fresh_count}</span>
              <span className="summary-label">Fresh Detected</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">⚠️</span>
            <div>
              <span className="summary-value" style={{ color: "#ef4444" }}>{summary.spoiled_count}</span>
              <span className="summary-label">Spoiled Detected</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Form */}
      <div className="card-panel add-panel">
        <h3 className="section-title">+ Register Food Inventory Item</h3>
        <form className="add-form" onSubmit={handleAddFood}>
          <div className="form-grid">
            <input
              placeholder="Item Name (e.g. Organic Apples)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
            />
            <input
              type="date"
              placeholder="Expiry Date"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
            <input
              placeholder="Batch # (Optional)"
              value={newBatch}
              onChange={(e) => setNewBatch(e.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Storage Temp °C"
              value={newTemp}
              onChange={(e) => setNewTemp(e.target.value)}
            />
          </div>
          <button type="submit" className="add-submit-btn">
            + Add to Inventory
          </button>
        </form>
      </div>

      {/* Active Inventory Grid */}
      <h3 className="section-title">Active Inventory ({foodItems.length})</h3>
      <div className="food-grid">
        {foodItems.length === 0 && (
          <div className="empty-state">
            <p>🍏 No food items in your inventory yet. Add one above to get started!</p>
          </div>
        )}

        {foodItems.map((item) => {
          const result = results[item.id];
          const preview = previewImage[item.id];
          const itemTrend = trends[item.id] || [];
          const isEditing = editingId === item.id;
          const expiryStatus = getExpiryStatus(item.expiry_date);
          const isProduce = isProduceCategory(item.category);

          return (
            <div className="food-card glass-card" key={item.id}>
              {isEditing ? (
                <div className="edit-form">
                  <h4>Edit Item #{item.id}</h4>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item Name" />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} placeholder="Qty" />
                  <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
                  <input value={editBatch} onChange={(e) => setEditBatch(e.target.value)} placeholder="Batch #" />
                  <input type="number" step="0.1" value={editTemp} onChange={(e) => setEditTemp(e.target.value)} placeholder="Temp °C" />
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
                      <button className="icon-btn" onClick={() => startEdit(item)} title="Edit Item">✎</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(item.id)} title="Delete Item">✕</button>
                    </div>
                  </div>

                  <div className="item-details">
                    <div className="detail-row">
                      <span>Quantity: <strong>{item.quantity}</strong></span>
                      {item.storage_temp !== null && item.storage_temp !== undefined && (
                        <span>Temp: <strong>{item.storage_temp}°C</strong></span>
                      )}
                    </div>

                    {item.batch_number && (
                      <div className="batch-tag">🏷️ Batch: {item.batch_number}</div>
                    )}

                    {expiryStatus && (
                      <div className="expiry-badge" style={{ color: expiryStatus.color, background: expiryStatus.bg }}>
                        ⏱️ {expiryStatus.label}
                      </div>
                    )}
                  </div>

                  {/* AI & Computer Vision Analysis Box */}
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
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleFileChange(item.id, e.target.files[0])}
                          />
                        </label>
                      )}

                      {preview?.url && (
                        <button
                          className="analyze-trigger-btn"
                          onClick={() => handleAnalyze(item.id)}
                          disabled={analyzingId === item.id}
                        >
                          {analyzingId === item.id ? "Analyzing Image & CV Features..." : "⚡ Run Section 4.7 AI Scan"}
                        </button>
                      )}
                    </div>

                    {result && (
                      <div className="result-card" style={{ borderColor: categoryColor(result.category) }}>
                        <div className="result-header">
                          <span className="rating-badge" style={{ background: categoryColor(result.category) }}>
                            {result.category}
                          </span>
                          <span className="score-num">{result.quality_score} / 100</span>
                        </div>
                        
                        <div className="progress-bar-container">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${result.quality_score}%`,
                              background: categoryColor(result.category),
                            }}
                          />
                        </div>

                        {/* Computer Vision Sub-Feature Indicators */}
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

                        {/* Recommendations Engine */}
                        {recs[item.id] && (
                          <div className="recommendations-box">
                            <h4 className="recs-title">💡 AI Recommendations</h4>
                            <ul className="recs-list">
                              {recs[item.id].storage.map((r, i) => <li key={`s-${i}`}>🌡️ {r}</li>)}
                              {recs[item.id].consumption.map((r, i) => <li key={`c-${i}`}>🍽️ {r}</li>)}
                              {recs[item.id].inventory.map((r, i) => <li key={`i-${i}`}>📦 {r}</li>)}
                              {recs[item.id].waste_reduction.map((r, i) => <li key={`w-${i}`}>♻️ {r}</li>)}
                              {recs[item.id].quality.map((r, i) => <li key={`q-${i}`}>✨ {r}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Executive Report Modal Button */}
                        <button
                          className="pdf-report-trigger-btn"
                          onClick={() => openPdfReportModal(item, result)}
                        >
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

      {/* Analytics Reports Modal */}
      {showReports && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>📊 Freshness Analytics & Historical Scan Log</h2>
              <button className="close-btn" onClick={() => setShowReports(false)}>✕</button>
            </div>

            <div className="filter-bar">
              <input
                placeholder="Search reports by Item ID or Label..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
              />
              <select value={reportRatingFilter} onChange={(e) => setReportRatingFilter(e.target.value)}>
                <option value="All">All Quality Ratings</option>
                <option value="Fresh">Fresh</option>
                <option value="Good">Good</option>
                <option value="Acceptable">Acceptable</option>
                <option value="Near Spoilage">Near Spoilage</option>
                <option value="Spoiled">Spoiled</option>
              </select>
            </div>

            <div className="reports-list">
              {filteredReports.length === 0 ? (
                <p className="no-reports">No matching freshness report records found.</p>
              ) : (
                filteredReports.map((r) => (
                  <div key={r.id} className="report-row">
                    <div className="report-row-left">
                      <span className="rating-badge" style={{ background: categoryColor(r.category) }}>
                        {r.category}
                      </span>
                      <div>
                        <strong>Food Item #{r.food_item_id}</strong>
                        <div className="small-text">Visual: {r.visual_score ?? 100}% | Temp Score: {r.storage_score ?? 90}%</div>
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

      {/* Single-Page Executive PDF & Printable Report Modal */}
      {pdfReportItem && pdfReportResult && (
        <div className="modal-backdrop">
          <div className="modal-content pdf-report-modal printable-area">
            <div className="print-no-display modal-header">
              <h2>📄 Single-Page Executive Quality Report Preview</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="nav-btn accent-btn" onClick={triggerPrint}>
                  📥 Download PDF / Print Report
                </button>
                <button className="close-btn" onClick={() => { setPdfReportItem(null); setPdfReportResult(null); }}>✕</button>
              </div>
            </div>

            {/* Official Single-Page Report Layout */}
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
                  <span>Doc ID: <strong>FFM-RPT-#{pdfReportResult.id}</strong></span>
                  <span>Issued Date: <strong>{new Date(pdfReportResult.created_at).toLocaleDateString()}</strong></span>
                </div>
              </div>

              <div className="pdf-grid-body">
                {/* Left Column: Image & Item Metadata */}
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
                    <div className="pdf-meta-row">
                      <span>Category:</span> <strong>{pdfReportItem.category}</strong>
                    </div>
                    <div className="pdf-meta-row">
                      <span>Quantity:</span> <strong>{pdfReportItem.quantity} units</strong>
                    </div>
                    {pdfReportItem.batch_number && (
                      <div className="pdf-meta-row">
                        <span>Batch #:</span> <strong>{pdfReportItem.batch_number}</strong>
                      </div>
                    )}
                    {pdfReportItem.expiry_date && (
                      <div className="pdf-meta-row">
                        <span>Expiry Date:</span> <strong>{pdfReportItem.expiry_date}</strong>
                      </div>
                    )}
                    {pdfReportItem.storage_temp !== null && pdfReportItem.storage_temp !== undefined && (
                      <div className="pdf-meta-row">
                        <span>Storage Temp:</span> <strong>{pdfReportItem.storage_temp} °C</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Section 4.7 Weighted Model & CV Sub-features */}
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

                  {/* Computer Vision Sub-Features Table */}
                  <h3 className="pdf-sub-heading">🔬 Computer Vision Feature Extraction Breakdown</h3>
                  <table className="pdf-table">
                    <thead>
                      <tr>
                        <th>CV Indicator</th>
                        <th>Status</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Color Degradation Index</td>
                        <td>Discoloration & Brownness Check</td>
                        <td><strong>{pdfReportResult.color_score ?? 100}%</strong></td>
                      </tr>
                      <tr>
                        <td>Mold Growth Likelihood</td>
                        <td>Fungal Spot Anomaly Scan</td>
                        <td><strong>{pdfReportResult.mold_score ?? 100}%</strong></td>
                      </tr>
                      <tr>
                        <td>Surface Bruising Anomaly</td>
                        <td>Contour & Texture Variance</td>
                        <td><strong>{pdfReportResult.bruising_score ?? 100}%</strong></td>
                      </tr>
                      <tr>
                        <td>CNN AI Model Confidence</td>
                        <td>MobileNetV2 Classifier</td>
                        <td><strong>{(pdfReportResult.confidence * 100).toFixed(1)}%</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Section 4.7 4-Part Weighted Scoring Model */}
                  <h3 className="pdf-sub-heading">⚖️ Section 4.7 Weighted Scoring Model Breakdown</h3>
                  <div className="pdf-weights-grid">
                    <div className="pdf-weight-card">
                      <span className="weight-label">Visual Condition (40%)</span>
                      <strong className="weight-score">{pdfReportResult.visual_score ?? 100}%</strong>
                    </div>
                    <div className="pdf-weight-card">
                      <span className="weight-label">Storage Compliance (25%)</span>
                      <strong className="weight-score">{pdfReportResult.storage_score ?? 90}%</strong>
                    </div>
                    <div className="pdf-weight-card">
                      <span className="weight-label">Shelf-Life Prediction (20%)</span>
                      <strong className="weight-score">{pdfReportResult.shelflife_days ?? 7} Days</strong>
                    </div>
                    <div className="pdf-weight-card">
                      <span className="weight-label">Product Age (15%)</span>
                      <strong className="weight-score">{pdfReportResult.age_score ?? 80}%</strong>
                    </div>
                  </div>

                  <div className="pdf-recommendation">
                    <strong>💡 Storage & Quality Recommendation:</strong>
                    <p>
                      {pdfReportResult.category === "Fresh" || pdfReportResult.category === "Good"
                        ? "Product is in optimal condition. Maintain cold chain storage and rotate inventory according to FIFO standard."
                        : "Product shows signs of decay/near spoilage. Consume immediately or mark down for quick sale."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Official Signoff Footer */}
              <div className="pdf-footer">
                <div className="pdf-sign-box">
                  <div className="sign-line">Inspector / System Sign-off</div>
                  <span>Verified by AI Quality Engine</span>
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
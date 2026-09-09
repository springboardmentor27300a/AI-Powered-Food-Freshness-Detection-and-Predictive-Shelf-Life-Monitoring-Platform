import { useState, useEffect } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [view, setView] = useState("login");
  const [token, setToken] = useState(null);
  const [authError, setAuthError] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [foodItems, setFoodItems] = useState([]);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newExpiry, setNewExpiry] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editExpiry, setEditExpiry] = useState("");

  const [analyzing, setAnalyzing] = useState(null);
  const [results, setResults] = useState({});

  const [reports, setReports] = useState([]);
  const [showReports, setShowReports] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
    });
    if (res.ok) {
      setView("login");
      setEmail(regEmail);
      setRegName("");
      setRegEmail("");
      setRegPassword("");
    } else {
      const data = await res.json();
      setAuthError(data.detail || "Registration failed");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.access_token);
      setView("dashboard");
    } else {
      setAuthError("Invalid email or password");
    }
  };

  const fetchFoodItems = async () => {
    const res = await fetch(`${API}/food`, { headers: authHeader });
    if (res.ok) setFoodItems(await res.json());
  };

  useEffect(() => {
    if (token) fetchFoodItems();
  }, [token]);

  const handleAddFood = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/food`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        name: newName,
        category: newCategory,
        quantity: Number(newQuantity),
        expiry_date: newExpiry || null,
      }),
    });
    if (res.ok) {
      setNewName("");
      setNewCategory("");
      setNewQuantity(1);
      setNewExpiry("");
      fetchFoodItems();
    }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`${API}/food/${id}`, { method: "DELETE", headers: authHeader });
    if (res.ok) {
      fetchFoodItems();
    } else {
      alert("Failed to delete — you may need to log in again.");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditQuantity(item.quantity);
    setEditExpiry(item.expiry_date || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
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
      }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchFoodItems();
    } else {
      alert("Failed to update — you may need to log in again.");
    }
  };

  const handleAnalyze = async (foodId, file) => {
    if (!file) return;
    setAnalyzing(foodId);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/analyze-freshness?food_item_id=${foodId}`, {
      method: "POST",
      headers: authHeader,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setResults((prev) => ({ ...prev, [foodId]: data }));
    }
    setAnalyzing(null);
  };

  const fetchReports = async () => {
    const res = await fetch(`${API}/freshness-reports`, { headers: authHeader });
    if (res.ok) {
      setReports(await res.json());
      setShowReports(true);
    }
  };

  const categoryColor = (category) => {
    switch (category) {
      case "Fresh": return "#2e7d32";
      case "Good": return "#66bb6a";
      case "Acceptable": return "#fbc02d";
      case "Near Spoilage": return "#fb8c00";
      case "Spoiled": return "#e53935";
      default: return "#999";
    }
  };

  const logout = () => {
    setToken(null);
    setFoodItems([]);
    setResults({});
    setShowReports(false);
    setView("login");
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>🥑 Food Freshness</h1>
          {view === "login" ? (
            <>
              <h2>Log In</h2>
              <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">Log In</button>
              </form>
              {authError && <p className="error">{authError}</p>}
              <p className="switch">
                Don't have an account?{" "}
                <span onClick={() => { setView("register"); setAuthError(""); }}>Register</span>
              </p>
            </>
          ) : (
            <>
              <h2>Register</h2>
              <form onSubmit={handleRegister}>
                <input placeholder="Name" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                <input type="email" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                <input type="password" placeholder="Password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                <button type="submit">Create Account</button>
              </form>
              {authError && <p className="error">{authError}</p>}
              <p className="switch">
                Already have an account?{" "}
                <span onClick={() => { setView("login"); setAuthError(""); }}>Log In</span>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <h1>🥑 Your Food Inventory</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="logout-btn" onClick={fetchReports}>📊 Reports</button>
          <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>
      </header>

      {showReports && (
        <div className="food-card" style={{ marginBottom: "24px" }}>
          <div className="food-card-top">
            <h3>Freshness Reports</h3>
            <button className="icon-btn" onClick={() => setShowReports(false)}>✕</button>
          </div>
          {reports.length === 0 && <p className="meta">No analyses yet.</p>}
          {reports.map((r) => (
            <div key={r.id} className="result" style={{ borderColor: categoryColor(r.category), marginTop: "10px" }}>
              <span className="badge" style={{ background: categoryColor(r.category) }}>
                {r.category}
              </span>
              <p>Item #{r.food_item_id} — Score: {r.quality_score}/100</p>
              <p className="small">
                {r.label} ({(r.confidence * 100).toFixed(1)}% confidence) · {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <form className="add-form" onSubmit={handleAddFood}>
        <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
        <input placeholder="Category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required />
        <input type="number" min="1" placeholder="Qty" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
        <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
        <button type="submit">+ Add Item</button>
      </form>

      <div className="food-grid">
        {foodItems.length === 0 && <p className="empty">No food items yet. Add one above.</p>}
        {foodItems.map((item) => {
          const result = results[item.id];
          const isEditing = editingId === item.id;

          return (
            <div className="food-card" key={item.id}>
              {isEditing ? (
                <div className="edit-form">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                  <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Category" />
                  <input type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} placeholder="Qty" />
                  <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveEdit(item.id)}>Save</button>
                    <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="food-card-top">
                    <h3>{item.name}</h3>
                    <div className="card-actions">
                      <button className="icon-btn" onClick={() => startEdit(item)} title="Edit">✎</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(item.id)} title="Delete">✕</button>
                    </div>
                  </div>
                  <p className="meta">{item.category} · Qty {item.quantity}</p>
                  <p className="meta">Expires: {item.expiry_date || "N/A"}</p>

                  <label className="upload-btn">
                    {analyzing === item.id ? "Analyzing..." : "📷 Analyze Freshness"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleAnalyze(item.id, e.target.files[0])}
                    />
                  </label>

                  {result && (
                    <div className="result" style={{ borderColor: categoryColor(result.category) }}>
                      <span className="badge" style={{ background: categoryColor(result.category) }}>
                        {result.category}
                      </span>
                      <p>Score: {result.quality_score}/100</p>
                      <p className="small">
                        {result.label} ({(result.confidence * 100).toFixed(1)}% confidence)
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
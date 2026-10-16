import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import "./Recommendations.css";

function Recommendations({ user, onBack, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [priority, setPriority] = useState("All");
  const [search, setSearch] = useState("");

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/recommendations");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || `Unable to load recommendations (${response.status}).`
        );
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err.message || "Unable to load recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const visibleItems = items.filter((item) => {
    const matchesPriority =
      priority === "All" || item.priority === priority;

    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      String(item.food_name || "").toLowerCase().includes(query) ||
      String(item.batch_number || "").toLowerCase().includes(query) ||
      String(item.category || "").toLowerCase().includes(query);

    return matchesPriority && matchesSearch;
  });

  const criticalCount = items.filter(
    (item) => item.priority === "Critical"
  ).length;

  const highCount = items.filter(
    (item) => item.priority === "High"
  ).length;

  const attentionCount = items.filter(
    (item) =>
      item.priority === "Critical" || item.priority === "High"
  ).length;

  const priorityClass = (value) => {
    switch (String(value || "").toLowerCase()) {
      case "critical":
        return "recommendation-priority critical";
      case "high":
        return "recommendation-priority high";
      case "medium":
        return "recommendation-priority medium";
      default:
        return "recommendation-priority low";
    }
  };

  const formatDate = (value) => {
    if (!value) return "Not recorded";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="dashboard-page recommendations-page">
      <header className="dashboard-navbar">
        <div className="dashboard-brand">
          <div className="brand-icon">🍎</div>
          <div>
            <h2>FoodFresh</h2>
            <span>Food Freshness Monitoring</span>
          </div>
        </div>

        <div className="dashboard-user">
          <div style={{ textAlign: "right" }}>
            <strong>{user?.name || "User"}</strong>
            <span className="user-role" style={{ display: "block" }}>
              {user?.role}
            </span>
          </div>

          <button className="back-button" onClick={onBack}>
            ← Dashboard
          </button>

          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="recommendations-heading">
          <span className="section-label">SMART INVENTORY DECISIONS</span>
          <h1>Food Recommendations</h1>
          <p>
            Review food batches that need attention and prioritize actions
            using their recorded expiry dates and inventory information.
          </p>
        </section>

        {error && (
          <div className="recommendations-error" role="alert">
            <strong>Unable to load recommendations</strong>
            <p>{error}</p>
            {error.toLowerCase().includes("auth") && (
              <p>Your session may have expired. Log in again and retry.</p>
            )}
            <button
              className="secondary-btn"
              onClick={loadRecommendations}
            >
              Try again
            </button>
          </div>
        )}

        <section className="recommendations-summary">
          <article className="recommendation-stat">
            <span>📦</span>
            <p>Total Batches</p>
            <strong>{items.length}</strong>
          </article>

          <article className="recommendation-stat">
            <span>🚨</span>
            <p>Critical Priority</p>
            <strong>{criticalCount}</strong>
          </article>

          <article className="recommendation-stat">
            <span>⚠️</span>
            <p>High Priority</p>
            <strong>{highCount}</strong>
          </article>

          <article className="recommendation-stat">
            <span>🔎</span>
            <p>Needs Attention</p>
            <strong>{attentionCount}</strong>
          </article>
        </section>

        <section className="recommendations-panel">
          <div className="recommendations-toolbar">
            <div>
              <h2>Recommended Actions</h2>
              <p>Prioritize critical batches first.</p>
            </div>

            <button
              className="secondary-btn"
              onClick={loadRecommendations}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          <div className="recommendations-filters">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search food, category or batch..."
              aria-label="Search recommendations"
            />

            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="All">All priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {loading ? (
            <div className="recommendations-empty">
              <span>🔄</span>
              <h3>Loading recommendations...</h3>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="recommendations-empty">
              <span>{items.length ? "🔍" : "🌿"}</span>
              <h3>
                {items.length
                  ? "No matching recommendations"
                  : "No recommendations available"}
              </h3>
              <p>
                {items.length
                  ? "Try changing your search or priority filter."
                  : "Recommendations will appear when batches with available stock are recorded."}
              </p>
            </div>
          ) : (
            <div className="recommendations-list">
              {visibleItems.map((item) => (
                <article
                  className="recommendation-card"
                  key={item.batch_id}
                >
                  <div className="recommendation-card-top">
                    <div>
                      <span className="recommendation-category">
                        {item.category || "Uncategorized"}
                      </span>
                      <h3>{item.food_name || "Unknown food"}</h3>
                      <p className="recommendation-batch">
                        Batch: {item.batch_number || `#${item.batch_id}`}
                      </p>
                    </div>

                    <span className={priorityClass(item.priority)}>
                      {item.priority || "Low"} Priority
                    </span>
                  </div>

                  <div className="recommendation-details">
                    <div>
                      <span>Available quantity</span>
                      <strong>
                        {item.quantity ?? "—"} {item.unit || ""}
                      </strong>
                    </div>

                    <div>
                      <span>Expiry date</span>
                      <strong>{formatDate(item.expiry_date)}</strong>
                    </div>

                    <div>
                      <span>Days until expiry</span>
                      <strong>
                        {item.days_until_expiry == null
                          ? "Not available"
                          : item.days_until_expiry < 0
                            ? `Expired ${Math.abs(item.days_until_expiry)} day(s) ago`
                            : item.days_until_expiry === 0
                              ? "Expires today"
                              : `${item.days_until_expiry} day(s)`}
                      </strong>
                    </div>

                    <div>
                      <span>Freshness score</span>
                      <strong>
                        {item.freshness_score == null
                          ? "Not recorded"
                          : `${item.freshness_score}/100`}
                      </strong>
                    </div>
                  </div>

                  <div className="recommendation-action">
                    <strong>Recommended action</strong>
                    <p>{item.recommended_action || "Review this batch."}</p>
                    <span>{item.reason || "Review the available batch information."}</span>
                  </div>

                  {item.temperature_issue && (
                    <div className="recommendation-warning">
                      🌡️ Storage temperature requires attention.
                    </div>
                  )}

                  {item.data_note && (
                    <p className="recommendation-data-note">
                      ℹ️ {item.data_note}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Recommendations;
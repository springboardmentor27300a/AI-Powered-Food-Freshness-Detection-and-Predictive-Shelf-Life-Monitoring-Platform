import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getFoods,
} from "../api";

function Dashboard({
  onLogout,
  onAddFood,
  onInventory,
}) {
  const [user, setUser] = useState(null);
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userData, foodData] =
          await Promise.all([
            getCurrentUser(),
            getFoods(),
          ]);

        setUser(userData);
        setFoods(foodData);
      } catch (error) {
        console.error(error);
      }
    };

    loadData();
  }, []);

  const freshCount = foods.filter(
    (food) =>
      food.freshness_status?.toLowerCase() === "fresh"
  ).length;

  const pendingCount = foods.filter(
    (food) =>
      food.freshness_status?.toLowerCase() === "pending"
  ).length;

  return (
    <div className="dashboard-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="floating-food dashboard-food-one">
        🍎
      </div>

      <div className="floating-food dashboard-food-two">
        🥕
      </div>

      <div className="floating-food dashboard-food-three">
        🥦
      </div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🍏</div>

          <div>
            <strong>FreshGuard</strong>
            <span>Food Freshness Platform</span>
          </div>
        </div>

        <div className="topbar-right">
          {user && (
            <div className="user-pill">
              <div className="user-avatar">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>

              <div className="user-info">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </div>
            </div>
          )}

          <button
            className="logout-button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-hero">
          <div className="hero-copy">
            <span className="mini-label">
              SMART FOOD MONITORING
            </span>

            <h1>
              Keep your food
              <br />
              <span>fresh & healthy.</span>
            </h1>

            <p className="dashboard-subtitle">
              Track your food inventory, monitor
              freshness status, and make smarter
              decisions before food goes to waste.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button hero-button"
                onClick={onAddFood}
              >
                + Add Food
              </button>

              <button
                className="secondary-button"
                onClick={onInventory}
              >
                View Inventory →
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="fruit-orbit orbit-one">
              🍎
            </div>

            <div className="fruit-orbit orbit-two">
              🥕
            </div>

            <div className="fruit-orbit orbit-three">
              🥦
            </div>

            <div className="hero-fruit">
              🥑
            </div>

            <div className="fresh-ring">
              <span>FRESH</span>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green">
              🧺
            </div>

            <div>
              <p>Total Food Items</p>
              <strong>{foods.length}</strong>
            </div>

            <span className="stat-decoration">
              🍎
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-icon mint">
              🌱
            </div>

            <div>
              <p>Fresh Items</p>
              <strong>{freshCount}</strong>
            </div>

            <span className="stat-decoration">
              🥬
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-icon yellow">
              ⏳
            </div>

            <div>
              <p>Pending Analysis</p>
              <strong>{pendingCount}</strong>
            </div>

            <span className="stat-decoration">
              🍋
            </span>
          </div>
        </section>

        <section className="action-section">
          <div className="section-heading">
            <div>
              <span className="mini-label">
                QUICK ACTIONS
              </span>

              <h2>Manage your food</h2>
            </div>

            <span className="section-emoji">
              🥗
            </span>
          </div>

          <div className="action-grid">
            <button
              className="action-card add-card"
              onClick={onAddFood}
            >
              <div className="action-illustration">
                🍎🥕
              </div>

              <div>
                <span className="action-label">
                  INVENTORY
                </span>

                <h3>Add Food Item</h3>

                <p>
                  Register fruits, vegetables,
                  dairy and other food products.
                </p>
              </div>

              <span className="action-arrow">
                →
              </span>
            </button>

            <button
              className="action-card inventory-card"
              onClick={onInventory}
            >
              <div className="action-illustration">
                🥦🍅
              </div>

              <div>
                <span className="action-label">
                  MONITOR
                </span>

                <h3>Food Inventory</h3>

                <p>
                  View your saved food items and
                  freshness information.
                </p>
              </div>

              <span className="action-arrow">
                →
              </span>
            </button>
          </div>
        </section>

        <section className="fresh-banner">
          <div className="banner-food">
            🍓 🥑 🍊
          </div>

          <div>
            <span className="mini-label">
              FRESHNESS MATTERS
            </span>

            <h2>
              Less waste. Better food.
            </h2>

            <p>
              Smart monitoring helps you
              understand what is fresh and
              what needs attention.
            </p>
          </div>

          <div className="banner-badge">
            <span>🌿</span>
            Smart
            <br />
            Monitoring
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
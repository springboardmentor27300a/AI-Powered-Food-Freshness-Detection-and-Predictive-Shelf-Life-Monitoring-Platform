function WarehouseDashboard({
  onLogout,
  onProfile,
  onInventory,
}) {

  return (

    <div className="dashboard-page">

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🏭
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Warehouse Operator Dashboard
            </span>

          </div>

        </div>


        <div className="topbar-right">

          <button
            className="secondary-button"
            onClick={onProfile}
            type="button"
          >
            Profile
          </button>

          <button
            className="logout-button"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>

        </div>

      </header>


      <main className="dashboard-content">

        <section className="dashboard-hero">

          <div className="hero-copy">

            <span className="mini-label">
              WAREHOUSE MONITORING
            </span>

            <h1>
              Protect your
              <br />
              <span>
                stored food.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Monitor storage compliance,
              inventory health, batch freshness,
              and environmental conditions.
            </p>

            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={onInventory}
                type="button"
              >
                View Inventory →
              </button>

            </div>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🏭
            </div>

            <div className="fresh-ring">
              <span>
                STORAGE
              </span>
            </div>

          </div>

        </section>


        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon green">
              🌡️
            </div>

            <div>

              <p>
                Temperature
              </p>

              <strong>
                Monitor
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon mint">
              💧
            </div>

            <div>

              <p>
                Humidity
              </p>

              <strong>
                Monitor
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon yellow">
              📋
            </div>

            <div>

              <p>
                Compliance
              </p>

              <strong>
                Active
              </strong>

            </div>

          </div>

        </section>


        <section className="action-section">

          <div className="section-heading">

            <div>

              <span className="mini-label">
                STORAGE OPERATIONS
              </span>

              <h2>
                Warehouse health
              </h2>

            </div>

            <span className="section-emoji">
              🌡️
            </span>

          </div>


          <div className="action-grid">

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                📦🌱
              </div>

              <div>

                <span className="action-label">
                  INVENTORY
                </span>

                <h3>
                  Inventory Health
                </h3>

                <p>
                  Track stored food and
                  freshness information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>


            <div className="action-card">

              <div className="action-illustration">
                🌡️💧
              </div>

              <div>

                <span className="action-label">
                  STORAGE
                </span>

                <h3>
                  Storage Compliance
                </h3>

                <p>
                  Monitor environmental
                  storage conditions.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default WarehouseDashboard;
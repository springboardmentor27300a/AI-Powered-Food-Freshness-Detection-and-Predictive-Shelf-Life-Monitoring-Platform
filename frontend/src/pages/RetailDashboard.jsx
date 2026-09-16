function RetailDashboard({
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
            🏪
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Retail Manager Dashboard
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
              RETAIL MONITORING
            </span>

            <h1>
              Monitor your
              <br />
              <span>
                product freshness.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Monitor product freshness,
              inventory quality, shelf-life alerts,
              and waste reduction insights.
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
              🏪
            </div>

            <div className="fresh-ring">
              <span>
                RETAIL
              </span>
            </div>

          </div>

        </section>


        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon green">
              📦
            </div>

            <div>

              <p>
                Inventory Monitoring
              </p>

              <strong>
                Active
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon yellow">
              ⏳
            </div>

            <div>

              <p>
                Shelf-Life Alerts
              </p>

              <strong>
                Monitor
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon mint">
              ♻️
            </div>

            <div>

              <p>
                Waste Insights
              </p>

              <strong>
                Available
              </strong>

            </div>

          </div>

        </section>


        <section className="action-section">

          <div className="section-heading">

            <div>

              <span className="mini-label">
                RETAIL OPERATIONS
              </span>

              <h2>
                Product monitoring
              </h2>

            </div>

            <span className="section-emoji">
              📊
            </span>

          </div>


          <div className="action-grid">

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                📦🥬
              </div>

              <div>

                <span className="action-label">
                  INVENTORY
                </span>

                <h3>
                  Product Freshness
                </h3>

                <p>
                  Monitor inventory quality
                  and freshness information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>


            <div className="action-card">

              <div className="action-illustration">
                ⚠️📅
              </div>

              <div>

                <span className="action-label">
                  ALERTS
                </span>

                <h3>
                  Shelf-Life Alerts
                </h3>

                <p>
                  Track products approaching
                  their shelf-life limits.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default RetailDashboard;
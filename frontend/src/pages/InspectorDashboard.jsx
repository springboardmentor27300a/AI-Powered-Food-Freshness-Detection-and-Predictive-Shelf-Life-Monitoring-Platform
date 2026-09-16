function InspectorDashboard({
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
            🔬
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Food Quality Inspector
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
              QUALITY INSPECTION
            </span>

            <h1>
              Inspect food
              <br />
              <span>
                freshness intelligently.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Review freshness assessments,
              quality scores, spoilage indicators,
              and food freshness reports.
            </p>

            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={onInventory}
                type="button"
              >
                Inspect Inventory →
              </button>

            </div>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🔬
            </div>

            <div className="fresh-ring">
              <span>
                QUALITY
              </span>
            </div>

          </div>

        </section>


        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon green">
              🔍
            </div>

            <div>

              <p>
                Freshness Analysis
              </p>

              <strong>
                Active
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon yellow">
              ⚠️
            </div>

            <div>

              <p>
                Spoilage Indicators
              </p>

              <strong>
                Monitor
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon mint">
              📊
            </div>

            <div>

              <p>
                Quality Reports
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
                INSPECTION TOOLS
              </span>

              <h2>
                Food quality
              </h2>

            </div>

            <span className="section-emoji">
              🔬
            </span>

          </div>


          <div className="action-grid">

            <button
              className="action-card inventory-card"
              onClick={onInventory}
              type="button"
            >

              <div className="action-illustration">
                🍎🔬
              </div>

              <div>

                <span className="action-label">
                  INSPECTION
                </span>

                <h3>
                  Freshness Reports
                </h3>

                <p>
                  Review food freshness and
                  quality information.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>


            <div className="action-card">

              <div className="action-illustration">
                🦠⚠️
              </div>

              <div>

                <span className="action-label">
                  QUALITY
                </span>

                <h3>
                  Spoilage Detection
                </h3>

                <p>
                  Review potential spoilage
                  indicators from analysis.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default InspectorDashboard;
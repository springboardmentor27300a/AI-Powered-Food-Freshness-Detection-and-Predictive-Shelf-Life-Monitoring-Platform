function AdminDashboard({
  onLogout,
  onProfile,
}) {

  return (

    <div className="dashboard-page">

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🛡️
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Administrator Dashboard
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
              PLATFORM ADMINISTRATION
            </span>

            <h1>
              Manage the
              <br />
              <span>
                FreshGuard platform.
              </span>
            </h1>

            <p className="dashboard-subtitle">
              Monitor users, platform analytics,
              system status, and reporting
              management.
            </p>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🛡️
            </div>

            <div className="fresh-ring">
              <span>
                ADMIN
              </span>
            </div>

          </div>

        </section>


        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon green">
              👥
            </div>

            <div>

              <p>
                User Management
              </p>

              <strong>
                Active
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon mint">
              📊
            </div>

            <div>

              <p>
                Platform Analytics
              </p>

              <strong>
                Available
              </strong>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon yellow">
              ⚙️
            </div>

            <div>

              <p>
                System Monitoring
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
                ADMINISTRATION
              </span>

              <h2>
                Platform management
              </h2>

            </div>

            <span className="section-emoji">
              🛡️
            </span>

          </div>


          <div className="action-grid">

            <div className="action-card">

              <div className="action-illustration">
                👥
              </div>

              <div>

                <span className="action-label">
                  USERS
                </span>

                <h3>
                  User Management
                </h3>

                <p>
                  Manage registered users and
                  their platform roles.
                </p>

              </div>

            </div>


            <div className="action-card">

              <div className="action-illustration">
                📊
              </div>

              <div>

                <span className="action-label">
                  ANALYTICS
                </span>

                <h3>
                  Platform Analytics
                </h3>

                <p>
                  Monitor platform-level
                  freshness and inventory insights.
                </p>

              </div>

            </div>


            <div className="action-card">

              <div className="action-illustration">
                ⚙️
              </div>

              <div>

                <span className="action-label">
                  SYSTEM
                </span>

                <h3>
                  System Monitoring
                </h3>

                <p>
                  Monitor platform services
                  and system status.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default AdminDashboard;
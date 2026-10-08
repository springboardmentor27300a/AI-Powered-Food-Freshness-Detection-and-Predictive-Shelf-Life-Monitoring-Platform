import { useEffect, useState } from "react";

import {
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  getAdminAnalytics,
  getAdminSystemStatus,
} from "../api";


function AdminDashboard({
  onLogout,
  onProfile,
  onReports,
}) {

  // ============================================================
  // ADMIN DATA
  // ============================================================

  const [users, setUsers] = useState([]);

  const [analytics, setAnalytics] = useState(null);

  const [systemStatus, setSystemStatus] =
    useState(null);


  // ============================================================
  // UI STATE
  // ============================================================

  const [activeSection, setActiveSection] =
    useState(null);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const [loadingAnalytics, setLoadingAnalytics] =
    useState(false);

  const [loadingSystem, setLoadingSystem] =
    useState(false);

  const [updatingUserId, setUpdatingUserId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");


  // ============================================================
  // LOAD ADMIN DATA
  // ============================================================

  useEffect(() => {

    loadAdminUsers();
    loadAdminAnalytics();
    loadAdminSystemStatus();

  }, []);


  // ============================================================
  // GET USERS
  // ============================================================

  async function loadAdminUsers() {

    try {

      setLoadingUsers(true);
      setError("");

      const data =
        await getAdminUsers();

      setUsers(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      setError(
        error?.message ||
          "Unable to load users."
      );

    } finally {

      setLoadingUsers(false);

    }
  }


  // ============================================================
  // GET ANALYTICS
  // ============================================================

  async function loadAdminAnalytics() {

    try {

      setLoadingAnalytics(true);

      const data =
        await getAdminAnalytics();

      setAnalytics(data);

    } catch (error) {

      setError(
        error?.message ||
          "Unable to load platform analytics."
      );

    } finally {

      setLoadingAnalytics(false);

    }
  }


  // ============================================================
  // GET SYSTEM STATUS
  // ============================================================

  async function loadAdminSystemStatus() {

    try {

      setLoadingSystem(true);

      const data =
        await getAdminSystemStatus();

      setSystemStatus(data);

    } catch (error) {

      setError(
        error?.message ||
          "Unable to load system status."
      );

    } finally {

      setLoadingSystem(false);

    }
  }


  // ============================================================
  // UPDATE USER ROLE
  // ============================================================

  async function handleRoleChange(
    userId,
    role
  ) {

    try {

      setUpdatingUserId(userId);
      setError("");
      setSuccessMessage("");

      const data =
        await updateAdminUserRole(
          userId,
          role
        );

      if (data?.user) {

        setUsers((previousUsers) =>
          previousUsers.map((user) =>
            user.id === userId
              ? data.user
              : user
          )
        );

      } else {

        await loadAdminUsers();

      }

      setSuccessMessage(
        "User role updated successfully."
      );

      await loadAdminAnalytics();

    } catch (error) {

      setError(
        error?.message ||
          "Unable to update user role."
      );

    } finally {

      setUpdatingUserId(null);

    }
  }


  // ============================================================
  // UPDATE USER STATUS
  // ============================================================

  async function handleStatusChange(
    userId,
    isActive
  ) {

    try {

      setUpdatingUserId(userId);
      setError("");
      setSuccessMessage("");

      const data =
        await updateAdminUserStatus(
          userId,
          isActive
        );

      if (data?.user) {

        setUsers((previousUsers) =>
          previousUsers.map((user) =>
            user.id === userId
              ? data.user
              : user
          )
        );

      } else {

        await loadAdminUsers();

      }

      setSuccessMessage(
        isActive
          ? "User activated successfully."
          : "User deactivated successfully."
      );

      await loadAdminAnalytics();

    } catch (error) {

      setError(
        error?.message ||
          "Unable to update user status."
      );

    } finally {

      setUpdatingUserId(null);

    }
  }


  // ============================================================
  // OPEN ADMIN SECTION
  // ============================================================

  function openSection(section) {

    setError("");
    setSuccessMessage("");

    setActiveSection(section);

  }


  // ============================================================
  // ROLE LABEL
  // ============================================================

  function formatRole(role) {

    if (!role) {
      return "Consumer";
    }

    return role
      .split("_")
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1)
      )
      .join(" ");
  }


  // ============================================================
  // TOPBAR
  // ============================================================

  return (

    <div className="dashboard-page">

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />


      {/* ==========================================================
          TOPBAR
      ========================================================== */}

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

          {/* REPORTS */}

          <button
            className="secondary-button"
            onClick={onReports}
            type="button"
          >
            📊 Reports
          </button>


          {/* PROFILE */}

          <button
            className="secondary-button"
            onClick={onProfile}
            type="button"
          >
            Profile
          </button>


          {/* LOGOUT */}

          <button
            className="logout-button"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>

        </div>

      </header>


      {/* ==========================================================
          MAIN CONTENT
      ========================================================== */}

      <main className="dashboard-content">


        {/* ========================================================
            HERO
        ======================================================== */}

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


            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={onReports}
                type="button"
              >
                View Platform Reports →
              </button>

            </div>

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



        {/* ========================================================
            ADMIN STATS
        ======================================================== */}

        <section className="stats-grid">


          {/* USER MANAGEMENT */}

          <div
            className="stat-card"
            role="button"
            tabIndex={0}
            onClick={() =>
              openSection("users")
            }
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                openSection("users");
              }

            }}
          >

            <div className="stat-icon green">
              👥
            </div>

            <div>

              <p>
                User Management
              </p>

              <strong>
                {loadingUsers
                  ? "Loading..."
                  : `${users.length} Users`}
              </strong>

            </div>

          </div>


          {/* PLATFORM ANALYTICS */}

          <div
            className="stat-card"
            role="button"
            tabIndex={0}
            onClick={() =>
              openSection("analytics")
            }
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                openSection("analytics");
              }

            }}
          >

            <div className="stat-icon mint">
              📊
            </div>

            <div>

              <p>
                Platform Analytics
              </p>

              <strong>
                {loadingAnalytics
                  ? "Loading..."
                  : analytics
                    ? `${analytics.inventory?.total ?? 0} Foods`
                    : "Available"}
              </strong>

            </div>

          </div>


          {/* SYSTEM MONITORING */}

          <div
            className="stat-card"
            role="button"
            tabIndex={0}
            onClick={() =>
              openSection("system")
            }
            onKeyDown={(event) => {

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                openSection("system");
              }

            }}
          >

            <div className="stat-icon yellow">
              ⚙️
            </div>

            <div>

              <p>
                System Monitoring
              </p>

              <strong>
                {loadingSystem
                  ? "Checking..."
                  : systemStatus?.status ===
                      "operational"
                    ? "Operational"
                    : "Check Status"}
              </strong>

            </div>

          </div>

        </section>



        {/* ========================================================
            MESSAGES
        ======================================================== */}

        {(error || successMessage) && (

          <section
            style={{
              marginTop: "24px",
              padding: "16px 20px",
              borderRadius: "16px",
              background:
                error
                  ? "rgba(255, 90, 90, 0.10)"
                  : "rgba(50, 200, 130, 0.10)",
              border:
                error
                  ? "1px solid rgba(255, 90, 90, 0.25)"
                  : "1px solid rgba(50, 200, 130, 0.25)",
            }}
          >

            <strong>
              {error || successMessage}
            </strong>

          </section>

        )}



        {/* ========================================================
            ADMINISTRATION
        ======================================================== */}

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


            {/* ====================================================
                USER MANAGEMENT
            ==================================================== */}

            <button
              className="action-card"
              onClick={() =>
                openSection("users")
              }
              type="button"
            >

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

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                PLATFORM ANALYTICS
            ==================================================== */}

            <button
              className="action-card"
              onClick={() =>
                openSection("analytics")
              }
              type="button"
            >

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

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                SYSTEM MONITORING
            ==================================================== */}

            <button
              className="action-card"
              onClick={() =>
                openSection("system")
              }
              type="button"
            >

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

              <span className="action-arrow">
                →
              </span>

            </button>



            {/* ====================================================
                REPORTING MANAGEMENT
            ==================================================== */}

            <button
              className="action-card"
              onClick={onReports}
              type="button"
            >

              <div className="action-illustration">
                📑📈
              </div>

              <div>

                <span className="action-label">
                  REPORTING
                </span>

                <h3>
                  Reporting Management
                </h3>

                <p>
                  Review platform reports,
                  inventory quality, freshness,
                  and operational insights.
                </p>

              </div>

              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>



        {/* ========================================================
            USER MANAGEMENT PANEL
        ======================================================== */}

        {activeSection === "users" && (

          <section
            className="action-section"
            style={{
              marginTop: "28px",
            }}
          >

            <div className="section-heading">

              <div>

                <span className="mini-label">
                  USER MANAGEMENT
                </span>

                <h2>
                  Registered users
                </h2>

              </div>

              <button
                className="secondary-button"
                onClick={loadAdminUsers}
                type="button"
              >
                ↻ Refresh
              </button>

            </div>


            {loadingUsers ? (

              <div className="dashboard-hero">
                <div className="hero-copy">
                  <h2>
                    Loading users...
                  </h2>
                  <p className="dashboard-subtitle">
                    Fetching registered users from
                    the administration service.
                  </p>
                </div>
              </div>

            ) : users.length === 0 ? (

              <div className="dashboard-hero">
                <div className="hero-copy">
                  <h2>
                    No users found
                  </h2>
                  <p className="dashboard-subtitle">
                    There are currently no registered
                    users available.
                  </p>
                </div>
              </div>

            ) : (

              <div
                style={{
                  overflowX: "auto",
                  marginTop: "20px",
                }}
              >

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "760px",
                  }}
                >

                  <thead>

                    <tr>

                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                        }}
                      >
                        User
                      </th>

                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                        }}
                      >
                        Email
                      </th>

                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                        }}
                      >
                        Role
                      </th>

                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                        }}
                      >
                        Status
                      </th>

                      <th
                        style={{
                          textAlign: "left",
                          padding: "14px",
                        }}
                      >
                        Action
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {users.map((user) => {

                      const isUpdating =
                        updatingUserId ===
                        user.id;

                      const currentUser =
                        JSON.parse(
                          localStorage.getItem(
                            "current_user"
                          ) || "null"
                        );

                      const isCurrentUser =
                        currentUser?.id ===
                        user.id;

                      return (

                        <tr
                          key={user.id}
                          style={{
                            borderTop:
                              "1px solid rgba(255,255,255,0.08)",
                          }}
                        >

                          <td
                            style={{
                              padding: "14px",
                            }}
                          >

                            <strong>
                              {user.name}
                            </strong>

                          </td>


                          <td
                            style={{
                              padding: "14px",
                            }}
                          >
                            {user.email}
                          </td>


                          <td
                            style={{
                              padding: "14px",
                            }}
                          >

                            <select
                              value={
                                user.role ||
                                "consumer"
                              }
                              disabled={
                                isUpdating ||
                                isCurrentUser
                              }
                              onChange={(event) =>
                                handleRoleChange(
                                  user.id,
                                  event.target.value
                                )
                              }
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                background:
                                  "rgba(255,255,255,0.08)",
                                color: "inherit",
                                border:
                                  "1px solid rgba(255,255,255,0.15)",
                              }}
                            >

                              <option value="consumer">
                                Consumer
                              </option>

                              <option value="retail_manager">
                                Retail Manager
                              </option>

                              <option value="warehouse_operator">
                                Warehouse Operator
                              </option>

                              <option value="food_quality_inspector">
                                Food Quality Inspector
                              </option>

                              <option value="administrator">
                                Administrator
                              </option>

                            </select>

                          </td>


                          <td
                            style={{
                              padding: "14px",
                            }}
                          >

                            <strong>
                              {user.is_active
                                ? "Active"
                                : "Inactive"}
                            </strong>

                          </td>


                          <td
                            style={{
                              padding: "14px",
                            }}
                          >

                            <button
                              className="secondary-button"
                              type="button"
                              disabled={
                                isUpdating ||
                                isCurrentUser
                              }
                              onClick={() =>
                                handleStatusChange(
                                  user.id,
                                  !user.is_active
                                )
                              }
                            >

                              {isUpdating
                                ? "Updating..."
                                : user.is_active
                                  ? "Deactivate"
                                  : "Activate"}

                            </button>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </section>

        )}



        {/* ========================================================
            PLATFORM ANALYTICS PANEL
        ======================================================== */}

        {activeSection === "analytics" && (

          <section
            className="action-section"
            style={{
              marginTop: "28px",
            }}
          >

            <div className="section-heading">

              <div>

                <span className="mini-label">
                  PLATFORM ANALYTICS
                </span>

                <h2>
                  Platform overview
                </h2>

              </div>

              <button
                className="secondary-button"
                onClick={loadAdminAnalytics}
                type="button"
              >
                ↻ Refresh
              </button>

            </div>


            {loadingAnalytics ? (

              <div className="dashboard-hero">

                <div className="hero-copy">

                  <h2>
                    Loading analytics...
                  </h2>

                  <p className="dashboard-subtitle">
                    Fetching platform analytics.
                  </p>

                </div>

              </div>

            ) : analytics ? (

              <div
                className="stats-grid"
                style={{
                  marginTop: "20px",
                }}
              >

                <div className="stat-card">

                  <div className="stat-icon green">
                    👥
                  </div>

                  <div>

                    <p>
                      Total Users
                    </p>

                    <strong>
                      {analytics.users?.total ?? 0}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon mint">
                    🟢
                  </div>

                  <div>

                    <p>
                      Active Users
                    </p>

                    <strong>
                      {analytics.users?.active ?? 0}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon yellow">
                    🍎
                  </div>

                  <div>

                    <p>
                      Total Food Items
                    </p>

                    <strong>
                      {analytics.inventory?.total ?? 0}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon green">
                    ✨
                  </div>

                  <div>

                    <p>
                      Fresh / Good
                    </p>

                    <strong>
                      {analytics.inventory?.fresh_or_good ?? 0}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon yellow">
                    ⏳
                  </div>

                  <div>

                    <p>
                      Pending
                    </p>

                    <strong>
                      {analytics.inventory?.pending ?? 0}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon mint">
                    ⚠️
                  </div>

                  <div>

                    <p>
                      Expired
                    </p>

                    <strong>
                      {analytics.inventory?.expired ?? 0}
                    </strong>

                  </div>

                </div>

              </div>

            ) : (

              <div className="dashboard-hero">

                <div className="hero-copy">

                  <h2>
                    Analytics unavailable
                  </h2>

                  <p className="dashboard-subtitle">
                    Platform analytics could not
                    be loaded.
                  </p>

                </div>

              </div>

            )}

          </section>

        )}



        {/* ========================================================
            SYSTEM MONITORING PANEL
        ======================================================== */}

        {activeSection === "system" && (

          <section
            className="action-section"
            style={{
              marginTop: "28px",
            }}
          >

            <div className="section-heading">

              <div>

                <span className="mini-label">
                  SYSTEM MONITORING
                </span>

                <h2>
                  Platform services
                </h2>

              </div>

              <button
                className="secondary-button"
                onClick={loadAdminSystemStatus}
                type="button"
              >
                ↻ Refresh
              </button>

            </div>


            {loadingSystem ? (

              <div className="dashboard-hero">

                <div className="hero-copy">

                  <h2>
                    Checking services...
                  </h2>

                  <p className="dashboard-subtitle">
                    Checking FreshGuard platform
                    services.
                  </p>

                </div>

              </div>

            ) : systemStatus ? (

              <div
                className="stats-grid"
                style={{
                  marginTop: "20px",
                }}
              >

                <div className="stat-card">

                  <div className="stat-icon green">
                    🟢
                  </div>

                  <div>

                    <p>
                      Platform
                    </p>

                    <strong>
                      {systemStatus.status}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon green">
                    🔐
                  </div>

                  <div>

                    <p>
                      Authentication
                    </p>

                    <strong>
                      {systemStatus.authentication}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon green">
                    📦
                  </div>

                  <div>

                    <p>
                      Inventory API
                    </p>

                    <strong>
                      {systemStatus.inventory_api}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon green">
                    🤖
                  </div>

                  <div>

                    <p>
                      Prediction API
                    </p>

                    <strong>
                      {systemStatus.prediction_api}
                    </strong>

                  </div>

                </div>


                <div className="stat-card">

                  <div className="stat-icon green">
                    🛡️
                  </div>

                  <div>

                    <p>
                      Administration API
                    </p>

                    <strong>
                      {systemStatus.administration_api}
                    </strong>

                  </div>

                </div>

              </div>

            ) : (

              <div className="dashboard-hero">

                <div className="hero-copy">

                  <h2>
                    System status unavailable
                  </h2>

                  <p className="dashboard-subtitle">
                    System monitoring data could
                    not be loaded.
                  </p>

                </div>

              </div>

            )}

          </section>

        )}



        {/* ========================================================
            ADMIN INSIGHTS
        ======================================================== */}

        <section
          className="dashboard-hero"
          style={{
            marginTop: "28px",
            minHeight: "auto",
          }}
        >

          <div className="hero-copy">

            <span className="mini-label">
              ADMINISTRATOR INSIGHTS
            </span>

            <h2
              style={{
                marginBottom: "10px",
              }}
            >
              Keep the platform
              <br />
              <span>
                healthy and monitored.
              </span>
            </h2>

            <p className="dashboard-subtitle">
              Monitor platform activity, review
              operational reports, and maintain
              visibility across FreshGuard's
              food freshness ecosystem.
            </p>

          </div>


          <div className="hero-visual">

            <div className="hero-fruit">
              🛡️
            </div>

            <div className="fresh-ring">

              <span>
                CONTROL
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


export default AdminDashboard;
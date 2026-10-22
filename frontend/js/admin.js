/**
 * Food Freshness Monitoring Platform - Administrator Console Controller
 * Powers user governance, role management, AI monitoring, storage rules,
 * audit trails, system health telemetry, and runtime configuration.
 */

let charts = {};
let currentUsersList = [];
let currentRulesList = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Guard Authentication and Role
  if (!api.enforceRoleAccess(["Admin"])) return;

  const currentUser = api.getUser();
  if (currentUser) {
    const topName = document.getElementById("top-user-name");
    const topRole = document.getElementById("top-user-role");
    const topAvatar = document.getElementById("top-user-avatar");
    const sidebarName = document.getElementById("sidebar-user-name");
    const sidebarRole = document.getElementById("sidebar-user-role");
    const sidebarAvatar = document.getElementById("sidebar-user-avatar");
    const heroAdmin = document.getElementById("hero-admin-name");

    const displayName = currentUser.name || "Administrator";
    const initials = (currentUser.name || "AD").substring(0, 2).toUpperCase();

    if (topName) topName.textContent = displayName;
    if (topRole) topRole.textContent = "Platform Admin";
    if (topAvatar) topAvatar.textContent = initials;
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarRole) sidebarRole.textContent = "Platform Admin";
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (heroAdmin) heroAdmin.textContent = `👤 Logged In: ${displayName}`;
  }

  // 2. Setup Components & Event Listeners
  setupTabNavigation();
  setupModalDismissals();
  setupUserManagementEvents();
  setupStorageRuleEvents();
  setupAuditLogEvents();
  setupSystemHealthEvents();
  setupSystemConfigEvents();
  setupReportsEvents();
  setupHeroEvents();

  // Mobile menu toggle
  const mobileBtn = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".sidebar");
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // Topbar and sidebar logout buttons
  document.querySelectorAll(".btn-logout").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      api.logout();
    });
  });

  // Top header telemetry refresh
  document.getElementById("btn-top-refresh")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-top-refresh");
    setButtonLoading(btn, true, "🔄 Refresh Telemetry");
    await loadOverviewData();
    await loadSystemHealthData();
    showToast("Platform telemetry refreshed.", "info");
    setButtonLoading(btn, false, "🔄 Refresh Telemetry");
  });

  // Check URL hash for initial tab
  const hash = window.location.hash.replace("#", "");
  if (hash && document.getElementById(`pane-${hash}`)) {
    switchTab(hash);
  } else {
    // 3. Initial Data Load (Overview Tab)
    await loadOverviewData();
  }
});

// =============================================================================
// TAB NAVIGATION
// =============================================================================
function setupTabNavigation() {
  // Pill tab buttons
  const tabBtns = document.querySelectorAll(".tab-nav-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Sidebar navigation links
  const sidebarLinks = document.querySelectorAll(".admin-nav-tabs .nav-item[data-tab]");
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetTab = link.dataset.tab;
      switchTab(targetTab);

      const sidebar = document.querySelector(".sidebar");
      if (sidebar && window.innerWidth < 992) {
        sidebar.classList.remove("open");
      }
    });
  });

  // Overview quick action buttons
  document.getElementById("btn-quick-manage-users")?.addEventListener("click", () => switchTab("users"));
  document.getElementById("btn-view-all-users")?.addEventListener("click", () => switchTab("users"));
  document.getElementById("btn-quick-add-rule")?.addEventListener("click", () => {
    switchTab("storage-rules");
    openCreateRuleModal();
  });
  document.getElementById("btn-quick-sys-config")?.addEventListener("click", () => switchTab("system-config"));
  document.getElementById("btn-quick-audit-view")?.addEventListener("click", () => switchTab("audit-logs"));
  document.getElementById("btn-view-all-audits")?.addEventListener("click", () => switchTab("audit-logs"));
  document.getElementById("btn-quick-export-csv")?.addEventListener("click", handleExportCsv);
}

function switchTab(tabId) {
  // Update segmented tab buttons
  document.querySelectorAll(".tab-nav-btn").forEach((b) => b.classList.remove("active"));
  const targetBtn = document.querySelector(`.tab-nav-btn[data-tab="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add("active");

  // Update sidebar links
  document.querySelectorAll(".admin-nav-tabs .nav-item[data-tab]").forEach((item) => item.classList.remove("active"));
  const targetSidebarItem = document.querySelector(`.admin-nav-tabs .nav-item[data-tab="${tabId}"]`);
  if (targetSidebarItem) targetSidebarItem.classList.add("active");

  // Update tab panes
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) targetPane.classList.add("active");

  // Update URL hash cleanly
  if (window.location.hash !== `#${tabId}`) {
    history.replaceState(null, null, `#${tabId}`);
  }

  // Update top title to reflect active section
  const titleMap = {
    overview: "System Operations & Governance",
    users: "User Lifecycle & Role Governance",
    "ai-monitor": "AI Freshness Vision Telemetry",
    "storage-rules": "Storage Safety Rules & Zones",
    "audit-logs": "Security Audit Trail & Compliance",
    "system-health": "Infrastructure Diagnostics & Health",
    "system-config": "Runtime System Configuration",
    reports: "Platform-Wide Analytics & Intelligence"
  };
  const titleEl = document.getElementById("admin-page-title");
  if (titleEl && titleMap[tabId]) {
    titleEl.innerHTML = `<span>🛡️</span> ${titleMap[tabId]}`;
  }

  // Lazy load tab data
  if (tabId === "overview") loadOverviewData();
  else if (tabId === "users") loadUsersData();
  else if (tabId === "ai-monitor") loadAiStatsData();
  else if (tabId === "storage-rules") loadStorageRulesData();
  else if (tabId === "audit-logs") loadAuditLogsData();
  else if (tabId === "system-health") loadSystemHealthData();
  else if (tabId === "system-config") loadSystemConfigData();
  else if (tabId === "reports") loadReportsData();
}

window.switchTab = switchTab;

function setupHeroEvents() {
  const btnRefresh = document.getElementById("btn-hero-refresh-all");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      setButtonLoading(btnRefresh, true, "🔄 Refresh Telemetry");
      await loadOverviewData();
      await loadSystemHealthData();
      showToast("Platform telemetry refreshed.", "info");
      setButtonLoading(btnRefresh, false, "🔄 Refresh Telemetry");
    });
  }
}

// =============================================================================
// MODAL CONTROLLER
// =============================================================================
function setupModalDismissals() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.close;
      closeModal(modalId);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// =============================================================================
// MODULE 1: SYSTEM OVERVIEW
// =============================================================================
async function loadOverviewData() {
  try {
    const data = await api.getAdminDashboard();

    // 8 KPIs
    const elTotalUsers = document.getElementById("kpi-total-users");
    const elUsersSub = document.getElementById("kpi-users-subtext");
    const elActiveUsers = document.getElementById("kpi-active-users");
    const elAnalyses = document.getElementById("kpi-total-analyses");
    const elFreshRatio = document.getElementById("kpi-fresh-spoiled-ratio");
    const elFreshSub = document.getElementById("kpi-fresh-spoiled-sub");
    const elAvgScore = document.getElementById("kpi-avg-score");
    const elInventory = document.getElementById("kpi-total-inventory");
    const elRules = document.getElementById("kpi-total-rules");
    const elHealth = document.getElementById("kpi-health-status");

    if (typeof animateCounter === "function") {
      if (elTotalUsers) animateCounter(elTotalUsers, data.total_users ?? 0);
      if (elActiveUsers) animateCounter(elActiveUsers, data.active_users ?? 0);
      if (elAnalyses) animateCounter(elAnalyses, data.total_food_analyses ?? 0);
      if (elInventory) animateCounter(elInventory, data.total_inventory_items ?? 0);
      if (elRules) animateCounter(elRules, data.total_storage_rules ?? 0);
    } else {
      if (elTotalUsers) elTotalUsers.textContent = data.total_users ?? 0;
      if (elActiveUsers) elActiveUsers.textContent = data.active_users ?? 0;
      if (elAnalyses) elAnalyses.textContent = data.total_food_analyses ?? 0;
      if (elInventory) elInventory.textContent = data.total_inventory_items ?? 0;
      if (elRules) elRules.textContent = data.total_storage_rules ?? 0;
    }
    if (elUsersSub) elUsersSub.textContent = `Active: ${data.active_users ?? 0} | Inactive: ${data.inactive_users ?? 0}`;
    
    const fresh = data.fresh_items ?? 0;
    const spoiled = data.spoiled_items ?? 0;
    if (elFreshRatio) elFreshRatio.textContent = `${fresh} : ${spoiled}`;
    if (elFreshSub) elFreshSub.textContent = `Fresh: ${fresh} | Marginal: ${data.marginal_items ?? 0} | Spoiled: ${spoiled}`;
    
    if (elAvgScore) elAvgScore.textContent = `${(data.average_quality_score ?? 0).toFixed(1)} / 100`;
    if (elHealth) {
      elHealth.textContent = (data.system_health_status || "HEALTHY").toUpperCase();
      elHealth.style.color = (data.system_health_status === "degraded") ? "#d97706" : "#16a34a";
    }

    // Render Recent Users table in Overview
    renderOverviewRecentUsers(data.recent_users || []);

    // Render Recent Audits table in Overview
    renderOverviewRecentAudits(data.recent_audit_logs || []);

  } catch (err) {
    console.error("Failed to load overview data:", err);
    showToast("Error loading system overview: " + (err.message || "Network error"), "error");
  }
}

function renderOverviewRecentUsers(users) {
  const tbody = document.getElementById("tbody-overview-recent-users");
  if (!tbody) return;

  const rawList = Array.isArray(users) ? users : (users && users.items ? users.items : []);
  if (!rawList || rawList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#94a3b8;">No registered users recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = rawList.slice(0, 5).map((u) => {
    const roleBadge = getRoleBadgeHtml(u.role);
    const statusPill = u.status === "deactivated"
      ? `<span class="status-pill deactivated">Deactivated</span>`
      : `<span class="status-pill active">Active</span>`;
    const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A";

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${escapeHtml(u.name || "User")}</div>
          <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(u.email || "")}</div>
        </td>
        <td>${roleBadge}</td>
        <td>${statusPill}</td>
        <td style="font-size: 0.82rem; color: #64748b;">${createdDate}</td>
      </tr>
    `;
  }).join("");
}

function renderOverviewRecentAudits(audits) {
  const tbody = document.getElementById("tbody-overview-recent-audits");
  if (!tbody) return;

  if (!audits || audits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color:#94a3b8;">No recent audit logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = audits.slice(0, 5).map((a) => {
    const timeFormatted = a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now";
    return `
      <tr>
        <td>
          <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.76rem;">${escapeHtml(a.action || "action")}</code>
        </td>
        <td style="font-size: 0.82rem;">${escapeHtml(a.performed_by || "system")}</td>
        <td style="font-size: 0.8rem; color: #64748b;">${timeFormatted}</td>
      </tr>
    `;
  }).join("");
}

// =============================================================================
// MODULE 2: USER & ROLE MANAGEMENT
// =============================================================================
let usersState = {
  page: 1,
  limit: 25,
  search: "",
  role: "",
  status: "",
  sortBy: "created_at",
  sortOrder: "desc",
  total: 0,
  pages: 1,
  items: [],
};

function setupUserManagementEvents() {
  const btnFilter = document.getElementById("btn-filter-users");
  const btnReset = document.getElementById("btn-reset-users-filter");
  const btnRefresh = document.getElementById("btn-refresh-users");
  const inputSearch = document.getElementById("input-users-search");
  const roleSelect = document.getElementById("select-users-role-filter");
  const statusSelect = document.getElementById("select-users-status-filter");
  const sortSelect = document.getElementById("select-users-sort-filter");
  const perPageSelect = document.getElementById("select-users-per-page");
  const btnPrev = document.getElementById("btn-users-prev-page");
  const btnNext = document.getElementById("btn-users-next-page");
  const btnExport = document.getElementById("btn-export-users-csv");

  // Search input: filter on Enter
  inputSearch?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      usersState.search = inputSearch.value.trim();
      loadUsersData(1);
    }
  });

  // Role filter change
  roleSelect?.addEventListener("change", () => {
    usersState.role = roleSelect.value;
    loadUsersData(1);
  });

  // Status filter change
  statusSelect?.addEventListener("change", () => {
    usersState.status = statusSelect.value;
    loadUsersData(1);
  });

  // Sort dropdown change
  sortSelect?.addEventListener("change", () => {
    const [by, ord] = sortSelect.value.split(":");
    usersState.sortBy = by || "created_at";
    usersState.sortOrder = ord || "desc";
    updateHeaderSortIndicators();
    loadUsersData(1);
  });

  // Filter button
  btnFilter?.addEventListener("click", () => {
    usersState.search = inputSearch?.value.trim() || "";
    usersState.role = roleSelect?.value || "";
    usersState.status = statusSelect?.value || "";
    if (sortSelect) {
      const [by, ord] = sortSelect.value.split(":");
      usersState.sortBy = by || "created_at";
      usersState.sortOrder = ord || "desc";
      updateHeaderSortIndicators();
    }
    loadUsersData(1);
  });

  // Reset button
  btnReset?.addEventListener("click", () => {
    if (inputSearch) inputSearch.value = "";
    if (roleSelect) roleSelect.value = "";
    if (statusSelect) statusSelect.value = "";
    if (sortSelect) sortSelect.value = "created_at:desc";
    usersState.search = "";
    usersState.role = "";
    usersState.status = "";
    usersState.sortBy = "created_at";
    usersState.sortOrder = "desc";
    updateHeaderSortIndicators();
    loadUsersData(1);
  });

  // Refresh button
  btnRefresh?.addEventListener("click", () => {
    loadUsersData(usersState.page);
  });

  // Rows per page
  perPageSelect?.addEventListener("change", () => {
    usersState.limit = parseInt(perPageSelect.value, 10) || 25;
    loadUsersData(1);
  });

  // Pagination Next / Prev
  btnPrev?.addEventListener("click", () => {
    if (usersState.page > 1) {
      loadUsersData(usersState.page - 1);
    }
  });

  btnNext?.addEventListener("click", () => {
    if (usersState.page < usersState.pages) {
      loadUsersData(usersState.page + 1);
    }
  });

  // Clickable Table Headers Sorting
  document.querySelectorAll("#table-users .sortable-th").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (!field) return;

      if (usersState.sortBy === field) {
        usersState.sortOrder = (usersState.sortOrder === "asc") ? "desc" : "asc";
      } else {
        usersState.sortBy = field;
        usersState.sortOrder = (field === "created_at" || field === "last_login") ? "desc" : "asc";
      }

      // Sync sort dropdown if present
      if (sortSelect) {
        const val = `${usersState.sortBy}:${usersState.sortOrder}`;
        if ([...sortSelect.options].some((opt) => opt.value === val)) {
          sortSelect.value = val;
        }
      }

      updateHeaderSortIndicators();
      loadUsersData(1);
    });
  });

  btnExport?.addEventListener("click", handleExportCsv);

  // Form submit: Change Role
  const formRole = document.getElementById("form-change-role");
  formRole?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("modal-role-user-id").value;
    const newRole = document.getElementById("modal-select-role").value;
    const btnSubmit = document.getElementById("btn-submit-change-role");

    setButtonLoading(btnSubmit, true, "Apply Role");
    try {
      await api.updateUserRole(userId, newRole);
      showToast(`User role successfully updated to ${newRole}.`, "success");
      closeModal("modal-change-role");
      await loadUsersData(usersState.page);
      await loadOverviewData();
    } catch (err) {
      showToast(err.message || "Failed to update role.", "error");
    } finally {
      setButtonLoading(btnSubmit, false, "Apply Role");
    }
  });

  // Form submit: Deactivate User
  const formDeactivate = document.getElementById("form-deactivate-user");
  formDeactivate?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("modal-deactivate-user-id").value;
    const reason = document.getElementById("modal-deactivate-reason").value.trim() || undefined;
    const btnSubmit = document.getElementById("btn-submit-deactivate");

    setButtonLoading(btnSubmit, true, "Deactivating...");
    try {
      await api.deactivateUser(userId, reason);
      showToast("User account has been deactivated successfully.", "success");
      closeModal("modal-deactivate-user");
      await loadUsersData(usersState.page);
      await loadOverviewData();
    } catch (err) {
      showToast(err.message || "Failed to deactivate account.", "error");
    } finally {
      setButtonLoading(btnSubmit, false, "🛑 Confirm Deactivate");
    }
  });

  // Form submit: Activate User
  const formActivate = document.getElementById("form-activate-user");
  formActivate?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("modal-activate-user-id").value;
    const reason = document.getElementById("modal-activate-reason").value.trim() || undefined;
    const btnSubmit = document.getElementById("btn-submit-activate");

    setButtonLoading(btnSubmit, true, "Activating...");
    try {
      await api.activateUser(userId, reason);
      showToast("User account has been reactivated successfully.", "success");
      closeModal("modal-activate-user");
      await loadUsersData(usersState.page);
      await loadOverviewData();
    } catch (err) {
      showToast(err.message || "Failed to activate account.", "error");
    } finally {
      setButtonLoading(btnSubmit, false, "✅ Confirm Activate");
    }
  });
}

function updateHeaderSortIndicators() {
  document.querySelectorAll("#table-users .sortable-th").forEach((th) => {
    const field = th.dataset.sort;
    const indicator = th.querySelector(".sort-indicator");
    if (!indicator) return;

    if (field === usersState.sortBy) {
      th.classList.add("active-sort");
      indicator.textContent = (usersState.sortOrder === "asc") ? "▲" : "▼";
    } else {
      th.classList.remove("active-sort");
      indicator.textContent = "↕";
    }
  });
}

async function loadUsersData(targetPage = null) {
  const tbody = document.getElementById("tbody-users-list");
  if (!tbody) return;

  if (targetPage !== null) {
    usersState.page = targetPage;
  }

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color:#94a3b8;">Loading user records...</td></tr>`;

  const skip = (usersState.page - 1) * usersState.limit;
  const params = {
    limit: usersState.limit,
    skip: skip,
    sort_by: usersState.sortBy,
    sort_order: usersState.sortOrder,
  };

  if (usersState.search) params.search = usersState.search;
  if (usersState.role) params.role = usersState.role;
  if (usersState.status) params.status = usersState.status;

  try {
    const res = await api.getAdminUsers(params);
    const users = Array.isArray(res) ? res : (res && res.items ? res.items : []);
    const total = res && typeof res.total === "number" ? res.total : users.length;
    
    usersState.items = users || [];
    usersState.total = total;
    usersState.pages = res && typeof res.pages === "number" ? res.pages : Math.max(1, Math.ceil(total / usersState.limit));

    renderUsersTable(usersState.items);
    renderUsersPagination();
  } catch (err) {
    console.error("Failed to load users:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 25px; color:#dc2626;">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderUsersPagination() {
  const infoEl = document.getElementById("users-pagination-info");
  const pageNumEl = document.getElementById("users-page-number");
  const btnPrev = document.getElementById("btn-users-prev-page");
  const btnNext = document.getElementById("btn-users-next-page");

  const start = usersState.total === 0 ? 0 : (usersState.page - 1) * usersState.limit + 1;
  const end = Math.min(usersState.total, usersState.page * usersState.limit);

  if (infoEl) {
    infoEl.textContent = `Showing ${start} to ${end} of ${usersState.total} users`;
  }

  if (pageNumEl) {
    pageNumEl.textContent = `Page ${usersState.page} of ${usersState.pages}`;
  }

  if (btnPrev) {
    btnPrev.disabled = (usersState.page <= 1);
  }

  if (btnNext) {
    btnNext.disabled = (usersState.page >= usersState.pages);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("tbody-users-list");
  if (!tbody) return;

  const rawList = Array.isArray(users) ? users : (users && users.items ? users.items : []);
  if (!rawList || rawList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 35px; color:#94a3b8;">No matching users found for current filter criteria.</td></tr>`;
    return;
  }

  const currentAdmin = api.getUser() || {};
  const currentAdminId = currentAdmin.id || currentAdmin._id || "";
  const currentAdminEmail = (currentAdmin.email || "").toLowerCase().trim();

  tbody.innerHTML = rawList.map((u) => {
    const roleBadge = getRoleBadgeHtml(u.role);
    const isDeactivated = (u.status === "deactivated" || u.is_active === false);
    const statusPill = isDeactivated
      ? `<span class="status-pill deactivated">Inactive</span>`
      : `<span class="status-pill active">Active</span>`;

    const lastLoginFormatted = u.last_login
      ? new Date(u.last_login).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : `<span style="color:#94a3b8; font-style:italic;">Never</span>`;

    const createdFormatted = u.created_at
      ? new Date(u.created_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
      : "N/A";

    // Self check
    const isSelf = (currentAdminId && u.id === currentAdminId) ||
                   (currentAdminEmail && u.email && u.email.toLowerCase().trim() === currentAdminEmail);

    const selfBadge = isSelf ? ` <span style="font-size:0.68rem; color:#2563eb; background:#dbeafe; padding:1px 6px; border-radius:4px; font-weight:700;">You</span>` : "";

    // Action button
    let statusActionBtn = "";
    if (isDeactivated) {
      statusActionBtn = `<button class="btn-sm-action success" onclick="openActivateUserModal('${u.id}', '${escapeHtml(u.name || "User")}', '${escapeHtml(u.email || "")}')" title="Reactivate user access">✅ Activate</button>`;
    } else {
      if (isSelf) {
        statusActionBtn = `<button class="btn-sm-action danger" disabled title="Administrators cannot deactivate their own active account">🛑 Deactivate</button>`;
      } else {
        statusActionBtn = `<button class="btn-sm-action danger" onclick="openDeactivateUserModal('${u.id}', '${escapeHtml(u.name || "User")}', '${escapeHtml(u.email || "")}')" title="Deactivate account access">🛑 Deactivate</button>`;
      }
    }

    const shortId = u.id ? (u.id.length > 8 ? u.id.substring(0, 8) + "..." : u.id) : "N/A";

    return `
      <tr>
        <td>
          <code class="user-id-code" title="${escapeHtml(u.id)}">${escapeHtml(shortId)}</code>
        </td>
        <td>
          <div style="font-weight: 700; color: #1e293b;">${escapeHtml(u.name || "User")}${selfBadge}</div>
        </td>
        <td>
          <span style="color: #475569; font-size: 0.86rem;">${escapeHtml(u.email || "")}</span>
        </td>
        <td>${roleBadge}</td>
        <td>${statusPill}</td>
        <td style="font-size: 0.82rem; color: #64748b;">${createdFormatted}</td>
        <td style="font-size: 0.82rem; color: #64748b;">${lastLoginFormatted}</td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn-sm-action" onclick="openUserDetailsModal('${u.id}')" title="Inspect user record and details">🔍 Details</button>
            <button class="btn-sm-action" onclick="openChangeRoleModal('${u.id}', '${escapeHtml(u.name || "User")}', '${escapeHtml(u.role || "Consumer")}')" title="Reassign operational role">🔄 Role</button>
            ${statusActionBtn}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// User Action Handlers (exposed globally)
window.openUserDetailsModal = async function(userId) {
  try {
    const user = await api.getAdminUser(userId);
    const container = document.getElementById("modal-user-details-content");
    if (!container) return;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <strong>Full Name:</strong> <span>${escapeHtml(user.name || "N/A")}</span>
        <strong>Email:</strong> <span>${escapeHtml(user.email || "N/A")}</span>
        <strong>Assigned Role:</strong> <span>${getRoleBadgeHtml(user.role)}</span>
        <strong>Account Status:</strong> <span>${user.status === "deactivated" || user.is_active === false ? '<span class="status-pill deactivated">Inactive</span>' : '<span class="status-pill active">Active</span>'}</span>
        <strong>Auth Provider:</strong> <span>${escapeHtml(user.auth_provider || "local").toUpperCase()}</span>
        ${user.google_id ? `<strong>Google Subject ID:</strong> <code style="font-size:0.8rem;">${escapeHtml(user.google_id)}</code>` : ""}
        <strong>Last Login:</strong> <span>${user.last_login ? new Date(user.last_login).toLocaleString() : "Never logged in"}</span>
        <strong>Registered Date:</strong> <span>${user.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}</span>
        <strong>User ID:</strong> <code style="font-size:0.8rem;">${escapeHtml(user.id)}</code>
      </div>
    `;

    openModal("modal-user-details");
  } catch (err) {
    showToast("Failed to fetch user details: " + (err.message || "Error"), "error");
  }
};

window.openChangeRoleModal = function(userId, userName, currentRole) {
  document.getElementById("modal-role-user-id").value = userId;
  document.getElementById("modal-role-user-name").textContent = userName;
  const select = document.getElementById("modal-select-role");
  if (select) {
    select.value = (currentRole === "Admin" || currentRole === "Administrator") ? "Administrator" : currentRole;
  }
  openModal("modal-change-role");
};

window.openDeactivateUserModal = function(userId, userName, userEmail) {
  const currentAdmin = api.getUser() || {};
  const currentAdminId = currentAdmin.id || currentAdmin._id || "";
  const currentAdminEmail = (currentAdmin.email || "").toLowerCase().trim();

  if ((currentAdminId && currentAdminId === userId) || (currentAdminEmail && userEmail && currentAdminEmail === userEmail.toLowerCase().trim())) {
    showToast("Security Policy: Administrators cannot deactivate their own active account.", "warning");
    return;
  }

  document.getElementById("modal-deactivate-user-id").value = userId;
  document.getElementById("modal-deactivate-user-name").textContent = userName;
  document.getElementById("modal-deactivate-user-email").textContent = userEmail || "No email available";
  document.getElementById("modal-deactivate-reason").value = "";
  openModal("modal-deactivate-user");
};

window.openActivateUserModal = function(userId, userName, userEmail) {
  document.getElementById("modal-activate-user-id").value = userId;
  document.getElementById("modal-activate-user-name").textContent = userName;
  document.getElementById("modal-activate-user-email").textContent = userEmail || "No email available";
  document.getElementById("modal-activate-reason").value = "";
  openModal("modal-activate-user");
};

async function handleExportCsv() {
  try {
    showToast("Generating CSV export...", "info");
    await api.downloadUsersCsv();
    showToast("Users CSV exported successfully.", "success");
  } catch (err) {
    showToast(err.message || "Failed to export CSV.", "error");
  }
}

// =============================================================================
// MODULE 3: AI VISION MONITORING
// =============================================================================
async function loadAiStatsData() {
  try {
    const stats = await api.getAdminAiStats();

    // Populate stat cards
    document.getElementById("ai-stat-inferences").textContent = stats.total_inferences ?? 0;
    document.getElementById("ai-stat-fresh").textContent = stats.fresh_count ?? 0;
    document.getElementById("ai-stat-marginal").textContent = stats.marginal_count ?? 0;
    document.getElementById("ai-stat-spoiled").textContent = stats.spoiled_count ?? 0;
    document.getElementById("ai-stat-confidence").textContent = `${((stats.average_confidence ?? 0) * 100).toFixed(1)}%`;
    document.getElementById("ai-stat-errors").textContent = stats.error_count ?? 0;

    // Render Charts
    renderAiDistributionChart(stats.prediction_distribution || { Fresh: stats.fresh_count, Marginal: stats.marginal_count, Spoiled: stats.spoiled_count });
    renderAiCategoriesChart(stats.category_distribution || {});

    // Render Recent AI Activity
    renderRecentAiActivity(stats.recent_activity || []);

  } catch (err) {
    console.error("Failed to load AI stats:", err);
    showToast("Error loading AI telemetry: " + (err.message || "Network error"), "error");
  }
}

function renderAiDistributionChart(dist) {
  const canvas = document.getElementById("chart-ai-distribution");
  if (!canvas) return;

  if (charts["ai-dist"]) charts["ai-dist"].destroy();

  const labels = Object.keys(dist);
  const values = Object.values(dist);

  charts["ai-dist"] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Fresh", "Marginal", "Spoiled"],
      datasets: [{
        data: values.length ? values : [0, 0, 0],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      }
    }
  });
}

function renderAiCategoriesChart(catDist) {
  const canvas = document.getElementById("chart-ai-categories");
  if (!canvas) return;

  if (charts["ai-cats"]) charts["ai-cats"].destroy();

  const labels = Object.keys(catDist);
  const values = Object.values(catDist);

  charts["ai-cats"] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Categories"],
      datasets: [{
        label: "Scans",
        data: values.length ? values : [0],
        backgroundColor: "#4f46e5",
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      }
    }
  });
}

function renderRecentAiActivity(activities) {
  const tbody = document.getElementById("tbody-ai-recent-inferences");
  if (!tbody) return;

  if (!activities || activities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#94a3b8;">No recent AI inferences recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = activities.map((item) => {
    let predPill = `<span class="status-pill active">Fresh</span>`;
    const pred = (item.predicted_freshness || "").toLowerCase();
    if (pred.includes("spoiled")) predPill = `<span class="status-pill deactivated">Spoiled</span>`;
    else if (pred.includes("marginal")) predPill = `<span class="status-pill" style="background:#fef3c7; color:#b45309;">Marginal</span>`;

    const conf = item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : "N/A";
    const score = item.quality_score ? `${Number(item.quality_score).toFixed(1)} / 100` : "N/A";
    const shelf = item.predicted_shelf_life_days ? `${item.predicted_shelf_life_days} days` : "N/A";
    const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : "Recent";

    return `
      <tr>
        <td style="font-weight: 700;">${escapeHtml(item.food_name || "Food Item")}</td>
        <td>${escapeHtml(item.category || "General")}</td>
        <td>${predPill}</td>
        <td>${conf}</td>
        <td style="font-weight: 700;">${score}</td>
        <td>${shelf}</td>
        <td style="font-size: 0.8rem; color: #64748b;">${time}</td>
      </tr>
    `;
  }).join("");
}

// =============================================================================
// MODULE 4: STORAGE RULES & ZONES
// =============================================================================
function setupStorageRuleEvents() {
  document.getElementById("btn-open-create-rule-modal")?.addEventListener("click", openCreateRuleModal);

  const formRule = document.getElementById("form-storage-rule");
  formRule?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ruleId = document.getElementById("modal-rule-id").value;
    const btnSubmit = document.getElementById("btn-submit-storage-rule");

    const category = document.getElementById("rule-category").value.trim();
    const minTemp = parseFloat(document.getElementById("rule-min-temp").value);
    const maxTemp = parseFloat(document.getElementById("rule-max-temp").value);
    const recTemp = parseFloat(document.getElementById("rule-rec-temp").value);
    const minHumidity = parseFloat(document.getElementById("rule-min-humidity").value);
    const maxHumidity = parseFloat(document.getElementById("rule-max-humidity").value);
    const recHumidity = parseFloat(document.getElementById("rule-rec-humidity").value);
    const zone = document.getElementById("rule-zone").value;

    // Client-side tolerance check
    if (minTemp > maxTemp) {
      showToast("Min temperature cannot exceed max temperature.", "error");
      return;
    }
    if (minHumidity > maxHumidity) {
      showToast("Min humidity cannot exceed max humidity.", "error");
      return;
    }

    const payload = {
      category,
      min_temperature: minTemp,
      max_temperature: maxTemp,
      recommended_temperature: recTemp,
      min_humidity: minHumidity,
      max_humidity: maxHumidity,
      recommended_humidity: recHumidity,
      storage_zone: zone,
    };

    setButtonLoading(btnSubmit, true, "Save Storage Rule");
    try {
      if (ruleId) {
        await api.updateAdminStorageRule(ruleId, payload);
        showToast(`Storage rule for ${category} updated.`, "success");
      } else {
        await api.createAdminStorageRule(payload);
        showToast(`New storage rule created for ${category}.`, "success");
      }
      closeModal("modal-storage-rule");
      await loadStorageRulesData();
    } catch (err) {
      showToast(err.message || "Failed to save storage rule.", "error");
    } finally {
      setButtonLoading(btnSubmit, false, "Save Storage Rule");
    }
  });
}

function openCreateRuleModal() {
  document.getElementById("modal-rule-id").value = "";
  document.getElementById("modal-storage-rule-title").textContent = "❄️ Create Storage Rule";
  document.getElementById("form-storage-rule").reset();
  openModal("modal-storage-rule");
}

async function loadStorageRulesData() {
  const tbody = document.getElementById("tbody-storage-rules");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 25px; color:#94a3b8;">Loading storage rules...</td></tr>`;

  try {
    const rules = await api.getAdminStorageRules();
    currentRulesList = rules || [];
    renderStorageRulesTable(currentRulesList);
  } catch (err) {
    console.error("Failed to load storage rules:", err);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 25px; color:#dc2626;">Failed to load rules: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderStorageRulesTable(rules) {
  const tbody = document.getElementById("tbody-storage-rules");
  if (!tbody) return;

  if (!rules || rules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 30px; color:#94a3b8;">No storage rules configured yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rules.map((r) => {
    const updatedFormatted = r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "Default";

    return `
      <tr>
        <td style="font-weight: 700; color: #1e293b;">${escapeHtml(r.category)}</td>
        <td>${r.min_temperature}°C</td>
        <td>${r.max_temperature}°C</td>
        <td style="font-weight: 700; color: #4f46e5;">${r.recommended_temperature}°C</td>
        <td>${r.min_humidity}%</td>
        <td>${r.max_humidity}%</td>
        <td style="font-weight: 700; color: #0284c7;">${r.recommended_humidity}%</td>
        <td>
          <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 0.76rem; font-weight: 600;">
            ${escapeHtml(r.storage_zone || "Chilled")}
          </span>
        </td>
        <td style="font-size: 0.8rem; color: #64748b;">${updatedFormatted}</td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn-sm-action" onclick="openEditRuleModal('${r.id}')">✏️ Edit</button>
            <button class="btn-sm-action danger" onclick="handleDeleteRule('${r.id}', '${escapeHtml(r.category)}')">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.openEditRuleModal = function(ruleId) {
  const rule = currentRulesList.find((r) => r.id === ruleId);
  if (!rule) return;

  document.getElementById("modal-rule-id").value = rule.id;
  document.getElementById("modal-storage-rule-title").textContent = `✏️ Edit Rule: ${rule.category}`;
  document.getElementById("rule-category").value = rule.category;
  document.getElementById("rule-min-temp").value = rule.min_temperature;
  document.getElementById("rule-max-temp").value = rule.max_temperature;
  document.getElementById("rule-rec-temp").value = rule.recommended_temperature;
  document.getElementById("rule-min-humidity").value = rule.min_humidity;
  document.getElementById("rule-max-humidity").value = rule.max_humidity;
  document.getElementById("rule-rec-humidity").value = rule.recommended_humidity;
  document.getElementById("rule-zone").value = rule.storage_zone || "Chilled";

  openModal("modal-storage-rule");
};

window.handleDeleteRule = async function(ruleId, category) {
  if (!confirm(`Are you sure you want to delete the storage tolerance rule for ${category}?`)) return;

  try {
    await api.deleteAdminStorageRule(ruleId);
    showToast(`Storage rule for ${category} removed.`, "success");
    await loadStorageRulesData();
  } catch (err) {
    showToast(err.message || "Failed to delete storage rule.", "error");
  }
};

// =============================================================================
// MODULE 5: SECURITY AUDIT LOGS
// =============================================================================
function setupAuditLogEvents() {
  document.getElementById("btn-filter-audits")?.addEventListener("click", () => loadAuditLogsData());
  document.getElementById("btn-reset-audits")?.addEventListener("click", () => {
    document.getElementById("select-audit-action-filter").value = "";
    document.getElementById("input-audit-user-filter").value = "";
    loadAuditLogsData();
  });
}

async function loadAuditLogsData() {
  const tbody = document.getElementById("tbody-audit-logs");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 25px; color:#94a3b8;">Loading audit trail...</td></tr>`;

  const action = document.getElementById("select-audit-action-filter")?.value || "";
  const userId = document.getElementById("input-audit-user-filter")?.value.trim() || "";

  const params = { limit: 50 };
  if (action) params.action = action;
  if (userId) params.user_id = userId;

  try {
    const res = await api.getAdminAuditLogs(params);
    const counter = document.getElementById("audit-log-counter");
    if (counter) counter.textContent = `Showing ${res.logs?.length || 0} of ${res.total || 0} events`;
    renderAuditLogsTable(res.logs || []);
  } catch (err) {
    console.error("Failed to load audit logs:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 25px; color:#dc2626;">Failed to load audit logs: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderAuditLogsTable(logs) {
  const tbody = document.getElementById("tbody-audit-logs");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color:#94a3b8;">No matching audit logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map((log) => {
    const timeFormatted = log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A";
    const logJson = JSON.stringify(log.details || {}, null, 2);

    return `
      <tr>
        <td style="font-size: 0.8rem; color: #64748b; white-space: nowrap;">${timeFormatted}</td>
        <td>
          <code style="background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">
            ${escapeHtml(log.action)}
          </code>
        </td>
        <td style="font-weight: 600;">${escapeHtml(log.performed_by || "system")}</td>
        <td style="font-size: 0.82rem; color: #475569;">${escapeHtml(log.target_user_id || "—")}</td>
        <td style="font-size: 0.8rem; color: #64748b;">${escapeHtml(log.ip_address || "127.0.0.1")}</td>
        <td>
          <button class="btn-sm-action" onclick='openAuditDetailsModal(${JSON.stringify(log.action)}, ${JSON.stringify(log.performed_by || "system")}, ${JSON.stringify(timeFormatted)}, ${JSON.stringify(log.ip_address || "")}, ${JSON.stringify(log.details || {})})'>
            📜 Inspect
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.openAuditDetailsModal = function(action, performedBy, timestamp, ip, detailsObj) {
  document.getElementById("audit-detail-action").textContent = action;
  document.getElementById("audit-detail-by").textContent = performedBy;
  document.getElementById("audit-detail-time").textContent = timestamp;
  document.getElementById("audit-detail-ip").textContent = ip || "N/A";
  document.getElementById("audit-detail-json").textContent = JSON.stringify(detailsObj, null, 2);

  openModal("modal-audit-details");
};

// =============================================================================
// MODULE 6: SYSTEM HEALTH & DIAGNOSTICS
// =============================================================================
function setupSystemHealthEvents() {
  document.getElementById("btn-refresh-health-probes")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-refresh-health-probes");
    setButtonLoading(btn, true, "🔄 Ping Services");
    await loadSystemHealthData();
    setButtonLoading(btn, false, "🔄 Ping Services");
    showToast("Services probe ping completed.", "success");
  });
}

async function loadSystemHealthData() {
  try {
    const health = await api.getAdminSystemHealth();

    // Ping & State badges
    const dbLatency = document.getElementById("metric-db-latency");
    const dbStateBadge = document.getElementById("badge-db-state");
    const heroDbStatus = document.getElementById("hero-db-status");
    const heroSysStatus = document.getElementById("hero-sys-status");

    if (dbLatency) dbLatency.textContent = `${(health.database_ping_ms ?? 12).toFixed(1)} ms`;
    if (dbStateBadge) {
      dbStateBadge.textContent = health.database_status === "connected" ? "Connected" : "Disconnected";
      dbStateBadge.className = `status-pill ${health.database_status === "connected" ? "active" : "deactivated"}`;
    }
    if (heroDbStatus) {
      heroDbStatus.textContent = `🗄️ MongoDB Atlas: ${health.database_status === "connected" ? "Connected" : "Warning"}`;
    }
    if (heroSysStatus) {
      heroSysStatus.textContent = `⚡ Platform Health: ${(health.status || "healthy").toUpperCase()}`;
    }

    // Diagnostics overview
    document.getElementById("health-sys-time").textContent = health.system_time ? new Date(health.system_time).toLocaleString() : new Date().toLocaleString();
    document.getElementById("health-active-sessions").textContent = health.active_sessions_estimate ?? 1;
    document.getElementById("health-error-count").textContent = health.error_count ?? 0;

  } catch (err) {
    console.error("Health probe failed:", err);
    showToast("Health probe failed: " + (err.message || "Network error"), "error");
  }
}

// =============================================================================
// MODULE 7: SYSTEM CONFIGURATION
// =============================================================================
function setupSystemConfigEvents() {
  document.getElementById("btn-reset-config")?.addEventListener("click", loadSystemConfigData);

  const form = document.getElementById("form-system-config");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSave = document.getElementById("btn-save-config");

    const platformName = document.getElementById("cfg-platform-name").value.trim();
    const quarantineThreshold = parseFloat(document.getElementById("cfg-quarantine-threshold").value);
    const maxUploadMb = parseInt(document.getElementById("cfg-max-upload-mb").value, 10);
    const logLevel = document.getElementById("cfg-log-level").value;
    const allowedExtRaw = document.getElementById("cfg-allowed-ext").value;
    const allowedExt = allowedExtRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    const allowRegistration = document.getElementById("cfg-allow-registration").checked;
    const aiEnabled = document.getElementById("cfg-ai-enabled").checked;
    const emailAlerts = document.getElementById("cfg-email-alerts").checked;
    const maintenanceMode = document.getElementById("cfg-maintenance-mode").checked;

    const payload = {
      platform_name: platformName,
      quarantine_score_threshold: quarantineThreshold,
      max_image_upload_mb: maxUploadMb,
      log_level: logLevel,
      allowed_file_extensions: allowedExt,
      allow_user_registration: allowRegistration,
      ai_vision_engine_enabled: aiEnabled,
      email_alerts_enabled: emailAlerts,
      maintenance_mode: maintenanceMode,
    };

    setButtonLoading(btnSave, true, "Save System Configuration");
    try {
      await api.updateAdminSystemConfig(payload);
      showToast("Platform system configuration updated successfully.", "success");
    } catch (err) {
      showToast(err.message || "Failed to update system config.", "error");
    } finally {
      setButtonLoading(btnSave, false, "Save System Configuration");
    }
  });
}

async function loadSystemConfigData() {
  loadPlatformFeatures();
  try {
    const cfg = await api.getAdminSystemConfig();

    document.getElementById("cfg-platform-name").value = cfg.platform_name || "Food Freshness Monitoring Platform";
    document.getElementById("cfg-quarantine-threshold").value = cfg.quarantine_score_threshold ?? 40.0;
    document.getElementById("cfg-max-upload-mb").value = cfg.max_image_upload_mb ?? 10;
    document.getElementById("cfg-log-level").value = cfg.log_level || "INFO";
    document.getElementById("cfg-allowed-ext").value = (cfg.allowed_file_extensions || [".jpg", ".jpeg", ".png", ".webp"]).join(", ");

    document.getElementById("cfg-allow-registration").checked = Boolean(cfg.allow_user_registration);
    document.getElementById("cfg-ai-enabled").checked = Boolean(cfg.ai_vision_engine_enabled);
    document.getElementById("cfg-email-alerts").checked = Boolean(cfg.email_alerts_enabled);
    document.getElementById("cfg-maintenance-mode").checked = Boolean(cfg.maintenance_mode);

  } catch (err) {
    console.error("Failed to load config:", err);
    showToast("Failed to load system config: " + (err.message || "Error"), "error");
  }
}

// =============================================================================
// MODULE 8: ANALYTICS & EXPORT
// =============================================================================
function setupReportsEvents() {
  document.getElementById("btn-reports-export-csv")?.addEventListener("click", handleExportCsv);
}

async function loadReportsData() {
  try {
    const analytics = await api.getAdminAnalytics();

    // Chart 1: Users by Role
    renderUsersByRoleChart(analytics.user_metrics?.roles_distribution || {});

    // Chart 2: Freshness Metrics
    renderFreshnessRatioChart(analytics.freshness_metrics || {});

  } catch (err) {
    console.error("Failed to load platform analytics:", err);
    showToast("Failed to load analytics: " + (err.message || "Error"), "error");
  }
}

function renderUsersByRoleChart(rolesDist) {
  const canvas = document.getElementById("chart-users-by-role");
  if (!canvas) return;

  if (charts["users-role"]) charts["users-role"].destroy();

  const labels = Object.keys(rolesDist);
  const values = Object.values(rolesDist);

  charts["users-role"] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["Consumer", "Retailer", "Food Quality Inspector", "Warehouse Operator", "Admin"],
      datasets: [{
        label: "Registered Users",
        data: values.length ? values : [0, 0, 0, 0, 0],
        backgroundColor: ["#38bdf8", "#fbbf24", "#2dd4bf", "#94a3b8", "#a855f7"],
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function renderFreshnessRatioChart(freshnessMetrics) {
  const canvas = document.getElementById("chart-freshness-ratio");
  if (!canvas) return;

  if (charts["fresh-ratio"]) charts["fresh-ratio"].destroy();

  const fresh = freshnessMetrics.fresh || 0;
  const marginal = freshnessMetrics.marginal || 0;
  const spoiled = freshnessMetrics.spoiled || 0;

  charts["fresh-ratio"] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Fresh", "Marginal", "Spoiled"],
      datasets: [{
        data: [fresh, marginal, spoiled],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

// =============================================================================
// UI HELPERS
// =============================================================================
function getRoleBadgeHtml(role) {
  const r = role || "Consumer";
  let cls = "Consumer";
  const rLower = r.toLowerCase();
  if (rLower.includes("admin")) cls = "Admin";
  else if (rLower.includes("retailer")) cls = "Retailer";
  else if (rLower.includes("inspector")) cls = "Inspector";
  else if (rLower.includes("warehouse manager")) cls = "WarehouseManager";
  else if (rLower.includes("warehouse")) cls = "Warehouse";
  else if (rLower.includes("manufacturer")) cls = "Manufacturer";
  else if (rLower.includes("supply chain")) cls = "SupplyChain";

  return `<span class="role-badge ${cls}">${escapeHtml(r)}</span>`;
}


// =============================================================================
// PLATFORM FEATURE MODULES MANAGEMENT
// =============================================================================
const FEATURE_MODULES = [
  {
    key: "feature_food_scanner_enabled",
    name: "Food Freshness Scanner",
    icon: "📷",
    description: "Computer vision image analysis and freshness quality score estimation for produce and perishables.",
  },
  {
    key: "feature_inventory_management_enabled",
    name: "Food Inventory Management",
    icon: "📦",
    description: "Batch management, item cataloging, stock tracking, and shelf-life calculations across user roles.",
  },
  {
    key: "feature_freshness_alerts_enabled",
    name: "Freshness & Spoilage Alerts",
    icon: "⚠️",
    description: "Automated event dispatching for approaching expiration dates and critical freshness decline.",
  },
  {
    key: "feature_expiry_tracking_enabled",
    name: "Expiry & FEFO Shelf-Life Tracking",
    icon: "⏳",
    description: "FEFO (First Expired, First Out) inventory rotation prioritizing and dynamic expiration timelines.",
  },
  {
    key: "feature_storage_monitoring_enabled",
    name: "Storage Condition Monitoring",
    icon: "❄️",
    description: "Warehouse temperature and humidity threshold validation against defined category storage rules.",
  },
  {
    key: "feature_reports_enabled",
    name: "Reports & Food Waste Analytics",
    icon: "📊",
    description: "Visual inventory reports, category distribution charts, food waste analysis, and audit exports.",
  },
];

async function loadPlatformFeatures() {
  const container = document.getElementById("feature-modules-grid");
  if (!container) return;

  try {
    const config = await api.getAdminSystemConfig();
    container.innerHTML = FEATURE_MODULES.map((mod) => {
      const isEnabled = config[mod.key] !== false;
      const statusPill = isEnabled
        ? `<span class="status-pill active">Active</span>`
        : `<span class="status-pill deactivated">Disabled</span>`;

      const actionBtn = isEnabled
        ? `<button class="btn-sm-action danger" onclick="toggleFeatureModule('${mod.key}', false, '${escapeHtml(mod.name)}')">Deactivate</button>`
        : `<button class="btn-sm-action success" onclick="toggleFeatureModule('${mod.key}', true, '${escapeHtml(mod.name)}')">Activate</button>`;

      return `
        <div class="feature-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                <span>${mod.icon}</span> <span>${escapeHtml(mod.name)}</span>
              </span>
              ${statusPill}
            </div>
            <p style="font-size: 0.82rem; color: #64748b; margin: 0; line-height: 1.4;">${escapeHtml(mod.description)}</p>
          </div>
          <div style="display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #f1f5f9;">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Failed to load platform features:", err);
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #dc2626;">Failed to load feature modules: ${escapeHtml(err.message)}</div>`;
  }
}

window.toggleFeatureModule = async function(key, enable, name) {
  const actionText = enable ? "activate" : "deactivate";
  if (!confirm(`Are you sure you want to ${actionText} the '${name}' module platform-wide?`)) return;

  try {
    await api.updateAdminSystemConfig({ [key]: enable });
    showToast(`Module '${name}' has been ${enable ? 'activated' : 'deactivated'}.`, "success");
    await loadPlatformFeatures();
  } catch (err) {
    showToast(err.message || `Failed to ${actionText} feature.`, "error");
  }
};


/**
 * Food Freshness Monitoring Platform - Central API Client & Utilities
 * Pure Vanilla JavaScript (Fetch API, JWT, Error Handling, Toasts)
 */

// ============================================================
// API CONFIGURATION
// ============================================================

const API_CONFIG = {
  BASE_URL: (() => {
    try {
      if (typeof window !== "undefined") {
        const proto = window.location.protocol;
        const port = window.location.port;

        // Opened directly as a local HTML file
        if (proto === "file:") {
          return "http://127.0.0.1:9000/api";
        }

        // Frontend served by FastAPI itself
        if (port === "9000") {
          return "/api";
        }

        // Frontend served separately (Live Server, etc.)
        return "http://127.0.0.1:9000/api";
      }
    } catch (e) {
      console.error("Could not determine API base URL:", e);
    }

    return "http://127.0.0.1:9000/api";
  })(),

  TOKEN_KEY: "food_freshness_token",
  USER_KEY: "food_freshness_user",
};

// ============================================================
// CENTRAL API CLIENT
// ============================================================

class ApiClient {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    console.info("Food Freshness API URL:", this.baseUrl);
  }

  // ----------------------------------------------------------
  // Token and Session Storage
  // ----------------------------------------------------------

  getToken() {
    return localStorage.getItem(API_CONFIG.TOKEN_KEY);
  }

  setToken(token) {
    localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
  }

  getUser() {
    try {
      const userStr = localStorage.getItem(API_CONFIG.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error("Unable to read stored user:", e);
      return null;
    }
  }

  setUser(user) {
    localStorage.setItem(API_CONFIG.USER_KEY, JSON.stringify(user));
  }

  clearSession() {
    try {
      localStorage.removeItem(API_CONFIG.TOKEN_KEY);
      localStorage.removeItem(API_CONFIG.USER_KEY);

      sessionStorage.removeItem(API_CONFIG.TOKEN_KEY);
      sessionStorage.removeItem(API_CONFIG.USER_KEY);
      sessionStorage.clear();

      if (typeof document !== "undefined" && document.cookie) {
        document.cookie.split(";").forEach((cookie) => {
          document.cookie =
            cookie.replace(/^ +/, "").replace(/=.*/, "") +
            "=;expires=" +
            new Date(0).toUTCString() +
            ";path=/";
        });
      }
    } catch (e) {
      console.warn("Error clearing authentication session:", e);
    }
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  requireAuth(returnUrl = null) {
    if (!this.isAuthenticated()) {
      let target = returnUrl;

      if (!target && typeof window !== "undefined") {
        const path = window.location.pathname || "";
        const search = window.location.search || "";
        const hash = window.location.hash || "";
        const full = path + search + hash;

        if (
          !path.includes("login.html") &&
          !path.includes("register.html") &&
          path !== "/" &&
          path !== ""
        ) {
          target = full;
        }
      }

      if (target) {
        try {
          sessionStorage.setItem("food_freshness_return_url", target);
        } catch (e) {
          console.warn("Could not save return_url to sessionStorage:", e);
        }
      }

      let loginUrl = "login.html";

      if (target) {
        loginUrl += `?redirect=${encodeURIComponent(target)}`;
      }

      window.location.href = loginUrl;
      return false;
    }

    return true;
  }

  sanitizeReturnUrl(url) {
    if (!url || typeof url !== "string") return null;
    let trimmed = url.trim();
    if (trimmed.startsWith("//")) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null;
    if (/[\r\n\t]/.test(trimmed)) return null;

    let clean = trimmed.split("?")[0].split("#")[0];
    if (clean.startsWith("/")) clean = clean.substring(1);
    if (clean.includes("..")) return null;

    const page = clean.split("/").pop().toLowerCase();
    if (!page || page === "index.html" || page === "login.html" || page === "register.html") {
      return null;
    }

    const validPages = [
      "inventory.html",
      "dashboard.html",
      "retailer-dashboard.html",
      "warehouse-dashboard.html",
      "dashboard-inspector.html",
      "admin-dashboard.html",
      "executive-dashboard.html",
      "reports.html",
      "profile.html",
      "add-food.html",
      "food-details.html",
      "freshness.html",
    ];

    if (validPages.includes(page) || page.endsWith(".html")) {
      return trimmed;
    }
    return null;
  }

  isPageAuthorizedForRole(targetUrl, role) {
    if (!targetUrl) return true;
    const clean = targetUrl.split("?")[0].split("#")[0].toLowerCase().trim();
    const page = clean.split("/").pop();
    const r = (role || "").toLowerCase().trim();

    const isAdmin = (r === "admin" || r === "administrator");
    if (isAdmin) return true;

    if (page === "admin-dashboard.html" || page === "executive-dashboard.html") {
      return isAdmin;
    }

    if (page === "dashboard-inspector.html") {
      return r.includes("inspector");
    }

    if (page === "retailer-dashboard.html") {
      return r.includes("retailer");
    }

    if (page === "warehouse-dashboard.html") {
      return (
        r.includes("warehouse") ||
        r.includes("supply chain") ||
        r.includes("manufacturer")
      );
    }

    if (page === "dashboard.html") {
      return r.includes("consumer") || r === "";
    }

    // Shared authenticated pages
    return true;
  }

  getSavedReturnUrl() {
    let target = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      target = params.get("redirect") || params.get("returnUrl") || params.get("return_url");
      if (!target) {
        try {
          target = sessionStorage.getItem("food_freshness_return_url");
        } catch (e) {}
      }
    }
    return this.sanitizeReturnUrl(target);
  }

  clearReturnUrl() {
    try {
      sessionStorage.removeItem("food_freshness_return_url");
    } catch (e) {}
  }

  getDashboardUrlForRole(role) {
    if (!role) return "dashboard.html";

    const r = role.trim();

    if (r === "Retailer") return "retailer-dashboard.html";

    if (
      r === "Food Quality Inspector" ||
      r === "Quality Inspector"
    ) {
      return "dashboard-inspector.html";
    }

    if (r === "Admin" || r === "Administrator" || r.toLowerCase().includes("admin")) {
      return "admin-dashboard.html";
    }

    if (
      r === "Warehouse Operator" ||
      r === "Warehouse Manager" ||
      r === "Supply Chain Operator" ||
      r === "Food Manufacturer"
    ) {
      return "warehouse-dashboard.html";
    }

    return "dashboard.html";
  }

  enforceRoleAccess(allowedRoles = []) {
    if (!this.requireAuth()) return false;

    const user = this.getUser();
    if (!user) return false;

    const normalizedAllowed = allowedRoles.map((role) =>
      role.toLowerCase().trim()
    );

    const userRole = (user.role || "").toLowerCase().trim();

    const isMatch = normalizedAllowed.some((allowed) => {
      if (allowed === userRole) return true;

      if (
        (allowed.includes("warehouse") || allowed.includes("manufacturer") || allowed.includes("supply chain")) &&
        (userRole.includes("warehouse") || userRole.includes("manufacturer") || userRole.includes("supply chain"))
      ) {
        return true;
      }

      if (
        allowed.includes("inspector") &&
        userRole.includes("inspector")
      ) {
        return true;
      }

      if (
        allowed.includes("admin") &&
        userRole.includes("admin")
      ) {
        return true;
      }

      if (
        allowed.includes("consumer") &&
        userRole.includes("consumer")
      ) {
        return true;
      }

      if (
        allowed.includes("retailer") &&
        userRole.includes("retailer")
      ) {
        return true;
      }

      return false;
    });

    if (!isMatch) {
      sessionStorage.setItem(
        "access_restricted_alert",
        `Access Restricted: Your account role (${user.role}) is assigned to your dedicated dashboard.`
      );

      const targetUrl = this.getDashboardUrlForRole(user.role);
      window.location.replace(targetUrl);

      return false;
    }

    return true;
  }

  // ----------------------------------------------------------
  // Core HTTP Request Method
  // ----------------------------------------------------------

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = { ...(options.headers || {}) };

    // Let the browser set the multipart boundary for FormData.
    if (
      typeof FormData === "undefined" ||
      !(options.body instanceof FormData)
    ) {
      headers["Content-Type"] = "application/json";
    } else {
      delete headers["Content-Type"];
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        this.clearSession();

        const path = window.location.pathname;

        if (
          !path.includes("login.html") &&
          !path.includes("register.html") &&
          path !== "/"
        ) {
          const target = encodeURIComponent(
            path + window.location.search + window.location.hash
          );

          window.location.href =
            `login.html?expired=true&redirect=${target}`;
        }

        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.detail || "Session expired. Please log in again."
        );
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMessage = "An unexpected error occurred.";

        if (data.detail) {
          if (Array.isArray(data.detail)) {
            errorMessage = data.detail
              .map((error) => {
                const location = error.loc
                  ? error.loc.join(".") + ": "
                  : "";

                return `${location}${error.msg}`;
              })
              .join(", ");
          } else {
            errorMessage = data.detail;
          }
        } else if (data.message) {
          errorMessage = data.message;
        }

        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error(
        `API Error [${options.method || "GET"}] ${url}:`,
        error
      );

      if (error instanceof TypeError) {
        throw new Error(
          `Cannot connect to the backend at ${this.baseUrl}. ` +
          "Check that FastAPI is running and CORS allows this frontend."
        );
      }

      throw error;
    }
  }

  // ----------------------------------------------------------
  // Authentication Endpoints
  // ----------------------------------------------------------

  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    const result = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (result.access_token) {
      this.setToken(result.access_token);

      if (result.user) {
        this.setUser(result.user);
      }
    }

    return result;
  }

  async getMe() {
    const user = await this.request("/auth/me");
    this.setUser(user);
    return user;
  }

  logout() {
    try {
      const token = this.getToken();

      if (token) {
        fetch(`${this.baseUrl}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("Logout request could not be sent:", e);
    }

    this.clearSession();
    window.location.href = "login.html?logged_out=true";
  }

  // ----------------------------------------------------------
  // Inventory Endpoints
  // ----------------------------------------------------------

  async getInventory(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "all"
      ) {
        query.append(key, value);
      }
    });

    const queryString = query.toString()
      ? `?${query.toString()}`
      : "";

    return this.request(`/inventory${queryString}`);
  }

  async getInventoryItem(id) {
    return this.request(`/inventory/${id}`);
  }

  async createInventoryItem(itemData) {
    return this.request("/inventory", {
      method: "POST",
      body: JSON.stringify(itemData),
    });
  }

  async updateInventoryItem(id, itemData) {
    return this.request(`/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(itemData),
    });
  }

  async deleteInventoryItem(id) {
    return this.request(`/inventory/${id}`, {
      method: "DELETE",
    });
  }

  async seedDatasetInventory() {
    return this.request("/inventory/seed-dataset", {
      method: "POST",
    });
  }

  async uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    return this.request("/inventory/upload-image", {
      method: "POST",
      body: formData,
    });
  }

  async uploadFoodImage(file) {
    return this.uploadImage(file);
  }

  // ----------------------------------------------------------
  // Freshness Analysis and Shelf Life
  // ----------------------------------------------------------

  async analyzeFreshness(data) {
    const payload = {
      inventory_id: data.inventory_id || data.item_id,
      image_url: data.image_url || undefined,
    };

    return this.request("/freshness/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async quickScanFood(formData) {
    const token = this.getToken();
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${this.baseUrl}/freshness/quick-scan`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "AI Quick Scan failed.");
    }

    return data;
  }

  async getFreshnessHistory(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/freshness/history${query ? `?${query}` : ""}`
    );
  }

  async getFreshnessRecord(recordId) {
    return this.request(`/freshness/history/${recordId}`);
  }

  async getStorageGuidelines() {
    return this.request("/freshness/storage-guidelines");
  }

  async simulateShelfLife(data) {
    return this.request("/shelf-life/simulate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getShelfLifeCommodities() {
    return this.request("/shelf-life/commodities");
  }

  // ----------------------------------------------------------
  // Dashboard Statistics and User Management
  // ----------------------------------------------------------

  async getDashboardStats() {
    return this.request("/dashboard/stats");
  }

  async getUsers() {
    return this.request("/users");
  }

  // ----------------------------------------------------------
  // Retailer API
  // ----------------------------------------------------------

  async getRetailerDashboard() {
    return this.request("/retailer/dashboard");
  }

  async getRetailerInventory(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/retailer/inventory${query ? `?${query}` : ""}`
    );
  }

  async createRetailerProduct(data) {
    return this.request("/retailer/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getRetailerProduct(id) {
    return this.request(`/retailer/inventory/${id}`);
  }

  async updateRetailerProduct(id, data) {
    return this.request(`/retailer/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async updateRetailerStock(id, data) {
    return this.request(`/retailer/inventory/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async archiveRetailerProduct(id, isArchived, reason = "") {
    return this.request(`/retailer/inventory/${id}/archive`, {
      method: "PATCH",
      body: JSON.stringify({
        is_archived: isArchived,
        reason,
      }),
    });
  }

  async deleteRetailerProduct(id) {
    return this.request(`/retailer/inventory/${id}`, {
      method: "DELETE",
    });
  }

  async analyzeRetailerProduct(id, imageUrl = null) {
    return this.request(`/retailer/inventory/${id}/analyze`, {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl }),
    });
  }

  async getRetailerExpiry(thresholdDays = 7) {
    return this.request(
      `/retailer/expiry?threshold_days=${thresholdDays}`
    );
  }

  async getRetailerShelfLife() {
    return this.request("/retailer/shelf-life");
  }

  async getRetailerAlerts(statusFilter = "Active") {
    return this.request(
      `/retailer/alerts?status_filter=${encodeURIComponent(statusFilter)}`
    );
  }

  async acknowledgeRetailerAlert(alertId, note = "") {
    return this.request(`/retailer/alerts/${alertId}/acknowledge`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    });
  }

  async getRetailerStorage() {
    return this.request("/retailer/storage");
  }

  async getRetailerWasteReduction() {
    return this.request("/retailer/waste-reduction");
  }

  async getRetailerAnalytics() {
    return this.request("/retailer/analytics");
  }

  async getRetailerReports(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/retailer/reports${query ? `?${query}` : ""}`
    );
  }

  async getRetailerNotifications() {
    return this.request("/retailer/notifications");
  }

  async markRetailerNotificationRead(notifId) {
    return this.request(`/retailer/notifications/${notifId}/read`, {
      method: "PATCH",
    });
  }

  async markAllRetailerNotificationsRead() {
    return this.request("/retailer/notifications/read-all", {
      method: "PATCH",
    });
  }

  // ----------------------------------------------------------
  // Food Quality Inspector API
  // ----------------------------------------------------------

  async getInspectorDashboard() {
    return this.request("/inspector/dashboard");
  }

  async getInspectorInspections(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/inspector/inspections${query ? `?${query}` : ""}`
    );
  }

  async createInspectorInspection(formData) {
    const token = this.getToken();
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!(formData instanceof FormData)) {
      return this.request("/inspector/inspections/json", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
    }

    const response = await fetch(
      `${this.baseUrl}/inspector/inspections`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

    if (response.status === 401) {
      this.clearSession();
      window.location.href = "login.html?expired=true";

      throw new Error("Session expired. Please log in again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail || "Inspection creation failed."
      );
    }

    return data;
  }

  async getInspectorInspection(id) {
    return this.request(`/inspector/inspections/${id}`);
  }

  async reviewInspectorInspection(id, data) {
    return this.request(`/inspector/inspections/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async flagInspectorInspection(id, data) {
    return this.request(`/inspector/inspections/${id}/flag`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getInspectorHistory(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/inspector/inspection-history${query ? `?${query}` : ""}`
    );
  }

  async getInspectorQualityAnalytics() {
    return this.request("/inspector/quality-analytics");
  }

  async getInspectorAlerts(status = "all") {
    return this.request(
      `/inspector/alerts?status=${encodeURIComponent(status)}`
    );
  }

  async resolveInspectorAlert(id, data) {
    return this.request(`/inspector/alerts/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getInspectorStorageReview(
    category,
    temp = null,
    humidity = null
  ) {
    let url =
      `/inspector/storage-review?category=${encodeURIComponent(category)}`;

    if (temp !== null && temp !== undefined) {
      url += `&temperature=${encodeURIComponent(temp)}`;
    }

    if (humidity !== null && humidity !== undefined) {
      url += `&humidity=${encodeURIComponent(humidity)}`;
    }

    return this.request(url);
  }

  // ----------------------------------------------------------
  // Platform Administrator API
  // ----------------------------------------------------------

  async getAdminDashboard() {
    return this.request("/admin/dashboard");
  }

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/admin/users${query ? `?${query}` : ""}`
    );
  }

  async getAdminUser(userId) {
    return this.request(`/admin/users/${userId}`);
  }

  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  async activateUser(userId, reason = null) {
    return this.request(`/admin/users/${userId}/activate`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", reason }),
    });
  }

  async deactivateUser(userId, reason = null) {
    return this.request(`/admin/users/${userId}/deactivate`, {
      method: "PATCH",
      body: JSON.stringify({ status: "deactivated", reason }),
    });
  }

  async getAdminAiStats() {
    return this.request("/admin/ai/statistics");
  }

  async getAdminAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/admin/audit-logs${query ? `?${query}` : ""}`
    );
  }

  async getAdminStorageRules() {
    return this.request("/admin/storage-rules");
  }

  async createAdminStorageRule(data) {
    return this.request("/admin/storage-rules", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAdminStorageRule(ruleId, data) {
    return this.request(`/admin/storage-rules/${ruleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteAdminStorageRule(ruleId) {
    return this.request(`/admin/storage-rules/${ruleId}`, {
      method: "DELETE",
    });
  }

  async getAdminSystemHealth() {
    return this.request("/admin/system/health");
  }

  async getAdminSystemConfig() {
    return this.request("/admin/system/config");
  }

  async updateAdminSystemConfig(data) {
    return this.request("/admin/system/config", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getAdminAnalytics() {
    return this.request("/admin/reports/analytics");
  }

  async downloadUsersCsv() {
    const token = this.getToken();
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${this.baseUrl}/admin/reports/export-csv`,
      { headers }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.detail || "Failed to download users CSV export."
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `users_export_${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  // Warehouse and Cold-Chain Logistics API
  // ----------------------------------------------------------

  async getWarehouseDashboard() {
    return this.request("/warehouse/dashboard");
  }

  async getWarehouseZones() {
    return this.request("/warehouse/zones");
  }

  async getWarehouseZone(zoneId) {
    return this.request(`/warehouse/zones/${zoneId}`);
  }

  async getWarehouseZoneTelemetry(zoneId) {
    return this.request(`/warehouse/zones/${zoneId}/temperature`);
  }

  async getWarehouseZoneHistory(zoneId, hours = 24) {
    return this.request(
      `/warehouse/zones/${zoneId}/temperature/history?hours=${hours}`
    );
  }

  async submitWarehouseTemperatureCommand(
    zoneId,
    requestedTemperature,
    reason,
    forceOverride = false
  ) {
    return this.request(
      `/warehouse/zones/${zoneId}/temperature/commands`,
      {
        method: "POST",
        body: JSON.stringify({
          requested_temperature: parseFloat(requestedTemperature),
          reason,
          force_override: forceOverride,
        }),
      }
    );
  }

  async getWarehouseCommandStatus(commandId) {
    return this.request(
      `/warehouse/temperature/commands/${commandId}`
    );
  }

  async getWarehouseAlerts(zoneId = null, severity = null) {
    const params = new URLSearchParams();

    if (zoneId) params.append("zone_id", zoneId);
    if (severity) params.append("severity", severity);

    const query = params.toString();

    return this.request(
      `/warehouse/alerts${query ? `?${query}` : ""}`
    );
  }

  async getWarehouseAuditLogs(limit = 50) {
    return this.request(`/warehouse/audit-logs?limit=${limit}`);
  }

  // ----------------------------------------------------------
  // User Profile Management
  // ----------------------------------------------------------

  async getExtendedProfile() {
    return this.request("/users/profile/me");
  }

  async updateProfile(data) {
    const response = await this.request("/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (response.user) {
      const existing = this.getUser() || {};
      this.setUser({ ...existing, ...response.user });
    }

    return response;
  }

  async changePassword(
    currentPassword,
    newPassword,
    confirmNewPassword
  ) {
    return this.request("/users/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      }),
    });
  }

  // ----------------------------------------------------------
  // Reports and Exports
  // ----------------------------------------------------------

  async getFreshnessReport(category = null) {
    return this.request(
      `/reports/freshness${category ? `?category=${encodeURIComponent(category)}` : ""}`
    );
  }

  async getShelfLifeReport(category = null) {
    return this.request(
      `/reports/shelf-life${category ? `?category=${encodeURIComponent(category)}` : ""}`
    );
  }

  async getInventoryQualityReport(category = null) {
    return this.request(
      `/reports/inventory-quality${category ? `?category=${encodeURIComponent(category)}` : ""}`
    );
  }

  async getWasteReductionReport(category = null) {
    return this.request(
      `/reports/waste-reduction${category ? `?category=${encodeURIComponent(category)}` : ""}`
    );
  }

  async getStorageComplianceReport(category = null) {
    return this.request(
      `/reports/storage-compliance${category ? `?category=${encodeURIComponent(category)}` : ""}`
    );
  }

  // ----------------------------------------------------------
  // Notifications and Unified Alerts
  // ----------------------------------------------------------

  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/notifications${query ? `?${query}` : ""}`
    );
  }

  async getUnreadNotificationsCount() {
    return this.request("/notifications/unread-count");
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: "POST",
    });
  }

  async markAllNotificationsRead() {
    return this.request("/notifications/read-all", {
      method: "POST",
    });
  }

  async getUnifiedAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/alerts${query ? `?${query}` : ""}`
    );
  }

  async getAlertsSummary() {
    return this.request("/alerts/summary");
  }

  async acknowledgeUnifiedAlert(id) {
    return this.request(`/alerts/${id}/acknowledge`, {
      method: "POST",
    });
  }
}

// ============================================================
// GLOBAL API INSTANCE
// ============================================================

const api = new ApiClient();

// ============================================================
// UI NOTIFICATION TOAST SYSTEM
// ============================================================

function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-message">${escapeHtml(message)}</div>
    <button
      style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;"
      aria-label="Close notification"
      onclick="this.parentElement.remove()"
    >&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ============================================================
// BUTTON LOADING STATE
// ============================================================

function setButtonLoading(button, isLoading, originalHtml) {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.original = button.innerHTML;
    button.innerHTML =
      '<span class="spinner"></span> <span>Processing...</span>';
  } else {
    button.disabled = false;
    button.innerHTML =
      button.dataset.original || originalHtml || "Submit";
  }
}

// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHtml(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// PROFESSIONAL SVG ICON DICTIONARY
// ============================================================

const SVG_ICONS = {
  "🌱": `<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  "📊": `<svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  "🏭": `<svg viewBox="0 0 24 24"><path d="M3 21h18M3 7v14M21 7v14M9 3v4M15 3v4M4 7h16M9 11v10M15 11v10"/></svg>`,
  "🏪": `<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  "🔬": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  "📈": `<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  "📦": `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  "➕": `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  "📋": `<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  "🛡️": `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  "👤": `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  "🚪": `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  "⚡": `<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  "🧮": `<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>`,
  "🌡️": `<svg viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  "⏳": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  "⚠️": `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  "⚖️": `<svg viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  "🤖": `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/></svg>`,
  "☣️": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  "🔍": `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  "⭐": `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  "🎯": `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  "📉": `<svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`
};

// ============================================================
// REPLACE EMOJIS WITH SVG ICONS
// ============================================================

function replaceEmojisWithSvg(rootNode = document.body) {
  if (!rootNode) return;

  const elements = rootNode.querySelectorAll(
    ".stat-icon, .nav-item span, .brand-icon, " +
    ".action-pill-btn span, .quick-action-btn span, " +
    ".telemetry-label span"
  );

  elements.forEach((element) => {
    const value = element.textContent.trim();

    if (SVG_ICONS[value]) {
      element.innerHTML =
        `<span class="svg-icon">${SVG_ICONS[value]}</span>`;
    }
  });
}

// ============================================================
// ANIMATED NUMBER COUNTER
// ============================================================

function animateCounter(element, target, duration = 800) {
  if (!element) return;

  const targetNum = parseFloat(target);

  if (Number.isNaN(targetNum)) {
    element.textContent = target;
    return;
  }

  const isFloat = String(target).includes(".");
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const ease =
      progress === 1
        ? 1
        : 1 - Math.pow(2, -10 * progress);

    const current = ease * targetNum;

    element.textContent = isFloat
      ? current.toFixed(1)
      : Math.round(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = isFloat
        ? targetNum.toFixed(1)
        : String(targetNum);
    }
  }

  requestAnimationFrame(update);
}

// ============================================================
// ROLE-BASED NAVIGATION
// ============================================================

function filterNavigationByRole(userRole) {
  if (!userRole) return;

  const role = userRole.trim();
  const allowedDashboard = api.getDashboardUrlForRole(role);

  const roleDashboardFiles = [
    "dashboard.html",
    "warehouse-dashboard.html",
    "retailer-dashboard.html",
    "dashboard-inspector.html",
    "admin-dashboard.html",
    "executive-dashboard.html",
  ];

  document.querySelectorAll("a[href]").forEach((link) => {
    const rawHref = link.getAttribute("href") || "";
    const cleanHref = rawHref.split("?")[0].split("#")[0].trim();

    const matchedFile = roleDashboardFiles.find(
      (file) =>
        cleanHref === file ||
        cleanHref.endsWith("/" + file)
    );

    if (!matchedFile) return;

    const isAdmin =
      role.toLowerCase() === "admin" ||
      role.toLowerCase() === "administrator";

    const isAllowed =
      matchedFile === allowedDashboard ||
      (isAdmin && matchedFile === "executive-dashboard.html");

    if (isAllowed) {
      link.style.display = "";
    } else if (
      matchedFile === "dashboard.html" &&
      (
        link.textContent.toLowerCase().includes("overview") ||
        link.textContent.toLowerCase().includes("dashboard") ||
        link.classList.contains("nav-dashboard-link")
      )
    ) {
      link.setAttribute("href", allowedDashboard);
    } else {
      const parentLi = link.closest("li");

      if (parentLi) {
        parentLi.remove();
      } else {
        link.remove();
      }
    }
  });

  document
    .querySelectorAll(".nav-section-title, .sidebar-section-title")
    .forEach((title) => {
      let nextElement = title.nextElementSibling;
      let hasItems = false;

      while (
        nextElement &&
        !nextElement.matches(
          ".nav-section-title, .sidebar-section-title"
        )
      ) {
        if (
          nextElement.matches("a, li, div.nav-item") &&
          nextElement.style.display !== "none"
        ) {
          hasItems = true;
          break;
        }

        nextElement = nextElement.nextElementSibling;
      }

      if (!hasItems) {
        title.style.display = "none";
      }
    });
}

// ============================================================
// COMMON LAYOUT INITIALIZER
// ============================================================

function initCommonLayout() {
  const currentUser = api.getUser();

  if (currentUser) {
    const userNameElements = document.querySelectorAll(
      ".user-display-name, #sidebar-user-name, #topbar-user-name"
    );

    const userRoleElements = document.querySelectorAll(
      ".user-role-badge, #operator-role-pill, #topbar-role-badge"
    );

    const userAvatarElements = document.querySelectorAll(
      ".user-avatar, #sidebar-user-avatar, #topbar-avatar"
    );

    userNameElements.forEach((element) => {
      element.textContent = currentUser.name || "User";
    });

    userRoleElements.forEach((element) => {
      element.textContent = currentUser.role || "Consumer";
    });

    userAvatarElements.forEach((element) => {
      element.textContent =
        (currentUser.name || "U").charAt(0).toUpperCase();
    });

    filterNavigationByRole(currentUser.role);
  }

  const alertMessage = sessionStorage.getItem(
    "access_restricted_alert"
  );

  if (alertMessage) {
    sessionStorage.removeItem("access_restricted_alert");

    if (typeof showToast === "function") {
      showToast(alertMessage, "warning");
    }
  }

  const mobileButton = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".sidebar");

  if (mobileButton && sidebar) {
    mobileButton.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  document
    .querySelectorAll(".btn-logout, a[href='#logout']")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        api.logout();
      });
    });

  replaceEmojisWithSvg();
}

// ============================================================
// INITIALIZATION
// ============================================================

function bootApiCommon() {
  if (api.isAuthenticated()) {
    initCommonLayout();
  } else {
    replaceEmojisWithSvg();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApiCommon);
} else {
  bootApiCommon();
}

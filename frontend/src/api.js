import { resolveApiBaseUrl } from "./apiBase.js";

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV,
);

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    let msg = "Request failed";
    if (typeof data.detail === "string") {
      msg = data.detail;
    } else if (Array.isArray(data.detail)) {
      msg = data.detail.map((err) => `${err.loc?.slice(1).join(" ") || "field"}: ${err.msg}`).join("; ");
    }
    throw new Error(msg);
  }
  return data;
}

export function register(body) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export function login(body) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export function getInventory(token) {
  return request("/inventory", { headers: { Authorization: `Bearer ${token}` } });
}

export function addFood(token, body) {
  return request("/inventory", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export function deleteFood(token, id) {
  return request(`/inventory/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateFood(token, id, body) {
  return request(`/inventory/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export function updateProfile(token, body) {
  return request("/auth/me", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

// ── M2: Freshness Analysis ────────────────────────────────────────────────

export async function analyzeFoodImage(token, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/analysis/predict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    // Do NOT set Content-Type — browser sets it automatically with boundary
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    let msg = "Analysis failed";
    if (typeof data.detail === "string") msg = data.detail;
    else if (Array.isArray(data.detail))
      msg = data.detail.map((e) => e.msg).join("; ");
    throw new Error(msg);
  }
  return data;
}

export function getAnalysisHistory(token) {
  return request("/analysis/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAnalysisTrends(token, days = 30) {
  return request(`/analysis/trends?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function downloadAnalysisReport(token, analysisId) {
  const response = await fetch(`${API_BASE_URL}/analysis/${analysisId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    let msg = "Failed to download report";
    if (typeof data.detail === "string") msg = data.detail;
    throw new Error(msg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FreshGuard_Report_${analysisId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function analyzeM2Image(token, file, category, foodSubtype, itemName) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("declared_category", category);
  if (foodSubtype?.trim()) formData.append("food_subtype", foodSubtype.trim());
  if (itemName?.trim()) formData.append("item_name", itemName.trim());

  const response = await fetch(`${API_BASE_URL}/analysis/v2/predict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === "string"
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map((entry) => entry.msg).join("; ")
        : "M2 analysis failed";
    throw new Error(message);
  }
  return data;
}

export function getM2AnalysisHistory(token, limit = 50) {
  return request(`/analysis/v2/history?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getM2AnalysisTrends(token, days = 30) {
  return request(`/analysis/v2/trends?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function assessM2Defect(token, file, category, defectType, targetSurface) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("declared_category", category);
  if (targetSurface) formData.append("target_surface", targetSurface);

  const response = await fetch(`${API_BASE_URL}/analysis/v2/defects/${defectType}/predict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === "string"
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map((entry) => entry.msg).join("; ")
        : "Defect workflow failed";
    throw new Error(message);
  }
  return data;
}

export async function downloadM2AssessmentReport(token, analysisId) {
  const response = await fetch(`${API_BASE_URL}/analysis/v2/${analysisId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Failed to download M2 report");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `FreshGuard_M2_Report_${analysisId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

// ── M3: Shelf-life, storage, and analytics ───────────────────────────────


export function createShelfLifePrediction(token, body) {
  return request("/m3/shelf-life/predict", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export function getShelfLifeHistory(token) {
  return request("/m3/shelf-life/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getM3Analytics(token, days = 7) {
  return request(`/m3/analytics?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getM3Recommendations(token, predictionId) {
  return request(`/m3/recommendations/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// C2: Storage condition history
export function getStorageConditions(token) {
  return request("/m3/storage-conditions", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// C3: Expiring-soon inventory items (days=1–365, default 7)
export function getExpiringSoon(token, days = 7) {
  return request(`/inventory/expiring-soon?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── M4: Role-based dashboards ─────────────────────────────────────────────

export function getDashboardData(token) {
  return request("/dashboard/data", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAdminUsers(token) {
  return request("/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAdminStats(token) {
  return request("/admin/stats", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── M4: Notifications ─────────────────────────────────────────────────────

export function getNotifications(token) {
  return request("/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getUnreadCount(token) {
  return request("/notifications/unread", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function markNotificationRead(token, notificationId) {
  return request(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function markAllNotificationsRead(token) {
  return request("/notifications/read-all", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function generateNotifications(token) {
  return request("/notifications/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── M4: Reports & Exports ─────────────────────────────────────────────────

export async function downloadReport(token, endpoint, filename) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    let msg = "Failed to download report";
    if (typeof data.detail === "string") msg = data.detail;
    throw new Error(msg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function viewReportPdf(token, endpoint) {
  const reportWindow = window.open("about:blank", "_blank");
  if (!reportWindow) {
    throw new Error("Allow pop-ups to view the report, or use the PDF download button.");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    let msg = "Failed to load report";
    if (typeof data.detail === "string") msg = data.detail;
    reportWindow.close();
    throw new Error(msg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  reportWindow.location.href = url;
  reportWindow.addEventListener("beforeunload", () => window.URL.revokeObjectURL(url), { once: true });
}

export const reportEndpoints = {
  freshness: {
    pdf: "/reports/freshness/pdf",
    excel: "/reports/freshness/excel",
  },
  shelfLife: {
    pdf: "/reports/shelf-life/pdf",
    excel: "/reports/shelf-life/excel",
  },
  inventory: {
    pdf: "/reports/inventory/pdf",
    excel: "/reports/inventory/excel",
  },
  wasteReduction: {
    pdf: "/reports/waste-reduction/pdf",
    excel: "/reports/waste-reduction/excel",
  },
  storageCompliance: {
    pdf: "/reports/storage-compliance/pdf",
    excel: "/reports/storage-compliance/excel",
  },
};

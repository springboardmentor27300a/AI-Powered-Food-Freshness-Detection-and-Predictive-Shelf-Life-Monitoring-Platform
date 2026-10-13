// Shared API client and formatting helpers (Milestones 1-4).

// API base URL: configurable via VITE_API_BASE_URL (Vite env variable).
// Defaults to the local development server.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function getToken() {
  return localStorage.getItem('token');
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseError(response) {
  let detail = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    detail = body.detail || JSON.stringify(body);
  } catch {
    /* response had no JSON body */
  }
  const error = new Error(detail);
  error.status = response.status;
  return error;
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function apiPatch(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function apiDelete(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

// Multipart upload (scan images). Auth header attached; do NOT set Content-Type manually.
export async function apiUpload(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

// Authenticated file download (PDF / Excel exports). Fetches with the Bearer
// token and triggers a browser download of the returned blob.
export async function apiDownload(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ------------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------------

export const riskColors = {
  Low: '#16a34a',
  Medium: '#eab308',
  High: '#f97316',
  Critical: '#ef4444',
};

export const complianceColors = {
  Compliant: '#16a34a',
  'Partially Compliant': '#eab308',
  'Non-Compliant': '#ef4444',
  Unknown: '#9ca3af',
};

export function riskColor(level) {
  return riskColors[level] || '#9ca3af';
}

export function formatDays(days) {
  if (days === null || days === undefined) return 'N/A';
  if (days <= 0) return 'Expired';
  if (days < 1) return '<1 day';
  if (days === 1) return '1 day';
  if (days < 14) return `${Math.round(days)} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

export function formatDate(iso) {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function imageUrl(imageUrlPath) {
  if (!imageUrlPath) return null;
  // Scan images are protected; <img> tags cannot send headers, so the signed
  // token is passed as a query parameter.
  const token = getToken();
  const sep = imageUrlPath.includes('?') ? '&' : '?';
  return `${API_BASE}${imageUrlPath}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

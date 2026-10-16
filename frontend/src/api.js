export const API_URL = "http://127.0.0.1:8000";

// ============================================================
// ROLE NORMALIZATION
// ============================================================

export const ROLE_ALIASES = {
  "admin": "Administrator",
  "administrator": "Administrator",
  "consumer": "Consumer",
  "retail manager": "Retail Manager",
  "warehouse operator": "Warehouse Operator",
  "food quality inspector": "Food Quality Inspector",
};

export const normalizeRole = (role) => {
  if (!role) return "Consumer";
  const cleaned = String(role).trim();
  return ROLE_ALIASES[cleaned.toLowerCase()] || cleaned;
};

// ============================================================
// TOKEN AND AUTH STORAGE
// ============================================================

export const getAuthToken = () => {
  let token = localStorage.getItem("access_token") || localStorage.getItem("token");

  if (!token) {
    return null;
  }

  token = token.trim();

  // Remove Bearer if it was accidentally stored with the token
  if (token.startsWith("Bearer ")) {
    token = token.substring(7).trim();
  }

  return token;
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.role) {
      parsed.role = normalizeRole(parsed.role);
    }
    return parsed;
  } catch {
    return null;
  }
};

export const setStoredAuth = (token, user) => {
  if (token) {
    localStorage.setItem("access_token", token.trim());
  }
  if (user) {
    const normalized = {
      ...user,
      role: normalizeRole(user.role)
    };
    localStorage.setItem("user", JSON.stringify(normalized));
    return normalized;
  }
  return null;
};

export const clearStoredAuth = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// ============================================================
// COMMON API FETCH
// ============================================================

export const apiFetch = async (
  endpoint,
  options = {}
) => {
  const token = getAuthToken();

  const headers = {
    ...(options.headers || {})
  };

  // JSON requests (Do NOT set Content-Type for FormData)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] =
      headers["Content-Type"] ||
      "application/json";
  }

  // Add JWT authentication if available and not already provided
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers
    }
  );
};

// ============================================================
// AUTHENTICATION API HELPERS
// ============================================================

export const loginUser = async (email, password) => {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Login failed");
  }

  return data;
};

export const registerUser = async ({ name, email, password, role }) => {
  const normalizedRole = normalizeRole(role);

  const response = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      role: normalizedRole,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Registration failed");
  }

  return data;
};

export const fetchCurrentUser = async (explicitToken = null) => {
  const token = explicitToken || getAuthToken();

  if (!token) {
    throw new Error("No authentication token available");
  }

  const response = await apiFetch("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Failed to validate user session");
  }

  if (data?.role) {
    data.role = normalizeRole(data.role);
  }

  return data;
};

// ============================================================
// FOOD IMAGE ANALYSIS
// ============================================================

export const analyzeFoodImage = async (
  file
) => {
  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  const token = getAuthToken();
  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/analyze`,
    {
      method: "POST",
      headers,
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Food analysis failed"
    );
  }

  return data;
};

// ============================================================
// SHELF LIFE PREDICTION
// ============================================================

export const predictShelfLife = async ({
  category,
  freshnessScore,
  storageTemperature,
  humidity,
  packagingType,
  purchaseDate,
  expiryDate
}) => {
  const token = getAuthToken();

  const params = new URLSearchParams();

  params.append(
    "category",
    category
  );

  params.append(
    "freshness_score",
    freshnessScore
  );

  if (
    storageTemperature !== "" &&
    storageTemperature !== null &&
    storageTemperature !== undefined
  ) {
    params.append(
      "storage_temperature",
      storageTemperature
    );
  }

  if (
    humidity !== "" &&
    humidity !== null &&
    humidity !== undefined
  ) {
    params.append(
      "humidity",
      humidity
    );
  }

  if (
    packagingType !== "" &&
    packagingType !== null &&
    packagingType !== undefined
  ) {
    params.append(
      "packaging_type",
      packagingType
    );
  }

  if (
    purchaseDate !== "" &&
    purchaseDate !== null &&
    purchaseDate !== undefined
  ) {
    params.append(
      "purchase_date",
      purchaseDate
    );
  }

  if (
    expiryDate !== "" &&
    expiryDate !== null &&
    expiryDate !== undefined
  ) {
    params.append(
      "expiry_date",
      expiryDate
    );
  }

  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/shelf-life/predict?${params.toString()}`,
    {
      method: "POST",
      headers
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Shelf-life prediction failed"
    );
  }

  return data;
};
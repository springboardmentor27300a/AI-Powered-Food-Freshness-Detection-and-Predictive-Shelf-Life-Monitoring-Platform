export const PRODUCTION_API_BASE_URL = "https://freshguard-api-mp6c.onrender.com";

export function resolveApiBaseUrl(configuredUrl, isDevelopment) {
  const baseUrl = configuredUrl || (
    isDevelopment ? "http://127.0.0.1:8000" : PRODUCTION_API_BASE_URL
  );
  return baseUrl.trim().replace(/\/+$/, "");
}

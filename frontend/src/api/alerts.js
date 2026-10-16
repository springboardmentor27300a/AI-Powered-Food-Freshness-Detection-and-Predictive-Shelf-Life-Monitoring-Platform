import api from "./axios";

// Aggregate alerts across the current user's whole inventory.
export async function getMyAlerts() {
  const response = await api.get("/api/alerts");
  return response.data;
}

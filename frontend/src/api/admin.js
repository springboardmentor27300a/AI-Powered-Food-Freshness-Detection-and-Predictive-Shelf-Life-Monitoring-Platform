import api from "./axios";

// Administrator-only platform statistics.
export async function getAdminStats() {
  const response = await api.get("/api/admin/stats");
  return response.data;
}

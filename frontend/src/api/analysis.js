import api from "./axios";

// Combined shelf-life, health score, recommendations, and alerts for
// one inventory item (Milestone 3).
export async function getItemAnalysis(inventoryId) {
  const response = await api.get(`/api/inventory/${inventoryId}/analysis`);
  return response.data;
}

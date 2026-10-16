import api from "./axios";

export async function recordStorageCondition(inventoryId, payload) {
  const response = await api.post(
    `/api/inventory/${inventoryId}/storage-conditions`,
    payload
  );
  return response.data;
}

export async function getStorageConditionHistory(inventoryId) {
  const response = await api.get(`/api/inventory/${inventoryId}/storage-conditions`);
  return response.data;
}

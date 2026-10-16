import api from "./axios";

export async function getInventory() {
  const response = await api.get("/api/inventory");
  return response.data;
}

export async function createInventory(data) {
  const response = await api.post("/api/inventory", data);
  return response.data;
}

export async function updateInventory(id, data) {
  const response = await api.patch(`/api/inventory/${id}`, data);
  return response.data;
}

export async function deleteInventory(id) {
  await api.delete(`/api/inventory/${id}`);
}
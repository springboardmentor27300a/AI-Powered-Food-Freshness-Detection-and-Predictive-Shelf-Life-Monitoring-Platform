import client from "./client";

export async function listFoodItems(params = {}) {
  const res = await client.get("/food", { params });
  return res.data;
}

export async function getFoodItem(id) {
  const res = await client.get(`/food/${id}`);
  return res.data;
}

export async function createFoodItem(payload) {
  const res = await client.post("/food", payload);
  return res.data;
}

export async function updateFoodItem(id, payload) {
  const res = await client.put(`/food/${id}`, payload);
  return res.data;
}

export async function deleteFoodItem(id) {
  await client.delete(`/food/${id}`);
}

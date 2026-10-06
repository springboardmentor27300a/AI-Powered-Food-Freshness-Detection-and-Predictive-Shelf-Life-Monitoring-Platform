import client from "./client";

export async function listBatches(params = {}) {
  const res = await client.get("/batches", { params });
  return res.data;
}

export async function getBatch(id) {
  const res = await client.get(`/batches/${id}`);
  return res.data;
}

export async function createBatch(payload) {
  const res = await client.post("/batches", payload);
  return res.data;
}

export async function updateBatch(id, payload) {
  const res = await client.put(`/batches/${id}`, payload);
  return res.data;
}

export async function deleteBatch(id) {
  await client.delete(`/batches/${id}`);
}

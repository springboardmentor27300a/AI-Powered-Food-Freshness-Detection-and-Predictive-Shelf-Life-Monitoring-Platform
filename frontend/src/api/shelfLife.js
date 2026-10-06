import client from "./client";

export async function estimateShelfLife(batchId) {
  const res = await client.post(`/shelf-life/batch/${batchId}/estimate`);
  return res.data;
}

export async function getShelfLifeHistory(batchId) {
  const res = await client.get(`/shelf-life/batch/${batchId}`);
  return res.data;
}

export async function getLatestShelfLife(batchId) {
  const res = await client.get(`/shelf-life/batch/${batchId}/latest`);
  return res.data;
}

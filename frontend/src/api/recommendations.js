import client from "./client";

export async function listRecommendations(batchId) {
  const res = await client.get(`/recommendations/batch/${batchId}`);
  return res.data;
}

export async function generateRecommendations(batchId) {
  const res = await client.post(`/recommendations/batch/${batchId}/generate`);
  return res.data;
}

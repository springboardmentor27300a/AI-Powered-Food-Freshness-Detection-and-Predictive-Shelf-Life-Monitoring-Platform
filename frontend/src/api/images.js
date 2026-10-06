import client from "./client";

export async function getModelStatus() {
  const res = await client.get("/images/model-status");
  return res.data;
}

export async function uploadImage(batchId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.post(`/images/upload?batch_id=${batchId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function analyzeImage(imageId) {
  const res = await client.post(`/images/${imageId}/analyze`);
  return res.data;
}

export async function listImagesForBatch(batchId) {
  const res = await client.get(`/images/batch/${batchId}`);
  return res.data;
}

export async function getImage(imageId) {
  const res = await client.get(`/images/${imageId}`);
  return res.data;
}

export function imageUrl(relativeUrl) {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api$/, "");
  return `${base}${relativeUrl}`;
}

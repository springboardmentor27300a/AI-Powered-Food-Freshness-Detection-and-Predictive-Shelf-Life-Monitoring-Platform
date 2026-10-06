import client from "./client";

export async function addStorageReading(payload) {
  const res = await client.post("/storage/readings", payload);
  return res.data;
}

export async function listStorageReadings(params = {}) {
  const res = await client.get("/storage/readings", { params });
  return res.data;
}

export async function getStorageTrends(storageLocation, days = 7) {
  const res = await client.get("/storage/trends", { params: { storage_location: storageLocation, days } });
  return res.data;
}
export async function getStorageAlerts() {
  const res = await client.get("/storage/alerts");
  return res.data;
}
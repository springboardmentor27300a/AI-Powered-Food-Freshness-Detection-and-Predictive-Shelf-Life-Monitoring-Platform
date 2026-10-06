import client from "./client";

export async function getInventoryAnalytics() {
  const res = await client.get("/analytics/inventory");
  return res.data;
}

export async function getFreshnessAnalytics() {
  const res = await client.get("/analytics/freshness");
  return res.data;
}

export async function getStorageAnalytics() {
  const res = await client.get("/analytics/storage");
  return res.data;
}

export async function getPlatformAnalytics() {
  const res = await client.get("/analytics/platform");
  return res.data;
}

import client from "./client";

export async function getInventorySummary() {
  const res = await client.get("/inventory/summary");
  return res.data;
}

export async function getInventory(limit = 50) {
  const res = await client.get("/inventory", { params: { limit } });
  return res.data;
}

import client from "./client";

export async function listUsers() {
  const res = await client.get("/admin/users");
  return res.data;
}

export async function updateUserRole(userId, role) {
  const res = await client.put(`/admin/users/${userId}/role`, { role });
  return res.data;
}

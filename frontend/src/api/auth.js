import client from "./client";

export async function login(username, password) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const res = await client.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data; // { access_token, token_type }
}

export async function register(payload) {
  const res = await client.post("/auth/register", payload);
  return res.data;
}

export async function fetchMe() {
  const res = await client.get("/auth/me");
  return res.data;
}

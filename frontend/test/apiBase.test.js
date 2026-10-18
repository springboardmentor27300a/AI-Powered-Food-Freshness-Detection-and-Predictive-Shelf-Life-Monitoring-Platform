import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from "../src/apiBase.js";

test("uses the configured API origin without trailing slashes", () => {
  assert.equal(
    resolveApiBaseUrl("https://freshguard-api-mp6c.onrender.com///", false),
    "https://freshguard-api-mp6c.onrender.com",
  );
});

test("uses the local API only for development when no URL is configured", () => {
  assert.equal(resolveApiBaseUrl(undefined, true), "http://127.0.0.1:8000");
});

test("uses the production API as a safe fallback for production builds", () => {
  assert.equal(
    resolveApiBaseUrl(undefined, false),
    "https://freshguard-api-mp6c.onrender.com",
  );
  assert.equal(PRODUCTION_API_BASE_URL, "https://freshguard-api-mp6c.onrender.com");
});

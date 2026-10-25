import test from "node:test";
import assert from "node:assert/strict";
import { apiEndpoint } from "../apps/web/lib/api/endpoint";

test("Vercel endpoints require an explicit HTTPS API project and reject self proxies and old hosting", () => {
  const env = {
    VERCEL: "1",
    VERCEL_URL: "club-web.vercel.app",
    PUBLIC_ORIGIN: "https://club-web.vercel.app",
  };
  assert.equal(
    apiEndpoint({ ...env, API_ORIGIN: "https://club-api.vercel.app" }),
    "https://club-api.vercel.app/api/v1",
  );
  for (const API_ORIGIN of [
    undefined,
    "http://club-api.vercel.app",
    "https://club-web.vercel.app",
    "https://fc-ordabasy-api.onrender.com",
    "https://127.0.0.1",
    "https://a.vercel.app@localhost",
  ])
    assert.throws(() => apiEndpoint({ ...env, API_ORIGIN }));
});

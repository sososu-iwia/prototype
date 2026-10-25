import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

// A native framework Function imports its entrypoint; require.main is not set
// to the user module. It must start bootstrap and fail closed before listening
// when required database configuration is absent.
test("Vercel module loading bootstraps the API without require.main", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", "require('./apps/api/src/main.ts')"],
    {
      env: {
        ...process.env,
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL: "",
        TSX_TSCONFIG_PATH: "apps/api/tsconfig.json",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /API startup failed/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { apiEndpoint, apiFetchTimeout } from "../apps/web/lib/api/endpoint";
import {
  checkDatabase,
  runtimeDatabaseUrl,
  expectedMigrations,
} from "../scripts/render-check.mjs";
import { readUpload, uploadImage, deleteMedia } from "../apps/api/src/storage";
import type { AuthRequest } from "../apps/api/src/auth";

test("Render uses one HTTPS API origin for rewrites, SSR and admin without proxy loops", () => {
  const env = {
    NODE_ENV: "production",
    RENDER: "true",
    API_ORIGIN: "https://api.example",
    PUBLIC_ORIGIN: "https://club.example",
  } as const;
  assert.equal(apiEndpoint(env), "https://api.example/api/v1");
  assert.equal(
    apiEndpoint({
      ...env,
      API_ORIGIN: undefined,
      API_INTERNAL_URL: "https://api.example/api/v1/",
    }),
    "https://api.example/api/v1",
  );
  for (const API_INTERNAL_URL of [
    "http://api:4000/api/v1",
    "https://club.example/api/v1",
    "https://user:secret@api.example/api/v1",
    "https://api.example/api/v1?token=secret",
    "https://api.example/wrong",
  ])
    assert.throws(() =>
      apiEndpoint({ ...env, API_ORIGIN: undefined, API_INTERNAL_URL }),
    );
  assert.equal(apiFetchTimeout(env), 70000);
  assert.equal(apiFetchTimeout({ NODE_ENV: "test" }), 3500);
  assert.equal(
    apiFetchTimeout({ ...env, API_FETCH_TIMEOUT_MS: "80000" }),
    80000,
  );
  for (const API_FETCH_TIMEOUT_MS of ["NaN", "0", "999999"])
    assert.throws(() => apiFetchTimeout({ ...env, API_FETCH_TIMEOUT_MS }));
});

test("Render runtime URL uses only the DML role and encodes credentials", () => {
  const url = new URL(
    runtimeDatabaseUrl({
      DB_HOST: "db.internal",
      DB_PORT: "5432",
      DB_NAME: "ordabasy_demo",
      APP_DB_USER: "ordabasy_app",
      APP_DB_PASSWORD: "fixture @:/&?#",
    }),
  );
  assert.equal(url.username, "ordabasy_app");
  assert.equal(decodeURIComponent(url.password), "fixture @:/&?#");
  assert.equal(url.hostname, "db.internal");
  assert.equal(url.searchParams.get("schema"), "public");
  assert.throws(() => runtimeDatabaseUrl({ DB_HOST: "db.internal" }));
});

test("Render release gate accepts finished checksums and rejects failed, missing, changed or privileged deployments", async () => {
  const expected = await expectedMigrations();
  assert.equal(expected.length, 6);
  const complete = expected.map(
    ({ name, checksum }: { name: string; checksum: string }) => ({
      migration_name: name,
      checksum,
      finished_at: new Date(),
      rolled_back_at: null,
    }),
  );
  const mock = (rows: object[], elevated = false, unsafe = false) => ({
    async query(sql: string) {
      return {
        rows: sql.includes("has_schema_privilege")
          ? [
              {
                can_create: unsafe,
                can_write_ledger: unsafe,
                owns_objects: unsafe,
              },
            ]
          : sql.includes("FROM pg_roles WHERE rolname = current_user")
            ? [
                {
                  rolsuper: elevated,
                  rolcreatedb: false,
                  rolcreaterole: false,
                  rolreplication: false,
                  rolbypassrls: false,
                },
              ]
            : sql.includes("SELECT migration_name")
              ? rows
              : [],
      };
    },
  });
  await checkDatabase(mock(complete), expected);
  await assert.rejects(checkDatabase(mock(complete.slice(1)), expected));
  await assert.rejects(
    checkDatabase(
      mock([{ ...complete[0], checksum: "changed" }, ...complete.slice(1)]),
      expected,
    ),
  );
  await assert.rejects(
    checkDatabase(
      mock([...complete, { ...complete[0], finished_at: null }]),
      expected,
    ),
  );
  await assert.rejects(checkDatabase(mock(complete, true), expected));
  await assert.rejects(checkDatabase(mock(complete, false, true), expected));
});

test("Disabled media is explicit demo mode, never an ephemeral production fallback", () => {
  for (const [DEMO_MODE, MEDIA_STORAGE, expected] of [
    ["false", "disabled", 1],
    ["true", "disabled", 0],
    ["true", "local", 1],
    ["true", "s3", 1],
  ] as const) {
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        "import {validateConfig,validateStorage} from './apps/api/src/config.ts';validateConfig();validateStorage();",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PUBLIC_ORIGIN: "https://club.example",
          TRUSTED_ORIGINS: "https://club.example",
          COOKIE_SECURE: "true",
          ALLOW_LOCAL_HTTP: "false",
          DATABASE_URL: "postgresql://unused@localhost/ordabasy_test",
          DEMO_MODE,
          MEDIA_STORAGE,
          S3_BUCKET: "",
        },
        encoding: "utf8",
      },
    );
    assert.equal(child.status, expected, child.stderr);
  }
});

test("Demo media refuses reads, uploads and deletions before touching files or records", async () => {
  const previous = process.env.MEDIA_STORAGE;
  process.env.MEDIA_STORAGE = "disabled";
  const disabled = (error: unknown) => {
    const e = error as { getStatus(): number; getResponse(): { code: string } };
    return (
      e.getStatus() === 503 && e.getResponse().code === "MEDIA_STORAGE_DISABLED"
    );
  };
  try {
    await assert.rejects(readUpload("fixture.webp"), disabled);
    await assert.rejects(
      uploadImage(
        undefined as unknown as Express.Multer.File,
        {} as AuthRequest,
      ),
      disabled,
    );
    await assert.rejects(
      deleteMedia("nonexistent-fixture", {} as AuthRequest),
      disabled,
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_STORAGE;
    else process.env.MEDIA_STORAGE = previous;
  }
});

test("The local Render release refuses an ambiguous target without printing credentials", () => {
  const child = spawnSync(
    process.execPath,
    ["scripts/render-release.mjs", "--provision-runtime"],
    {
      env: {
        ...process.env,
        MIGRATION_DATABASE_URL:
          "postgresql://owner:private-fixture@localhost/production",
        APP_DB_USER: "ordabasy_app",
        APP_DB_PASSWORD: "fixture-secret-".repeat(4),
        RENDER_DATABASE_NAME: "ordabasy_demo",
        RENDER_RELEASE_TEST: "false",
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(child.status, 1);
  assert.doesNotMatch(
    child.stderr,
    /private-fixture|fixture-secret|postgresql:\/\//,
  );
  assert.equal(child.stdout, "");
});

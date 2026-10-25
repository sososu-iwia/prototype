// Explicit operator release, never a build step or a Function invocation.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  apiDirectory,
  checkDatabase,
  expectedMigrations,
} from "./render-check.mjs";
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
let client;
try {
  const stage = process.env.VERCEL_RELEASE_ENV;
  if (!["production", "preview", "development"].includes(stage))
    throw new Error("Explicit environment required");
  const owner = new URL(process.env.MIGRATION_DATABASE_URL || "");
  const database = decodeURIComponent(owner.pathname.slice(1));
  const role = `ordabasy_${stage}`;
  const password = process.env.APP_DB_PASSWORD || "";
  const localTest =
    process.env.VERCEL_RELEASE_TEST === "true" &&
    ["localhost", "127.0.0.1"].includes(owner.hostname) &&
    /(?:^|_)test(?:_|$)/.test(database);
  if (
    !["postgres:", "postgresql:"].includes(owner.protocol) ||
    (!localTest &&
      (!owner.hostname.endsWith(".neon.tech") ||
        owner.hostname.includes("-pooler."))) ||
    owner.hostname !== process.env.VERCEL_DATABASE_HOST ||
    database !== process.env.VERCEL_DATABASE_NAME ||
    password.length < 32 ||
    decodeURIComponent(owner.username) === role ||
    (owner.searchParams.get("schema") || "public") !== "public"
  )
    throw new Error("Invalid explicit direct migration target");
  if (!localTest) owner.searchParams.set("sslmode", "verify-full");
  client = new pg.Client({
    connectionString: owner.href,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
  });
  await client.connect();
  const profile = (
    await client.query(
      "SELECT current_setting('server_encoding') AS encoding, lower('ҚАЗАҚСТАН') AS kk, lower('ОРДАБАСЫ') AS ru",
    )
  ).rows[0];
  if (
    profile.encoding !== "UTF8" ||
    profile.kk !== "қазақстан" ||
    profile.ru !== "ордабасы"
  )
    throw new Error("Invalid Unicode profile");
  const markerExists = (
    await client.query(
      "SELECT to_regclass('public.\"DeploymentEnvironment\"') AS name",
    )
  ).rows[0].name;
  if (markerExists) {
    const marker = (
      await client.query(
        'SELECT stage FROM "DeploymentEnvironment" WHERE id=$1',
        ["environment"],
      )
    ).rows[0];
    if (marker?.stage !== stage)
      throw new Error(
        "Environment marker mismatch; never relabel an existing database",
      );
  }
  const tablesBefore = (
    await client.query(
      "SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='public'",
    )
  ).rows[0].n;
  if (tablesBefore && !markerExists)
    throw new Error(
      "Existing databases need a separate reviewed adoption; do not relabel them",
    );
  if (tablesBefore) {
    const ledger = (
      await client.query(
        'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
      )
    ).rows;
    const expected = await expectedMigrations();
    const pending = expected.some(
      (m) =>
        !ledger.some(
          (r) =>
            r.migration_name === m.name &&
            r.checksum === m.checksum &&
            r.finished_at &&
            !r.rolled_back_at,
        ),
    );
    if (pending && !localTest) {
      const dump = await readFile(process.env.VERCEL_BACKUP_FILE || "");
      if (
        dump.subarray(0, 5).toString() !== "PGDMP" ||
        createHash("sha256").update(dump).digest("hex") !==
          process.env.VERCEL_BACKUP_SHA256
      )
        throw new Error(
          "A verified custom-format backup is required before existing database migrations",
        );
    }
  }
  if (process.argv.includes("--provision-runtime")) {
    const tables = (
      await client.query(
        "SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='public'",
      )
    ).rows[0].n;
    const existingRole = (
      await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])
    ).rowCount;
    if (tables || existingRole)
      throw new Error(
        "Provisioning requires an empty new database and a new role",
      );
    await client.query("BEGIN");
    const statement = (
      await client.query(
        "SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS statement",
        [role, password],
      )
    ).rows[0].statement;
    await client.query(statement);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT CONNECT ON DATABASE ${identifier(database)} TO ${identifier(role)};
      GRANT USAGE ON SCHEMA public TO ${identifier(role)};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${identifier(role)};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO ${identifier(role)};`);
    await client.query("COMMIT");
  }
  await client.end();
  client = undefined;
  const runtime = new URL(owner.href);
  runtime.username = role;
  runtime.password = password;
  // Prisma's migration connection is direct. Runtime uses the pooled endpoint
  // configured separately in Vercel, with this same restricted role.
  for (const [args, label] of [
    [
      [
        resolve(apiDirectory, "../../node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
      ],
      "Reviewed migrations",
    ],
    ...(process.env.VERCEL_RELEASE_SEED === "true"
      ? [[[resolve(apiDirectory, "dist/seed.js")], "Idempotent archive seed"]]
      : []),
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: apiDirectory,
      env: { ...process.env, DATABASE_URL: owner.href },
      stdio: "pipe",
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error(`${label} failed`);
    console.log(`${label} completed.`);
  }
  client = new pg.Client({ connectionString: owner.href });
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    'INSERT INTO "DeploymentEnvironment" (id,stage) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',
    ["environment", stage],
  );
  const marker = (
    await client.query(
      'SELECT stage FROM "DeploymentEnvironment" WHERE id=$1',
      ["environment"],
    )
  ).rows[0];
  if (marker?.stage !== stage) throw new Error("Environment marker mismatch");
  for (const table of ["_prisma_migrations", "DeploymentEnvironment"]) {
    await client.query(
      `REVOKE ALL ON TABLE ${identifier(table)} FROM ${identifier(role)}; GRANT SELECT ON TABLE ${identifier(table)} TO ${identifier(role)}`,
    );
  }
  await client.query("COMMIT");
  await client.end();
  client = new pg.Client({ connectionString: runtime.href });
  await client.connect();
  await checkDatabase(client, await expectedMigrations());
  const writableMarker = (
    await client.query(
      `SELECT has_table_privilege(current_user,'"DeploymentEnvironment"','INSERT,UPDATE,DELETE,TRUNCATE') AS unsafe`,
    )
  ).rows[0].unsafe;
  if (writableMarker)
    throw new Error("Runtime must not relabel the environment");
  console.log(
    `Vercel ${stage} release verified. Install only pooled runtime credentials in the API project.`,
  );
} catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Vercel release blocked. Verify the explicit target, environment, Unicode, role and migration state. No reset, drop or credential rotation was attempted.",
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}

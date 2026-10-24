// Railway pre-deploy runs in the API image (WORKDIR /app/apps/api).
// A failed migration or seed must block the deployment. Never print credentials.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

// The script lives in scripts/ locally and beside prisma.config.ts in the image.
const cwd = fileURLToPath(
  new URL(
    import.meta.url.endsWith("/scripts/railway-predeploy.mjs")
      ? "../apps/api/"
      : "./",
    import.meta.url,
  ),
);
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
let runtimeRole, schema;
try {
  const migration = new URL(databaseUrl || "");
  const runtime = new URL(process.env.DATABASE_URL || "");
  const target = (url) =>
    [
      url.hostname,
      url.port || "5432",
      url.pathname,
      url.searchParams.get("schema") || "public",
    ].join("|");
  if (
    ![migration, runtime].every((url) =>
      ["postgres:", "postgresql:"].includes(url.protocol),
    ) ||
    target(migration) !== target(runtime) ||
    !migration.username ||
    !runtime.username ||
    migration.username === runtime.username
  ) {
    throw new Error("Invalid database roles or target");
  }
  runtimeRole = decodeURIComponent(runtime.username);
  schema = migration.searchParams.get("schema") || "public";
} catch {
  console.error(
    "Pre-deploy requires MIGRATION_DATABASE_URL and DATABASE_URL for the same database/schema with different roles.",
  );
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: databaseUrl };
function run(args, label) {
  // Prisma can include the connection hostname in output. Keep child output out
  // of platform logs and report only the step and exit status.
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    stdio: "pipe",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    console.error(
      `${label} failed; deploy blocked (exit ${result.status ?? "unavailable"}).`,
    );
    process.exit(1);
  }
  console.log(`${label} completed.`);
}
run(
  [
    resolve(cwd, "../../node_modules/prisma/build/index.js"),
    "migrate",
    "deploy",
  ],
  "Prisma migrations",
);
// DML grants on all tables must not let the API modify migration history.
const client = new pg.Client({ connectionString: databaseUrl });
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
try {
  await client.connect();
  await client.query(
    `REVOKE ALL PRIVILEGES ON TABLE ${identifier(schema)}."_prisma_migrations" FROM ${identifier(runtimeRole)}`,
  );
  // pg_dump in the existing backup workflow needs to read the ledger.
  await client.query(
    `GRANT SELECT ON TABLE ${identifier(schema)}."_prisma_migrations" TO ${identifier(runtimeRole)}`,
  );
} catch {
  console.error("Protecting migration history failed; deploy blocked.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
if (process.exitCode) process.exit(process.exitCode);
if (process.env.RAILWAY_SEED_ON_DEPLOY === "true") {
  run([resolve(cwd, "dist/seed.js")], "Idempotent archive seed");
}

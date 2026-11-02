// Run locally before a Free service deploy. Never install owner credentials in API env.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  apiDirectory,
  checkDatabase,
  expectedMigrations,
} from "./render-check.mjs";

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
let client;
try {
  const owner = new URL(process.env.MIGRATION_DATABASE_URL || "");
  const database = decodeURIComponent(owner.pathname.slice(1));
  const role = process.env.APP_DB_USER || "ordabasy_app";
  const password = process.env.APP_DB_PASSWORD || "";
  const localTest =
    process.env.RENDER_RELEASE_TEST === "true" &&
    ["127.0.0.1", "localhost"].includes(owner.hostname) &&
    /(?:^|_)test(?:_|$)/.test(database);
  if (
    !["postgres:", "postgresql:"].includes(owner.protocol) ||
    (!localTest && !owner.hostname.endsWith(".render.com")) ||
    database !== process.env.RENDER_DATABASE_NAME ||
    !/^[a-z_][a-z0-9_]{0,62}$/.test(role) ||
    decodeURIComponent(owner.username) === role ||
    password.length < 32 ||
    (owner.searchParams.get("schema") || "public") !== "public"
  )
    throw new Error("Invalid release target or role configuration");
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
    throw new Error(
      "Database Unicode profile does not meet application requirements",
    );
  if (process.argv.includes("--provision-runtime")) {
    const tables = (
      await client.query(
        "SELECT count(*)::integer AS count FROM pg_tables WHERE schemaname='public'",
      )
    ).rows[0].count;
    const exists = (
      await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])
    ).rowCount;
    if (tables || exists)
      throw new Error(
        "Provisioning requires an empty new database and a new runtime role",
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
      REVOKE CREATE ON SCHEMA public FROM ${identifier(role)};
      GRANT CONNECT ON DATABASE ${identifier(database)} TO ${identifier(role)};
      GRANT USAGE ON SCHEMA public TO ${identifier(role)};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${identifier(role)};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO ${identifier(role)};`);
    await client.query("COMMIT");
    console.log("Restricted runtime role provisioned in the new database.");
  }
  await client.end();
  client = undefined;
  const runtime = new URL(owner.href);
  runtime.username = role;
  runtime.password = password;
  const migration = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./railway-predeploy.mjs", import.meta.url))],
    {
      cwd: apiDirectory,
      env: {
        ...process.env,
        DATABASE_URL: runtime.href,
        MIGRATION_DATABASE_URL: owner.href,
        RAILWAY_SEED_ON_DEPLOY:
          process.env.RENDER_SEED_ON_DEPLOY === "true" ? "true" : "false",
      },
      stdio: "inherit",
    },
  );
  if (migration.error || migration.status !== 0)
    throw new Error("Migration runner failed");
  client = new pg.Client({
    connectionString: runtime.href,
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
  });
  await client.connect();
  await checkDatabase(client, await expectedMigrations());
  console.log(
    "Render release verified through the restricted runtime role. API may now deploy.",
  );
} catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Render release blocked. Check the explicit target, Unicode profile, new role and migration permissions. No reset, drop or credential rotation was attempted.",
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

export const apiDirectory = fileURLToPath(
  new URL(
    import.meta.url.endsWith("/scripts/render-check.mjs")
      ? "../apps/api/"
      : "./",
    import.meta.url,
  ),
);

// A free instance never receives the migration owner's credentials.
export function runtimeDatabaseUrl(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const values = [
    env.APP_DB_USER,
    env.APP_DB_PASSWORD,
    env.DB_HOST,
    env.DB_PORT,
    env.DB_NAME,
  ];
  if (values.some((value) => !value))
    throw new Error("Runtime database configuration is incomplete.");
  const url = new URL("postgresql://localhost");
  url.hostname = env.DB_HOST;
  url.port = env.DB_PORT;
  url.username = env.APP_DB_USER;
  url.password = env.APP_DB_PASSWORD;
  url.pathname = `/${env.DB_NAME}`;
  url.searchParams.set("schema", "public");
  return url.href;
}

export async function expectedMigrations(directory = apiDirectory) {
  const root = `${directory}/prisma/migrations`;
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      checksum: createHash("sha256")
        .update(await readFile(`${root}/${name}/migration.sql`))
        .digest("hex"),
    })),
  );
}

export async function checkDatabase(client, expected, schema = "public") {
  const role = (
    await client.query(
      "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user",
    )
  ).rows[0];
  if (!role || Object.values(role).some(Boolean))
    throw new Error("API requires a restricted runtime database role.");
  const identifier = `"${schema.replaceAll('"', '""')}"`;
  const privileges = (
    await client.query(
      `SELECT
    has_schema_privilege(current_user, $1, 'CREATE') AS can_create,
    has_table_privilege(current_user, $2, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') AS can_write_ledger,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)) AS owns_objects`,
      [schema, `${identifier}."_prisma_migrations"`],
    )
  ).rows[0];
  if (!privileges || Object.values(privileges).some(Boolean))
    throw new Error(
      "Runtime role must not own schema objects or have DDL/migration-ledger write privileges.",
    );
  const rows = (
    await client.query(
      `SELECT migration_name, checksum, finished_at, rolled_back_at FROM ${identifier}."_prisma_migrations"`,
    )
  ).rows;
  for (const migration of expected) {
    const attempts = rows.filter(
      (row) => row.migration_name === migration.name && !row.rolled_back_at,
    );
    if (
      !attempts.some(
        (row) => row.finished_at && row.checksum === migration.checksum,
      ) ||
      attempts.some((row) => !row.finished_at)
    )
      throw new Error(
        "Required migrations are missing, failed or do not match this release.",
      );
  }
  await client.query("SELECT 1");
}

export async function verifyRuntimeDatabase() {
  const connectionString = runtimeDatabaseUrl();
  const schema =
    new URL(connectionString).searchParams.get("schema") || "public";
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
  });
  try {
    await client.connect();
    await checkDatabase(client, await expectedMigrations(), schema);
    process.env.DATABASE_URL = connectionString;
    console.log("Render runtime role and migration checks passed.");
  } finally {
    await client.end().catch(() => {});
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  verifyRuntimeDatabase().catch(() => {
    console.error(
      "Render database check failed. Apply the reviewed migrations with the separate migration role before deploying.",
    );
    process.exitCode = 1;
  });
}

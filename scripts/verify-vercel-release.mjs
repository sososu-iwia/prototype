import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
const source = new URL(process.env.DATABASE_URL || "");
if (
  !/(?:^|_)test(?:_|$)/.test(source.pathname) ||
  !["localhost", "127.0.0.1"].includes(source.hostname)
)
  throw new Error("Use an isolated local PostgreSQL test server");
const name = `ordabasy_vercel_release_test_${randomUUID().replaceAll("-", "")}`;
const target = new URL(source);
target.pathname = `/${name}`;
const password = randomUUID() + randomUUID();
const env = {
  ...process.env,
  VERCEL_RELEASE_TEST: "true",
  VERCEL_RELEASE_ENV: "preview",
  MIGRATION_DATABASE_URL: target.href,
  VERCEL_DATABASE_HOST: target.hostname,
  VERCEL_DATABASE_NAME: name,
  APP_DB_PASSWORD: password,
};
const owner = new pg.Client({ connectionString: source.href });
await owner.connect();
const run = (args, extra = {}) =>
  spawnSync(process.execPath, args, {
    env: { ...env, ...extra },
    encoding: "utf8",
    timeout: 60000,
  });
let roleOwned = false;
try {
  assert.equal(
    (
      await owner.query(
        "SELECT 1 FROM pg_roles WHERE rolname='ordabasy_preview'",
      )
    ).rowCount,
    0,
    "This fixture requires its own fresh PostgreSQL server",
  );
  await owner.query(`CREATE DATABASE "${name}"`);
  let result = run(["scripts/vercel-release.mjs", "--provision-runtime"]);
  assert.equal(result.status, 0, result.stderr);
  roleOwned = true;
  const runtime = new URL(target);
  runtime.username = "ordabasy_preview";
  runtime.password = password;
  const client = new pg.Client({ connectionString: runtime.href });
  await client.connect();
  try {
    await assert.rejects(
      client.query("UPDATE \"DeploymentEnvironment\" SET stage='production'"),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      client.query('DELETE FROM "_prisma_migrations"'),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      client.query("CREATE TABLE forbidden_ddl (id int)"),
      (e) => e.code === "42501",
    );
    assert.equal(
      (await client.query('SELECT stage FROM "DeploymentEnvironment"')).rows[0]
        .stage,
      "preview",
    );
  } finally {
    await client.end();
  }
  const gate = `const {verifyVercelRuntime}=require('./apps/api/dist/vercel-runtime.js');const {db}=require('./apps/api/dist/db.js');const manifest=require('./apps/api/dist/release-manifest.json');verifyVercelRuntime(manifest).then(()=>db.$disconnect()).catch(async()=>{await db.$disconnect();process.exitCode=1})`;
  assert.equal(
    run(["-e", gate], { DATABASE_URL: runtime.href, VERCEL_ENV: "preview" })
      .status,
    0,
  );
  assert.equal(
    run(["-e", gate], { DATABASE_URL: runtime.href, VERCEL_ENV: "production" })
      .status,
    1,
  );
  assert.equal(
    run(["-e", gate], { DATABASE_URL: target.href, VERCEL_ENV: "preview" })
      .status,
    1,
  );
  result = run(["scripts/vercel-release.mjs"], {
    VERCEL_RELEASE_ENV: "production",
  });
  assert.equal(result.status, 1);
  assert.equal(run(["scripts/vercel-release.mjs"]).status, 0);
  console.log(
    "Vercel release verified: additive migrations, immutable Preview marker, DML-only runtime, owner rejection and cross-environment rejection.",
  );
} finally {
  await owner.query(`DROP DATABASE IF EXISTS "${name}"`);
  if (roleOwned) await owner.query("DROP ROLE ordabasy_preview");
  await owner.end();
}

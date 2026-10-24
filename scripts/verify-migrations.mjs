import { assertTestDatabase } from "../tests/helpers/test-database.ts";
import "../apps/api/src/config.ts";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
assertTestDatabase();
const name = `ordabasy_migration_test_${randomUUID().replaceAll("-", "")}`,
  owner = new Client({ connectionString: process.env.DATABASE_URL }),
  target = new URL(process.env.DATABASE_URL);
target.pathname = `/${name}`;
assertTestDatabase(target.toString());
await owner.connect();
const env = { ...process.env, DATABASE_URL: target.toString() };
function run(script) {
  const result = spawnSync("npm", ["run", script], { env, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${script} failed: ${result.stderr}`);
}
try {
  await owner.query(`CREATE DATABASE "${name}"`);
  run("db:migrate");
  run("db:seed");
  const client = new Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const counts = () =>
      client.query(
        'SELECT (SELECT count(*)::int FROM "Player") players,(SELECT count(*)::int FROM "RosterMembership") memberships,(SELECT count(*)::int FROM "Match") matches,(SELECT count(*)::int FROM "NewsPost") articles',
      );
    const first = (await counts()).rows[0];
    if (
      first.players !== 20 ||
      first.memberships !== 20 ||
      first.matches !== 36 ||
      first.articles !== 4
    )
      throw new Error("Fresh import counts mismatch");
    await client.query(
      'UPDATE "Player" SET citizenship=$1 WHERE id=(SELECT id FROM "Player" LIMIT 1)',
      ["Migration drill"],
    );
    run("db:seed");
    run("db:migrate");
    if (JSON.stringify((await counts()).rows[0]) !== JSON.stringify(first))
      throw new Error("Repeated seed duplicated records");
    if (
      (
        await client.query(
          'SELECT count(*)::int n FROM "Player" WHERE citizenship=$1',
          ["Migration drill"],
        )
      ).rows[0].n !== 1
    )
      throw new Error("Seed overwrote edited content");
    console.log(
      JSON.stringify({
        freshMigrations: true,
        repeatSeedPreserved: true,
        counts: first,
      }),
    );
  } finally {
    await client.end();
  }
} finally {
  await owner.query(`DROP DATABASE IF EXISTS "${name}"`);
  await owner.end();
}

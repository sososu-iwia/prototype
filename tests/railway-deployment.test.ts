import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Railway pre-deploy refuses missing credentials, identical roles and a different database before migrating", () => {
  const runtime = "postgresql://app:runtime-fixture@localhost/ordabasy_test";
  for (const migration of [
    "",
    runtime,
    "postgresql://app:other-fixture@localhost/ordabasy_test",
    "postgresql://owner:migration-fixture@localhost/production",
    "postgresql://owner:migration-fixture@other-host/ordabasy_test",
    "postgresql://owner:migration-fixture@localhost:5433/ordabasy_test",
    "postgresql://owner:migration-fixture@localhost/ordabasy_test?schema=other",
  ]) {
    const child = spawnSync(
      process.execPath,
      ["scripts/railway-predeploy.mjs"],
      {
        env: {
          ...process.env,
          DATABASE_URL: runtime,
          MIGRATION_DATABASE_URL: migration,
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(child.status, 1);
    assert.match(child.stderr, /same database\/schema with different roles/);
    assert.equal(child.stdout, "");
    assert.doesNotMatch(
      child.stderr,
      /runtime-fixture|migration-fixture|postgresql:\/\//,
    );
  }
});

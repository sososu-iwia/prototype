import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "./helpers/test-database";
import { schemas, matchStatisticsSchema } from "../apps/api/src/domain";
test("the local HTTP escape hatch cannot bypass independent production storage on a real origin", () => {
  for (const [origin, publicOrigin, expected] of [
    ["https://club.example", "https://club.example", 1],
    ["http://localhost:4310", "https://club.example", 1],
    ["http://localhost:4310", "http://localhost:4310", 0],
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
          TRUSTED_ORIGINS: origin,
          PUBLIC_ORIGIN: publicOrigin,
          COOKIE_SECURE: "true",
          ALLOW_LOCAL_HTTP: "true",
          MEDIA_STORAGE: "local",
          DATABASE_URL: "postgresql://unused@localhost/ordabasy_test",
        },
        encoding: "utf8",
      },
    );
    assert.equal(child.status, expected, child.stderr);
  }
});
test("test tools validate the database name rather than credentials or hostname", () => {
  for (const url of [
    "postgresql://test:codex@localhost/production",
    "postgresql://user:pass@codex-host/ordabasy",
    "postgresql://user:pass@host/contest",
  ])
    assert.throws(() => assertTestDatabase(url));
  for (const db of ["ordabasy_test", "ordabasy_codex_20261019", "test-db"])
    assert.doesNotThrow(() =>
      assertTestDatabase(`postgresql://user@localhost/${db}`),
    );
});
test("production validates the public origin as well as trusted origins", () => {
  for (const publicOrigin of [
    "http://club.example",
    "https://club.example/path",
    "https://club.example/",
    "https://user:password@club.example",
    "https://*.example",
  ]) {
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        "import {validateConfig} from './apps/api/src/config.ts';validateConfig();",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PUBLIC_ORIGIN: publicOrigin,
          TRUSTED_ORIGINS: "https://club.example",
          COOKIE_SECURE: "true",
          ALLOW_LOCAL_HTTP: "false",
          DATABASE_URL: "postgresql://unused@localhost/ordabasy_test",
        },
        encoding: "utf8",
      },
    );
    assert.equal(child.status, 1, publicOrigin);
  }
});
test("played matches cannot have future kickoff or incomplete scores", () => {
  const data = {
    seasonId: "2026",
    competitionId: "league",
    homeTeamId: "ordabasy",
    awayTeamId: "irtysh",
    kickoff: new Date(Date.now() + 86400000).toISOString(),
    stadium: { kk: "" },
    matchStatus: "FINISHED",
    homeScore: 1,
    awayScore: 0,
    status: "DRAFT",
    verification: "VERIFIED",
    source: "Test fixture",
    sourceDate: new Date().toISOString(),
  };
  assert.equal(schemas.matches.safeParse(data).success, false);
  assert.equal(
    schemas.matches.safeParse({
      ...data,
      kickoff: "2026-01-01T00:00:00.000Z",
      awayScore: null,
    }).success,
    false,
  );
});
test("minutes and clean sheets require an actual appearance", () => {
  const data = {
    matchId: "match",
    playerId: "player",
    appearances: 0,
    minutes: 90,
    cleanSheets: null,
    verified: true,
    source: "Test fixture",
  };
  assert.equal(matchStatisticsSchema.safeParse(data).success, false);
  assert.equal(
    matchStatisticsSchema.safeParse({ ...data, minutes: 0, cleanSheets: 1 })
      .success,
    false,
  );
});

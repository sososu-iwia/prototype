import { assertTestDatabase } from "../helpers/test-database";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { createApp } from "../../apps/api/src/main";
import { db } from "../../apps/api/src/db";
import { seasonStatistics } from "../../apps/api/src/statistics";

test("roster and publication integrity under exceptional admin operations", async (t) => {
  assertTestDatabase();
  const prefix = `integrity-${randomUUID().slice(0, 8)}`,
    password = randomUUID() + randomUUID();
  const user = await db.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "SUPER_ADMIN",
    },
  });
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = (await app.getUrl()) + "/api/v1";
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: user.email, password }),
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0],
    csrf = (await login.json()).csrfToken;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    version?: number,
  ) {
    return fetch(base + path, {
      method,
      headers: {
        cookie,
        "X-CSRF-Token": csrf,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...(version ? { "If-Match": String(version) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function create(entity: string, body: unknown) {
    const response = await call(`/admin/${entity}`, "POST", body);
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  }
  const playerBody = {
    slug: prefix,
    names: { kk: "Сынақ ойыншысы", en: prefix },
    position: "goalkeeper",
    status: "PUBLISHED",
    verification: "VERIFIED",
    source: prefix,
    sourceDate: new Date().toISOString(),
  };
  let player: { id: string; version: number },
    period: { id: string; version: number },
    future: { id: string; version: number },
    rivalPeriod: { id: string; version: number };
  try {
    player = await create("players", playerBody);
    const body = {
      playerId: player.id,
      seasonId: "2026",
      teamId: "ordabasy",
      number: 33,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T00:00:00.000Z",
    };
    period = await create("memberships", body);
    await t.test(
      "localized player and membership search ignores Cyrillic letter case",
      async () => {
        for (const entity of ["players", "memberships"]) {
          const result = await (
            await call(
              `/admin/${entity}?q=${encodeURIComponent("сынақ")}&limit=100`,
            )
          ).json();
          assert.ok(
            result.items.some(
              (row: { id: string; playerId?: string }) =>
                (entity === "players" ? row.id : row.playerId) === player.id,
            ),
          );
        }
      },
    );
    await t.test(
      "creating an archived profile never closes another player's membership",
      async () => {
        await create("players", {
          ...playerBody,
          slug: `${prefix}-archived`,
          archivedAt: new Date().toISOString(),
        });
        const unchanged = await db.rosterMembership.findUniqueOrThrow({
          where: { id: period.id },
        });
        assert.equal(unchanged.endsAt!.toISOString(), body.endsAt);
        assert.equal(unchanged.version, period.version);
      },
    );
    await t.test(
      "public roster numbers come from the managed club and confirmed statistics stay private until verified",
      async () => {
        rivalPeriod = await create("memberships", {
          ...body,
          teamId: "irtysh",
          number: 88,
          startsAt: "2026-02-01T00:00:00.000Z",
        });
        const ps = await db.playerSeason.findUniqueOrThrow({
          where: {
            playerId_seasonId: { playerId: player.id, seasonId: "2026" },
          },
        });
        await create("statistics", {
          playerSeasonId: ps.id,
          appearances: 1,
          minutes: 90,
          goals: 0,
          assists: 0,
          source: prefix,
          verified: false,
        });
        const list = await (await call("/players?limit=100")).json();
        const row = list.items.find((p: { id: string }) => p.id === player.id);
        assert.equal(row.rosterNumber, 33);
        assert.equal(
          row.seasons.find((s: { id: string }) => s.id === ps.id).statistics,
          null,
        );
        const profile = await (await call(`/players/${prefix}`)).json();
        assert.equal(profile.rosterNumber, 33);
        assert.equal(profile.seasons[0].statistics, null);
      },
    );
    await t.test(
      "archiving closes an active fixed-term period and cancels a future plan without erasing history",
      async () => {
        future = await create("memberships", {
          ...body,
          startsAt: "2027-01-01T00:00:00.000Z",
          endsAt: null,
          seasonId: "2026",
          number: 44,
        });
        assert.equal(
          (
            await call(
              `/admin/players/${player.id}`,
              "DELETE",
              undefined,
              player.version,
            )
          ).status,
          200,
        );
        const closed = await db.rosterMembership.findUniqueOrThrow({
          where: { id: period.id },
        });
        assert.ok(closed.endsAt! < new Date());
        assert.equal(
          closed.departureReason,
          null,
          "Archiving must not invent a football departure reason",
        );
        assert.equal(
          (
            await db.rosterMembership.findUniqueOrThrow({
              where: { id: future.id },
            })
          ).cancelled,
          true,
        );
        assert.equal((await call(`/players/${prefix}`)).status, 200);
        assert.ok(
          !(await (await call("/players?limit=100")).json()).items.some(
            (p: { id: string }) => p.id === player.id,
          ),
        );
        const current = await db.player.findUniqueOrThrow({
          where: { id: player.id },
        });
        assert.equal(
          (
            await call(
              `/admin/players/${player.id}`,
              "PUT",
              { ...playerBody, archivedAt: null },
              current.version,
            )
          ).status,
          200,
        );
        await create("memberships", {
          ...body,
          startsAt: new Date().toISOString(),
          endsAt: null,
          number: 55,
        });
      },
    );
    await t.test(
      "concurrent writes with the same version cannot silently overwrite each other",
      async () => {
        const current = await db.player.findUniqueOrThrow({
          where: { id: player.id },
        });
        const responses = await Promise.all([
          call(
            `/admin/players/${player.id}`,
            "PUT",
            { ...playerBody, citizenship: "A" },
            current.version,
          ),
          call(
            `/admin/players/${player.id}`,
            "PUT",
            { ...playerBody, citizenship: "B" },
            current.version,
          ),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "ambiguous team membership requires an explicit match statistics team",
      async () => {
        const match = await create("matches", {
          seasonId: "2026",
          competitionId: "league",
          homeTeamId: "ordabasy",
          awayTeamId: "irtysh",
          kickoff: "2026-08-01T12:00:00.000Z",
          stadium: { kk: "Сынақ" },
          matchStatus: "FINISHED",
          homeScore: 0,
          awayScore: 1,
          status: "PUBLISHED",
          verification: "VERIFIED",
          source: prefix,
          sourceDate: new Date().toISOString(),
        });
        const line = {
          matchId: match.id,
          playerId: player.id,
          appearances: 1,
          minutes: 90,
          cleanSheets: null,
          verified: true,
          source: prefix,
        };
        assert.equal(
          (await call("/admin/match-statistics", "POST", line)).status,
          409,
        );
        const stat = await create("match-statistics", {
          ...line,
          teamId: "irtysh",
          cleanSheets: 1,
        });
        assert.equal(stat.teamId, "irtysh");
        const confirmed = await db.playerStatistics.findFirstOrThrow({
          where: { source: prefix },
        });
        await db.playerStatistics.update({
          where: { id: confirmed.id },
          data: { mode: "MATCHES", verified: true },
        });
        assert.equal(
          (await seasonStatistics("2026", true, [player.id])).length,
          0,
          "Opponent appearances must not become club statistics",
        );
        // A historical overlap may exist across teams. An opponent event must
        // never be counted as a goal for the managed club's appearance.
        await create("match-events", {
          matchId: match.id,
          playerId: player.id,
          teamId: "irtysh",
          eventKey: randomUUID(),
          minute: 30,
          type: "GOAL",
          description: { kk: "Сынақ голы" },
          source: prefix,
          cancelled: false,
        });
        assert.equal(
          (
            await call(
              `/admin/match-statistics/${stat.id}`,
              "PUT",
              {
                ...line,
                teamId: "ordabasy",
                cleanSheets: null,
              },
              stat.version,
            )
          ).status,
          200,
        );
        const totals = await seasonStatistics("2026", true, [player.id]);
        assert.equal(totals.length, 1);
        assert.equal(totals[0].appearances, 1);
        assert.equal(totals[0].goals, 0);
        assert.equal(
          (
            await call(
              `/admin/memberships/${rivalPeriod.id}`,
              "PUT",
              {
                ...body,
                teamId: "irtysh",
                startsAt: "2026-02-01T00:00:00.000Z",
                endsAt: "2026-02-02T00:00:00.000Z",
              },
              (
                await db.rosterMembership.findUniqueOrThrow({
                  where: { id: rivalPeriod.id },
                })
              ).version,
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "season date changes cannot invalidate existing club history",
      async () => {
        const existing = await db.season.findUniqueOrThrow({
          where: { id: "2026" },
        });
        const changed = await call(
          "/admin/seasons/2026",
          "PUT",
          {
            id: existing.id,
            name: existing.name,
            current: existing.current,
            year: existing.year,
            state: existing.state,
            startsAt: "2026-06-01T00:00:00.000Z",
            endsAt: "2026-12-31T00:00:00.000Z",
          },
          existing.version,
        );
        assert.equal(changed.status, 409);
        const bounded = await create("seasons", {
          id: `${prefix}-season`,
          name: prefix,
          current: false,
          state: "PLANNED",
          startsAt: "2027-01-01T00:00:00.000Z",
          endsAt: "2027-12-31T00:00:00.000Z",
        });
        const match = await call("/admin/matches", "POST", {
          seasonId: bounded.id,
          competitionId: "league",
          homeTeamId: "ordabasy",
          awayTeamId: "irtysh",
          kickoff: "2026-12-01T00:00:00.000Z",
          stadium: { kk: "Тест" },
          matchStatus: "SCHEDULED",
          homeScore: null,
          awayScore: null,
          status: "DRAFT",
          verification: "VERIFIED",
          source: prefix,
          sourceDate: new Date().toISOString(),
        });
        assert.equal(match.status, 400);
      },
    );
  } finally {
    await db.matchEvent.deleteMany({ where: { source: prefix } });
    await db.playerMatchStatistics.deleteMany({ where: { source: prefix } });
    await db.match.deleteMany({ where: { source: prefix } });
    await db.playerStatistics.deleteMany({ where: { source: prefix } });
    await db.rosterMembership.deleteMany({
      where: { player: { slug: { startsWith: prefix } } },
    });
    await db.playerSeason.deleteMany({
      where: { player: { slug: { startsWith: prefix } } },
    });
    await db.player.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.season.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.mutationKey.deleteMany({ where: { userId: user.id } });
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await app.close();
    await db.$disconnect();
  }
});

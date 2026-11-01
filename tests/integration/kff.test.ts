import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { db } from "../../apps/api/src/db";
import { createApp } from "../../apps/api/src/main";
import {
  applyKffToTest,
  requireTestImport,
} from "../../apps/api/src/kff-import";
import { loadKffSnapshot } from "../../apps/api/src/kff-reference";

test("KFF import, source review, protected history and coaching staff", async (t) => {
  requireTestImport();
  const originalPlayers = await db.player.findMany({
    where: { id: { startsWith: "legacy-" } },
    orderBy: { id: "asc" },
  });
  const memberships = await db.rosterMembership.findMany({
    orderBy: { id: "asc" },
  });
  const periods = await db.playerSeason.findMany({
    where: { playerId: { in: originalPlayers.map((p) => p.id) } },
    orderBy: { id: "asc" },
  });
  const snapshot = await loadKffSnapshot();
  await t.test(
    "apply then replay preserves identities, photos, contracts and editorial history",
    async () => {
      await applyKffToTest(snapshot, true);
      const again = await applyKffToTest(snapshot, true);
      assert.deepEqual(again, {
        playersAdded: 0,
        recordsAdded: 0,
        coachesAdded: 0,
        staffDraftsAdded: 0,
        approved: 0,
        membershipsAdded: 0,
      });
      const after = await db.player.findMany({
        where: { id: { in: originalPlayers.map((p) => p.id) } },
        orderBy: { id: "asc" },
      });
      const canonical = (rows: typeof after) =>
        rows.map(
          ({
            aliases: _aliases,
            version: _version,
            updatedAt: _updatedAt,
            ...p
          }) => p,
        );
      assert.deepEqual(canonical(after), canonical(originalPlayers));
      assert.deepEqual(
        await db.rosterMembership.findMany({ orderBy: { id: "asc" } }),
        memberships,
      );
      for (const period of periods)
        assert.deepEqual(
          await db.playerSeason.findUnique({ where: { id: period.id } }),
          period,
        );
      assert.equal(
        await db.rosterImportRecord.count({ where: { seasonId: "2026" } }),
        30,
      );
      assert.equal(
        await db.staffMember.count({
          where: {
            externalKey: { startsWith: "kff-2026-coach-" },
            status: "PUBLISHED",
          },
        }),
        3,
      );
      assert.equal(
        await db.staffMember.count({
          where: {
            externalKey: { startsWith: "club-2026-review-" },
            status: "DRAFT",
          },
        }),
        3,
      );
      const keyler = await db.rosterImportRecord.findUniqueOrThrow({
        where: { referenceKey: "kff-2026-4" },
      });
      const maly = await db.rosterImportRecord.findUniqueOrThrow({
        where: { referenceKey: "kff-2026-25" },
      });
      assert.notEqual(keyler.playerId, maly.playerId);
    },
  );
  const prefix = "kff-test-" + randomUUID().slice(0, 8),
    password = randomUUID();
  const passwordHash = await argon2.hash(password);
  const admin = await db.user.create({
    data: { email: prefix + "@example.invalid", passwordHash, role: "ADMIN" },
  });
  const editor = await db.user.create({
    data: {
      email: prefix + "-editor@example.invalid",
      passwordHash,
      role: "EDITOR",
    },
  });
  let app = await createApp();
  await app.listen(0, "127.0.0.1");
  let base = await app.getUrl(),
    cookie = "",
    csrf = "",
    temporaryStaff = "";
  const origin = "http://localhost:3000";
  async function login(email: string) {
    const r = await fetch(base + "/api/v1/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 201);
    cookie = r.headers.get("set-cookie")!.split(";")[0];
    csrf = (await r.json()).csrfToken;
  }
  const call = (
    path: string,
    method = "GET",
    body?: unknown,
    version?: number,
    token = csrf,
  ) =>
    fetch(base + "/api/v1" + path, {
      method,
      headers: {
        cookie,
        Origin: origin,
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
        ...(version ? { "If-Match": String(version) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await t.test(
      "public season view is separate from active contracts and reserve players",
      async () => {
        const current = await (await call("/team-pages/first-team")).json();
        assert.equal(current.view, "current");
        assert.equal(current.players.length, 0);
        const season = await (
          await call("/team-pages/first-team?season=2026")
        ).json();
        assert.equal(season.players.length, 12);
        assert.equal(season.staff.length, 3);
        assert.deepEqual(
          season.staff.map((s: { roleCode: string }) => s.roleCode),
          ["HEAD_COACH", "ASSISTANT_COACH", "ASSISTANT_COACH"],
        );
        for (const p of season.players) {
          assert.equal(p.registration.contractDatesConfirmed, false);
          assert.ok(!p.reviewNotes);
        }
        assert.ok(
          !season.players.some((p: { rosterNumber: number }) =>
            [6, 24, 27, 72, 78, 80, 81, 93].includes(p.rosterNumber),
          ),
        );
        assert.equal(
          (await (await call("/team-pages/second-league?season=2026")).json())
            .staff.length,
          0,
        );
        const profile = await (await call("/players/sergey-keyler")).json();
        assert.equal(profile.birthDate, null);
        assert.equal(profile.height, null);
        assert.equal(profile.memberships.length, 0);
        assert.equal(profile.registrations.length, 1);
      },
    );
    const record = await db.rosterImportRecord.findUniqueOrThrow({
      where: { referenceKey: "kff-2026-6" },
    });
    await t.test(
      "review requires admin, CSRF, current version and correct team",
      async () => {
        assert.equal((await call("/admin/kff-review")).status, 401);
        await login(editor.email);
        assert.equal((await call("/admin/kff-review")).status, 403);
        await login(admin.email);
        assert.equal((await call("/admin/kff-review")).status, 200);
        assert.equal(
          (
            await call(
              `/admin/kff-review/${record.id}`,
              "PUT",
              { action: "DEFER" },
              record.version,
              "wrong",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(`/admin/kff-review/${record.id}`, "PUT", {
              action: "DEFER",
            })
          ).status,
          428,
        );
        assert.equal(
          (
            await call(
              `/admin/kff-review/${record.id}`,
              "PUT",
              { action: "DEFER" },
              record.version + 99,
            )
          ).status,
          409,
        );
        const first = await db.team.findUniqueOrThrow({
          where: { category: "first-team" },
        });
        assert.equal(
          (
            await call(
              `/admin/kff-review/${record.id}`,
              "PUT",
              {
                action: "APPROVE",
                teamId: first.id,
                notes: "Incorrect first-team assignment must be rejected",
              },
              record.version,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              `/admin/kff-review/${record.id}`,
              "PUT",
              { action: "APPROVE" },
              record.version,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "edit, defer and reject persist with audit records; replay cannot undo them",
      async () => {
        let version = record.version;
        for (const action of ["EDIT", "DEFER", "REJECT", "EDIT"]) {
          const r = await call(
            `/admin/kff-review/${record.id}`,
            "PUT",
            { action, notes: "Keep reserve source pending editorial approval" },
            version,
          );
          assert.equal(r.status, 200);
          version = (await r.json()).version;
        }
        await applyKffToTest(snapshot, true);
        assert.equal(
          (
            await db.rosterImportRecord.findUniqueOrThrow({
              where: { id: record.id },
            })
          ).version,
          version,
        );
        assert.ok(
          await db.auditLog.count({
            where: {
              entity: "kff-review",
              entityId: record.id,
              action: "DEFER",
            },
          }),
        );
      },
    );
    await t.test(
      "staff edits, team changes and archive retain revisions across API restart",
      async () => {
        const first = await db.team.findUniqueOrThrow({
          where: { category: "first-team" },
        });
        const reserve = await db.team.findUniqueOrThrow({
          where: { category: "second-league" },
        });
        const body = {
          names: { kk: prefix },
          title: { kk: "QA" },
          group: "coaching",
          teamId: first.id,
          sourceSeasonId: "2026",
          roleCode: "OTHER",
          photo: null,
          status: "DRAFT",
          verification: "LEGACY_UNVERIFIED",
          source: "Isolated test fixture",
        };
        let r = await call("/admin/staff", "POST", body);
        assert.equal(r.status, 201);
        const member = await r.json();
        temporaryStaff = member.id;
        r = await call(
          `/admin/staff/${member.id}`,
          "PUT",
          { ...body, teamId: reserve.id },
          member.version,
        );
        assert.equal(r.status, 200);
        const changed = await r.json();
        assert.equal(
          (
            await call(
              `/admin/staff/${member.id}`,
              "DELETE",
              undefined,
              changed.version,
            )
          ).status,
          200,
        );
        await app.close();
        app = await createApp();
        await app.listen(0, "127.0.0.1");
        base = await app.getUrl();
        const history = await (
          await call(`/admin/staff/${member.id}/history`)
        ).json();
        assert.equal(history.length, 3);
        const saved = await db.staffMember.findUniqueOrThrow({
          where: { id: member.id },
        });
        assert.equal(saved.status, "ARCHIVED");
        assert.ok(saved.archivedAt);
        assert.equal(saved.teamId, reserve.id);
      },
    );
  } finally {
    if (temporaryStaff) {
      await db.staffRevision.deleteMany({ where: { staffId: temporaryStaff } });
      await db.staffMember.delete({ where: { id: temporaryStaff } });
    }
    await db.session.deleteMany({
      where: { userId: { in: [admin.id, editor.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [admin.id, editor.id] } } });
    await app.close();
    await db.$disconnect();
  }
});

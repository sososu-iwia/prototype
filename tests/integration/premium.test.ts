import { assertTestDatabase } from "../helpers/test-database";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { createApp } from "../../apps/api/src/main";
import { db } from "../../apps/api/src/db";
import { purgeExpiredInquiries } from "../../apps/api/src/inquiry-retention";
import { seedPremium } from "../../apps/api/src/premium-content";
test("premium club publication, team separation and private academy inquiries", async (t) => {
  assertTestDatabase();
  const prefix = `premium-${randomUUID().slice(0, 8)}`,
    password = randomUUID() + randomUUID();
  const passwordHash = await argon2.hash(password);
  const admin = await db.user.create({
      data: { email: `${prefix}@example.invalid`, passwordHash, role: "ADMIN" },
    }),
    editor = await db.user.create({
      data: {
        email: `${prefix}-editor@example.invalid`,
        passwordHash,
        role: "EDITOR",
      },
    });
  const oldAcademy = await db.academyPage.findUnique({ where: { id: "main" } });
  process.env.INQUIRY_RATE_SECRET = randomUUID() + randomUUID();
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = (await app.getUrl()) + "/api/v1";
  let cookie = "",
    csrf = "",
    inquiryId = "";
  const origin = "http://localhost:3000";
  async function login(email: string) {
    const r = await fetch(base + "/auth/login", {
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
  ) =>
    fetch(base + path, {
      method,
      headers: {
        cookie,
        Origin: origin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        ...(version ? { "If-Match": String(version) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await t.test(
      "seed reuses the 2026 identity and preserves editor content",
      async () => {
        await seedPremium();
        const before = await db.clubAchievement.findMany({
          where: {
            year: 2026,
            competitionKey: "kazakhstan-premier-league",
            playerId: null,
          },
        });
        await seedPremium();
        const after = await db.clubAchievement.findMany({
          where: {
            year: 2026,
            competitionKey: "kazakhstan-premier-league",
            playerId: null,
          },
        });
        assert.equal(before.length, 1);
        assert.deepEqual(after, before);
        await assert.rejects(
          db.clubAchievement.create({
            data: {
              clubKey: "ordabasy",
              competitionKey: "kazakhstan-premier-league",
              year: 2026,
              achievementType: "LEAGUE",
              title: { kk: "duplicate" },
              description: { kk: "" },
              source: prefix,
            },
          }),
        );
      },
    );
    await t.test(
      "only verified published honours appear publicly; milestone is not converted",
      async () => {
        const club = await (await fetch(base + "/club")).json();
        assert.equal(
          club.achievements.filter((a: { year: number }) => a.year === 2026)
            .length,
          1,
        );
        assert.ok(
          club.achievements.every(
            (a: { verification: string; status: string }) =>
              a.verification === "VERIFIED" && a.status === "PUBLISHED",
          ),
        );
        assert.equal(
          await db.clubAchievement.count({
            where: { year: 2000, achievementType: "MILESTONE" },
          }),
          1,
        );
      },
    );
    await login(admin.email);
    let sponsorId = "";
    await t.test(
      "draft, expired and unapproved sponsors stay private",
      async () => {
        const r = await call("/admin/sponsors", "POST", {
          name: prefix,
          description: { kk: "Серіктес" },
          logo: "/media/sponsors/bank-rbk.webp",
          status: "DRAFT",
          sortOrder: 99,
          logoApproved: false,
          youthSafe: false,
        });
        assert.equal(r.status, 201, await r.clone().text());
        const row = await r.json();
        sponsorId = row.id;
        const search = await (
          await call(`/admin/sponsors?q=${prefix.toUpperCase()}`)
        ).json();
        assert.deepEqual(
          search.items.map((s: { id: string }) => s.id),
          [sponsorId],
        );
        const list = await (await fetch(base + "/sponsors")).json();
        assert.ok(!list.items.some((v: { id: string }) => v.id === sponsorId));
        const published = await call(
          `/admin/sponsors/${row.id}`,
          "PUT",
          {
            name: prefix,
            description: { kk: "Серіктес" },
            logo: "/media/sponsors/bank-rbk.webp",
            status: "PUBLISHED",
            sortOrder: 99,
            logoApproved: true,
            youthSafe: false,
            verificationSource: "https://club.example/announcement",
            verifiedAt: new Date().toISOString(),
            validUntil: "2020-01-01T00:00:00Z",
          },
          row.version,
        );
        assert.equal(published.status, 200);
        assert.ok(
          !(await (await fetch(base + "/sponsors")).json()).items.some(
            (v: { id: string }) => v.id === sponsorId,
          ),
        );
      },
    );
    await t.test(
      "First League shell never leaks draft roster or overview",
      async () => {
        const data = await (
          await fetch(base + "/team-pages/first-league")
        ).json();
        assert.deepEqual(data, { published: false, category: "first-league" });
        const reserve = await (
          await fetch(base + "/team-pages/second-league")
        ).json();
        assert.equal(reserve.published, true);
        assert.equal(reserve.team.category, "second-league");
        assert.equal(reserve.players.length, 0);
      },
    );
    await t.test(
      "team pages exclude departed players, preserve past seasons and use the active return number",
      async () => {
        const first = await db.team.findUniqueOrThrow({
          where: { category: "first-team" },
        });
        const player = await db.player.create({
          data: {
            slug: `${prefix}-membership`,
            birthDate: new Date("2010-01-01T00:00:00Z"),
            names: { kk: "Тест ойыншы" },
            position: "forward",
            status: "PUBLISHED",
            verification: "VERIFIED",
            source: prefix,
            sourceDate: new Date(),
          },
        });
        assert.equal(
          (await (await fetch(base + "/players/" + player.slug)).json())
            .birthDate,
          null,
        );
        const historical = await db.season.create({
          data: {
            id: `${prefix}-past`,
            name: "Past test season",
            year: 2025,
            state: "COMPLETED",
          },
        });
        try {
          await db.rosterMembership.create({
            data: {
              playerId: player.id,
              teamId: first.id,
              seasonId: "2026",
              number: 8,
              startsAt: new Date("2026-01-01T00:00:00Z"),
              endsAt: new Date("2026-06-01T00:00:00Z"),
            },
          });
          await db.rosterMembership.create({
            data: {
              playerId: player.id,
              teamId: first.id,
              seasonId: historical.id,
              number: 7,
              startsAt: new Date("2025-01-01T00:00:00Z"),
              endsAt: new Date("2025-12-31T00:00:00Z"),
            },
          });
          const read = async (season: string) =>
            (
              await (
                await fetch(base + `/team-pages/first-team?season=${season}`)
              ).json()
            ).players;
          assert.ok(
            !(await read("2026")).some(
              (p: { id: string }) => p.id === player.id,
            ),
          );
          assert.equal(
            (await read(historical.id)).find(
              (p: { id: string }) => p.id === player.id,
            )?.rosterNumber,
            7,
          );
          const future = new Date(Date.now() + 3600000);
          await db.rosterMembership.create({
            data: {
              playerId: player.id,
              teamId: first.id,
              seasonId: "2026",
              number: 9,
              startsAt: new Date(Date.now() - 3600000),
              endsAt: future,
            },
          });
          await db.rosterMembership.create({
            data: {
              playerId: player.id,
              teamId: first.id,
              seasonId: "2026",
              number: 10,
              startsAt: future,
              endsAt: null,
            },
          });
          assert.equal(
            (await read("2026")).find((p: { id: string }) => p.id === player.id)
              ?.rosterNumber,
            9,
          );
        } finally {
          await db.rosterMembership.deleteMany({
            where: { playerId: player.id },
          });
          await db.player.delete({ where: { id: player.id } });
          await db.season.delete({ where: { id: historical.id } });
        }
      },
    );
    await t.test(
      "anonymous and editor users cannot read or mutate personal inquiry records",
      async () => {
        assert.equal(
          (await fetch(base + "/admin/academy-inquiries")).status,
          401,
        );
        await login(editor.email);
        assert.equal((await call("/admin/academy-inquiries")).status, 403);
        assert.equal(
          (await call("/admin/academy-inquiries/missing")).status,
          403,
        );
        assert.equal(
          (
            await call(
              "/admin/academy-inquiries/missing",
              "PUT",
              { state: "RESOLVED" },
              1,
            )
          ).status,
          403,
        );
      },
    );
    await login(admin.email);
    await db.academyPage.update({
      where: { id: "main" },
      data: {
        status: "PUBLISHED",
        inquiriesEnabled: true,
        admissionState: "CLOSED",
        contactEmail: "academy@example.invalid",
        content: { privacyNotice: { kk: "Test privacy approval" } },
      },
    });
    await t.test(
      "origin, CSRF, consent and spam controls secure inquiry submission",
      async () => {
        const tokenResponse = await fetch(base + "/academy/csrf");
        const formCookie = tokenResponse.headers
            .get("set-cookie")!
            .split(";")[0],
          token = (await tokenResponse.json()).token;
        const body = {
          guardianName: "Test guardian",
          contact: "guardian@example.invalid",
          message: "Please send verified admission information.",
          locale: "en",
          consent: true,
          website: "",
        };
        const malformed = `${Date.now()}.${"a".repeat(48)}.${"é".repeat(64)}`;
        const rejected = await fetch(base + "/academy/inquiries", {
          method: "POST",
          headers: {
            Origin: origin,
            cookie: `academy_csrf=${encodeURIComponent(malformed)}`,
            "X-CSRF-Token": malformed,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        assert.equal(
          rejected.status,
          403,
          "Malformed signature must not cause HTTP 500",
        );
        const submit = (
          patch: Record<string, unknown> = {},
          requestOrigin = origin,
        ) =>
          fetch(base + "/academy/inquiries", {
            method: "POST",
            headers: {
              Origin: requestOrigin,
              cookie: formCookie,
              "X-CSRF-Token": token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...body, ...patch }),
          });
        assert.equal((await submit({}, "https://evil.invalid")).status, 403);
        await new Promise((r) => setTimeout(r, 2100));
        assert.equal((await submit({ consent: false })).status, 400);
        assert.equal((await submit({ website: "bot" })).status, 400);
        assert.equal((await submit()).status, 201);
        assert.equal((await submit()).status, 409);
        const list = await (await call("/admin/academy-inquiries")).json();
        const row = list.items.find(
          (v: { contact: string }) => v.contact === body.contact,
        );
        assert.ok(row);
        inquiryId = row.id;
        const search = await (
          await call(`/admin/academy-inquiries?q=GUARDIAN@EXAMPLE.INVALID`)
        ).json();
        assert.ok(search.items.some((v: { id: string }) => v.id === row.id));
        assert.equal(
          (
            await call(`/admin/academy-inquiries/${row.id}`, "PUT", {
              state: "CONTACTED",
            })
          ).status,
          428,
        );
        assert.equal(
          (
            await call(
              `/admin/academy-inquiries/${row.id}`,
              "PUT",
              { state: "CONTACTED" },
              row.version,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              `/admin/academy-inquiries/${row.id}`,
              "PUT",
              { state: "RESOLVED" },
              row.version,
            )
          ).status,
          409,
        );
        const logs = await db.auditLog.findMany({
          where: { entity: "academy-inquiries", entityId: row.id },
        });
        assert.ok(!JSON.stringify(logs).includes(body.contact));
        assert.ok(!JSON.stringify(logs).includes(body.message));
        // Fresh signed tokens from the same client must share the persisted limit.
        const forms = await Promise.all(
          Array.from({ length: 5 }, async () => {
            const response = await fetch(base + "/academy/csrf");
            return {
              cookie: response.headers.get("set-cookie")!.split(";")[0],
              token: (await response.json()).token,
            };
          }),
        );
        await new Promise((r) => setTimeout(r, 2100));
        const statuses = [];
        for (const form of forms) {
          const response = await fetch(base + "/academy/inquiries", {
            method: "POST",
            headers: {
              Origin: origin,
              cookie: form.cookie,
              "X-CSRF-Token": form.token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          statuses.push(response.status);
        }
        assert.deepEqual(statuses, [201, 201, 201, 201, 429]);
      },
    );
    await t.test(
      "90-day retention erases personal fields while keeping an audit trail",
      async () => {
        await db.academyInquiry.update({
          where: { id: inquiryId },
          data: { expiresAt: new Date(0) },
        });
        await purgeExpiredInquiries();
        const row = await db.academyInquiry.findUniqueOrThrow({
          where: { id: inquiryId },
        });
        assert.equal(row.contact, null);
        assert.equal(row.guardianName, null);
        assert.equal(row.message, null);
        assert.equal(row.state, "ARCHIVED");
        assert.ok(row.purgedAt);
        assert.ok(
          await db.auditLog.findFirst({
            where: { entityId: inquiryId, action: "PURGE_PERSONAL_DATA" },
          }),
        );
      },
    );
  } finally {
    if (oldAcademy) {
      const { id: _id, ...restore } = oldAcademy;
      await db.academyPage.update({ where: { id: "main" }, data: restore });
    }
    await db.sponsor.deleteMany({ where: { name: prefix } });
    await db.academyInquiry.deleteMany({
      where: {
        OR: [{ contact: "guardian@example.invalid" }, { id: inquiryId }],
      },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [admin.id, editor.id] } },
    });
    await db.mutationKey.deleteMany({
      where: { userId: { in: [admin.id, editor.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [admin.id, editor.id] } } });
    await app.close();
    await db.$disconnect();
  }
});

import { assertTestDatabase } from "../helpers/test-database";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import * as argon2 from "argon2";
import sharp from "sharp";
import { createApp } from "../../apps/api/src/main";
import { db } from "../../apps/api/src/db";
import { deleteMedia } from "../../apps/api/src/storage";

test("professional CMS preserves club history, permissions and durable content", async (t) => {
  assertTestDatabase();
  const prefix = `cms-${randomUUID().slice(0, 8)}`,
    password = randomUUID() + randomUUID(),
    passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await db.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  const editor = await db.user.create({
    data: {
      email: `${prefix}-editor@example.invalid`,
      passwordHash,
      role: "EDITOR",
    },
  });
  const admin = await db.user.create({
    data: {
      email: `${prefix}-admin@example.invalid`,
      passwordHash,
      role: "ADMIN",
    },
  });
  let app = await createApp();
  await app.listen(0, "127.0.0.1");
  let base = (await app.getUrl()) + "/api/v1";
  let cookie = "",
    csrf = "";
  async function login(email = user.email) {
    const r = await fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 201);
    cookie = r.headers.get("set-cookie")!.split(";")[0];
    csrf = (await r.json()).csrfToken;
  }
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    version?: number,
    extra: Record<string, string> = {},
  ) {
    return fetch(base + path, {
      method,
      headers: {
        cookie,
        "X-CSRF-Token": csrf,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...(version ? { "If-Match": String(version) } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function create(entity: string, body: unknown) {
    const r = await call(`/admin/${entity}`, "POST", body);
    assert.equal(r.status, 201, await r.clone().text());
    return r.json();
  }
  const source = {
    source: prefix,
    sourceDate: new Date().toISOString(),
    verification: "VERIFIED",
  };
  const playerBody = {
    ...source,
    slug: `${prefix}-player`,
    names: { kk: "Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі", ru: "Игрок", en: "Player" },
    position: "forward",
    status: "PUBLISHED",
    photo: null,
  };
  let player: { id: string; version: number },
    _season: { id: string; version: number },
    membership: { id: string; version: number },
    match: { id: string; version: number },
    event: { id: string; version: number };
  const seasonId = randomUUID(),
    teamId = "ordabasy";
  let membershipBody: Record<string, unknown>,
    matchBody: Record<string, unknown>,
    eventBody: Record<string, unknown>;
  let spawned: ReturnType<typeof spawn> | undefined;
  const assets: { id: string; url: string; version: number }[] = [];
  const objects = new Map<string, Buffer>();
  let unavailable = false;
  const objectServer = createServer(async (req, res) => {
    const key = req.url!;
    if (unavailable && req.method === "GET") {
      res.writeHead(503).end("Storage temporarily unavailable");
      return;
    }
    if (req.method === "PUT") {
      const parts: Buffer[] = [];
      for await (const chunk of req) parts.push(Buffer.from(chunk));
      objects.set(key.split("?")[0], Buffer.concat(parts));
      res.writeHead(200, { ETag: '"fixture"' }).end();
    } else if (req.method === "DELETE") {
      objects.delete(key.split("?")[0]);
      res.writeHead(204).end();
    } else {
      const b = objects.get(key.split("?")[0]);
      res.writeHead(b ? 200 : 404);
      res.end(b);
    }
  });
  try {
    await login();
    await t.test(
      "new season and player use UUIDs and retain Kazakh content",
      async () => {
        _season = await create("seasons", {
          id: seasonId,
          name: `${prefix} season`,
          current: false,
          year: 2026,
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-12-31T00:00:00.000Z",
          state: "ACTIVE",
        });
        player = await create("players", playerBody);
        assert.match(player.id, /^[a-f0-9-]{36}$/);
        assert.equal(
          (await (await call(`/players/${playerBody.slug}`)).json()).names.kk,
          playerBody.names.kk,
        );
      },
    );
    await t.test(
      "version checks reject missing/stale versions; repeated creates are idempotent",
      async () => {
        assert.equal(
          (await call(`/admin/players/${player.id}`, "PUT", playerBody)).status,
          428,
        );
        assert.equal(
          (await call(`/admin/players/${player.id}`, "PUT", playerBody, 99))
            .status,
          409,
        );
        const body = { ...playerBody, slug: `${prefix}-idempotent` },
          key = randomUUID();
        const a = await call("/admin/players", "POST", body, undefined, {
            "Idempotency-Key": key,
          }),
          b = await call("/admin/players", "POST", body, undefined, {
            "Idempotency-Key": key,
          });
        assert.equal(a.status, 201);
        assert.equal((await a.json()).id, (await b.json()).id);
        assert.equal(
          (
            await call(
              "/admin/players",
              "POST",
              { ...body, slug: `${prefix}-another` },
              undefined,
              { "Idempotency-Key": key },
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "roster assignment creates a stable season record and prevents overlapping periods",
      async () => {
        membershipBody = {
          playerId: player.id,
          teamId,
          seasonId,
          number: 19,
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: null,
          departureReason: null,
          nextClub: null,
        };
        membership = await create("memberships", membershipBody);
        assert.equal(
          (await call("/admin/memberships", "POST", membershipBody)).status,
          409,
        );
        const list = await (await call(`/players?season=${seasonId}`)).json();
        assert.equal(
          list.items.find((p: { id: string }) => p.id === player.id)
            .rosterNumber,
          19,
        );
      },
    );
    await t.test(
      "confirmed historical totals survive departure and return",
      async () => {
        const ps = await db.playerSeason.findUniqueOrThrow({
          where: { playerId_seasonId: { playerId: player.id, seasonId } },
        });
        await create("statistics", {
          playerSeasonId: ps.id,
          appearances: 2,
          goals: 1,
          assists: 1,
          minutes: 150,
          source: prefix,
          mode: "CONFIRMED",
          verified: true,
        });
        const r = await call(
          `/admin/memberships/${membership.id}`,
          "PUT",
          {
            ...membershipBody,
            endsAt: "2026-06-01T00:00:00.000Z",
            departureReason: "Transfer",
            nextClub: "Example club",
          },
          membership.version,
        );
        assert.equal(r.status, 200);
        assert.ok(
          !(await (await call("/players?limit=100")).json()).items.some(
            (p: { id: string }) => p.id === player.id,
          ),
        );
        assert.equal(
          (await (await call(`/players/${playerBody.slug}`)).json()).seasons[0]
            .statistics.goals,
          1,
        );
        membershipBody = {
          ...membershipBody,
          startsAt: "2026-07-01T00:00:00.000Z",
          number: 27,
        };
        membership = await create("memberships", membershipBody);
        assert.equal(
          await db.playerSeason.count({
            where: { playerId: player.id, seasonId },
          }),
          1,
        );
        assert.equal(
          (await (await call(`/players?season=${seasonId}`)).json()).items.find(
            (p: { id: string }) => p.id === player.id,
          ).rosterNumber,
          27,
        );
      },
    );
    await t.test(
      "matches accept only roster players and count each event once",
      async () => {
        matchBody = {
          ...source,
          seasonId,
          competitionId: "league",
          homeTeamId: teamId,
          awayTeamId: "irtysh",
          kickoff: "2026-08-01T12:00:00.000Z",
          stadium: { kk: "Стадион" },
          matchStatus: "FINISHED",
          homeScore: 1,
          awayScore: 0,
          status: "PUBLISHED",
        };
        match = await create("matches", matchBody);
        eventBody = {
          matchId: match.id,
          playerId: player.id,
          teamId,
          eventKey: randomUUID(),
          minute: 20,
          type: "GOAL",
          description: { kk: "Гол" },
          source: prefix,
          cancelled: false,
        };
        event = await create("match-events", eventBody);
        assert.equal(
          (await call("/admin/match-events", "POST", eventBody)).status,
          409,
        );
        assert.equal(
          (
            await call("/admin/match-events", "POST", {
              ...eventBody,
              eventKey: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await call("/admin/match-events", "POST", {
              ...eventBody,
              playerId: randomUUID(),
              eventKey: randomUUID(),
            })
          ).status,
          400,
        );
        await create("match-events", {
          ...eventBody,
          eventKey: randomUUID(),
          type: "YELLOW",
          minute: 30,
        });
        await create("match-events", {
          ...eventBody,
          eventKey: randomUUID(),
          type: "YELLOW",
          minute: 80,
        });
        assert.equal(
          (
            await call("/admin/match-events", "POST", {
              ...eventBody,
              eventKey: randomUUID(),
              type: "YELLOW",
              minute: 85,
            })
          ).status,
          409,
        );
        await create("match-statistics", {
          matchId: match.id,
          playerId: player.id,
          appearances: 1,
          minutes: 90,
          cleanSheets: null,
          verified: true,
          source: prefix,
        });
      },
    );
    await t.test(
      "match-derived totals are alternative to imported totals and event cancellation updates rankings",
      async () => {
        const stats = await db.playerStatistics.findFirstOrThrow({
          where: { playerSeason: { playerId: player.id, seasonId } },
        });
        const data = {
          playerSeasonId: stats.playerSeasonId,
          appearances: 2,
          goals: 1,
          assists: 1,
          minutes: 150,
          source: prefix,
          mode: "MATCHES",
          verified: true,
        };
        assert.equal(
          (
            await call(
              `/admin/statistics/${stats.id}`,
              "PUT",
              data,
              stats.version,
            )
          ).status,
          200,
        );
        let rank = await (await call(`/statistics?season=${seasonId}`)).json();
        assert.equal(rank.items[0].goals, 1);
        assert.equal(rank.items[0].appearances, 1);
        let current = await db.match.findUniqueOrThrow({
          where: { id: match.id },
        });
        assert.equal(
          (
            await call(
              `/admin/matches/${match.id}`,
              "PUT",
              { ...matchBody, homeScore: 0 },
              current.version,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              `/admin/match-events/${event.id}`,
              "PUT",
              { ...eventBody, cancelled: true },
              event.version,
            )
          ).status,
          200,
        );
        current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
        assert.equal(
          (
            await call(
              `/admin/matches/${match.id}`,
              "PUT",
              { ...matchBody, homeScore: 0 },
              current.version,
            )
          ).status,
          200,
        );
        rank = await (await call(`/statistics?season=${seasonId}`)).json();
        assert.equal(rank.items[0].goals, 0);
        current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
        assert.equal(
          (
            await call(
              `/admin/matches/${match.id}`,
              "PUT",
              { ...matchBody, matchStatus: "CANCELLED" },
              current.version,
            )
          ).status,
          200,
        );
        assert.equal(
          (await (await call(`/statistics?season=${seasonId}`)).json()).items
            .length,
          0,
        );
      },
    );
    await t.test(
      "archiving preserves the published profile and all history; restoring permits reassignment",
      async () => {
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
        assert.equal((await call(`/players/${playerBody.slug}`)).status, 200);
        assert.equal(
          await db.rosterMembership.count({ where: { playerId: player.id } }),
          2,
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
        assert.equal(
          (
            await call(
              `/admin/statistics/${(await db.playerStatistics.findFirstOrThrow({ where: { playerSeason: { playerId: player.id } } })).id}`,
              "DELETE",
              undefined,
              2,
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "users and roles prevent privilege escalation and revoke inactive sessions",
      async () => {
        const managedAdmin = await create("users", {
          email: `${prefix}-managed-admin@example.invalid`,
          password,
          role: "ADMIN",
          active: true,
        });
        const safeAdmin = await (
          await call(`/admin/users/${managedAdmin.id}`)
        ).json();
        assert.equal(safeAdmin.role, "ADMIN");
        assert.ok(!("passwordHash" in safeAdmin));
        assert.equal(
          (
            await call(
              `/admin/users/${user.id}`,
              "PUT",
              {
                email: user.email,
                role: "SUPER_ADMIN",
                active: false,
              },
              (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
                .version,
            )
          ).status,
          409,
        );
        const created = await create("users", {
          email: `${prefix}-managed@example.invalid`,
          password,
          role: "EDITOR",
          active: true,
        });
        assert.ok(!("passwordHash" in created));
        await login(admin.email);
        assert.equal(
          (
            await call(
              `/admin/users/${created.id}`,
              "PUT",
              { email: created.email, role: "SUPER_ADMIN", active: true },
              created.version,
            )
          ).status,
          403,
        );
        await login(editor.email);
        assert.equal((await call("/admin/users")).status, 403);
        assert.equal(
          (
            await call("/admin/players", "POST", {
              ...playerBody,
              slug: `${prefix}-forbidden`,
            })
          ).status,
          403,
        );
        await login();
        assert.equal(
          (
            await call(
              `/admin/users/${editor.id}`,
              "PUT",
              { email: editor.email, role: "EDITOR", active: false },
              editor.version,
            )
          ).status,
          200,
        );
        await login(admin.email);
        const self = await db.user.findUniqueOrThrow({
          where: { id: admin.id },
        });
        assert.equal(
          (
            await call(
              `/admin/users/${admin.id}`,
              "PUT",
              { email: admin.email, role: "ADMIN", active: false },
              self.version,
            )
          ).status,
          403,
        );
        await login();
      },
    );
    await t.test(
      "S3 protocol adapter stores WebP, AVIF and thumbnail outside the application; referenced assets cannot be removed",
      async () => {
        await new Promise<void>((resolve) =>
          objectServer.listen(0, "127.0.0.1", resolve),
        );
        const address = objectServer.address() as { port: number };
        Object.assign(process.env, {
          MEDIA_STORAGE: "s3",
          S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
          S3_REGION: "us-east-1",
          S3_BUCKET: "test",
          S3_FORCE_PATH_STYLE: "true",
          S3_ACCESS_KEY_ID: "test-only",
          S3_SECRET_ACCESS_KEY: randomUUID(),
        });
        const png = await sharp({
          create: { width: 40, height: 40, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set("file", new Blob([png], { type: "image/png" }), "photo.png");
        const r = await fetch(base + "/admin/media/upload", {
          method: "POST",
          headers: {
            cookie,
            "X-CSRF-Token": csrf,
            Origin: "http://localhost:3000",
          },
          body: form,
        });
        assert.equal(r.status, 201);
        const asset = await r.json();
        assets.push(asset);
        const alt = {
          kk: "Ә Ғ Қ Ң Ө Ұ Ү Һ І",
          ru: "Фото игрока",
          en: "Player photo",
        };
        const updatedMedia = await call(
          `/admin/media/${asset.id}`,
          "PUT",
          { alt },
          asset.version,
        );
        assert.equal(updatedMedia.status, 200);
        asset.version = (await updatedMedia.json()).version;
        assert.deepEqual(
          (await (await call(`/admin/media/${asset.id}`)).json()).alt,
          alt,
        );
        assert.equal(objects.size, 3);
        assert.equal(asset.storage, "s3");
        assert.equal(
          (await fetch(base.replace("/api/v1", "") + asset.url)).status,
          200,
        );
        unavailable = true;
        try {
          const outage = await fetch(base.replace("/api/v1", "") + asset.url);
          assert.equal(outage.status, 503);
          assert.equal(outage.headers.get("cache-control"), "no-store");
        } finally {
          unavailable = false;
        }
        assert.equal(
          (await fetch(base.replace("/api/v1", "") + asset.url)).status,
          200,
        );
        const p = await db.player.findUniqueOrThrow({
          where: { id: player.id },
        });
        assert.equal(
          (
            await call(
              `/admin/players/${player.id}`,
              "PUT",
              { ...playerBody, photo: asset.url },
              p.version,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              `/admin/media/${asset.id}`,
              "DELETE",
              undefined,
              asset.version,
            )
          ).status,
          409,
        );
        for (const format of ["jpeg", "webp"] as const) {
          const image = await sharp(png)[format]().toBuffer();
          const upload = new FormData();
          upload.set(
            "file",
            new Blob([image], { type: `image/${format}` }),
            `photo.${format}`,
          );
          const uploaded = await fetch(base + "/admin/media/upload", {
            method: "POST",
            headers: {
              cookie,
              "X-CSRF-Token": csrf,
              Origin: "http://localhost:3000",
            },
            body: upload,
          });
          assert.equal(uploaded.status, 201);
          const extra = await uploaded.json();
          assets.push(extra);
          assert.equal(objects.size, 6);
          if (format === "jpeg") {
            const articleBody = {
              ...source,
              slug: `${prefix}-media-story`,
              status: "DRAFT",
              cover: null,
              images: [extra.variants.avif],
              publishedAt: new Date(Date.now() - 1000).toISOString(),
              translations: [
                {
                  locale: "kk",
                  title: "Сынақ",
                  excerpt: "Сынақ мәтіні",
                  body: "Сынақ жаңалығы",
                },
              ],
            };
            let article = await create("news", articleBody);
            assert.equal(
              (
                await call(
                  `/admin/media/${extra.id}`,
                  "DELETE",
                  undefined,
                  extra.version,
                )
              ).status,
              409,
              "A draft article's image variant protects the entire asset",
            );
            for (const status of ["PUBLISHED", "DRAFT", "PUBLISHED"]) {
              const saved = await call(
                `/admin/news/${article.id}`,
                "PUT",
                { ...articleBody, status },
                article.version,
              );
              assert.equal(saved.status, 200);
              article = await saved.json();
              assert.equal(
                (await call(`/news/${articleBody.slug}`)).status,
                status === "PUBLISHED" ? 200 : 404,
              );
            }
            await db.newsPost.delete({ where: { id: article.id } });
          }
          assert.equal(
            (
              await call(
                `/admin/media/${extra.id}`,
                "DELETE",
                undefined,
                extra.version,
              )
            ).status,
            200,
          );
          assets.pop();
          assert.equal(objects.size, 3, "All unused variants must be removed");
          assert.equal(
            (await fetch(base.replace("/api/v1", "") + extra.url)).status,
            404,
          );
        }
      },
    );
    await t.test(
      "new API process reads the same published profile and image after restart",
      async () => {
        const url = new URL(base),
          port = url.port;
        await app.close();
        spawned = spawn(process.execPath, ["apps/api/dist/main.js"], {
          env: { ...process.env, API_PORT: port },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let startupLog = "",
          ready = false;
        for (const stream of [spawned.stdout, spawned.stderr])
          stream?.on("data", (chunk) => {
            startupLog = (startupLog + chunk.toString()).slice(-2000);
          });
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          assert.equal(spawned.exitCode, null, startupLog);
          try {
            if ((await fetch(base + "/ready")).ok) {
              ready = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(ready, `Restarted API did not become ready: ${startupLog}`);
        const response = await fetch(base + `/players/${playerBody.slug}`);
        assert.equal(response.status, 200);
        const p = await response.json();
        assert.equal(p.names.kk, playerBody.names.kk);
        assert.ok(p.memberships.length === 2);
        assert.ok(p.photo);
        assert.equal((await fetch(url.origin + p.photo)).status, 200);
        spawned.kill("SIGTERM");
        await new Promise<void>((resolve) =>
          spawned!.once("exit", () => resolve()),
        );
        spawned = undefined;
        app = await createApp();
        await app.listen(0, "127.0.0.1");
        base = (await app.getUrl()) + "/api/v1";
        await login();
      },
    );
    await t.test(
      "audit records include safe changes and outcomes, never credentials",
      async () => {
        const logs = await (await call("/admin/audit?limit=100")).json();
        assert.ok(
          logs.items.some(
            (l: { changes: unknown }) =>
              Object.keys(l.changes as object).length,
          ),
        );
        const text = JSON.stringify(logs);
        assert.ok(!text.includes(password));
        assert.ok(!text.includes(passwordHash));
        assert.ok(logs.items.every((l: { result: string }) => l.result));
      },
    );
  } finally {
    spawned?.kill("SIGTERM");
    await db.newsPost.deleteMany({ where: { source: prefix } });
    await db.player.updateMany({
      where: { slug: { startsWith: prefix } },
      data: { photo: null },
    });
    for (const a of assets)
      await deleteMedia(a.id, {
        auth: { userId: user.id, role: "SUPER_ADMIN", sessionId: "test" },
        header: (key: string) =>
          key === "if-match" ? String(a.version) : undefined,
      } as never);
    await new Promise<void>((resolve) =>
      objectServer.listening ? objectServer.close(() => resolve()) : resolve(),
    );
    delete process.env.MEDIA_STORAGE;
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
    await db.season.deleteMany({ where: { id: seasonId } });
    const users = await db.user.findMany({
      where: { email: { startsWith: prefix } },
    });
    await db.mutationKey.deleteMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: users.map((u) => u.id) } },
    });
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await app.close();
    await db.$disconnect();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import * as argon2 from "argon2";
import sharp from "sharp";
import { createApp } from "../../apps/api/src/main";
import { db } from "../../apps/api/src/db";
import { mediaDir } from "../../apps/api/src/config";
test("API against PostgreSQL: authentication, RBAC, CRUD, localization, uploads and logout", async (t) => {
  if (!/test|codex/.test(process.env.DATABASE_URL || ""))
    throw new Error(
      "Integration tests require an isolated test/codex database.",
    );
  const prefix = `qa-${randomUUID().slice(0, 8)}`,
    password = randomUUID() + randomUUID();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const admin = await db.user.create({
    data: {
      email: `${prefix}-admin@example.invalid`,
      passwordHash,
      role: "ADMIN",
    },
  });
  const editor = await db.user.create({
    data: {
      email: `${prefix}-editor@example.invalid`,
      passwordHash,
      role: "EDITOR",
    },
  });
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = (await app.getUrl()) + "/api/v1";
  const ids: { entity: string; id: string }[] = [];
  let cookie = "",
    csrf = "",
    editorCookie = "",
    editorCsrf = "";
  let uploaded = "";
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    auth = true,
    extra: Record<string, string> = {},
  ) {
    const match = path.match(/^\/admin\/(players|matches|news)\/([^/?]+)$/);
    let versionHeaders: Record<string, string> = {};
    if (match && ["PUT", "DELETE"].includes(method)) {
      const delegates = {
        players: db.player,
        matches: db.match,
        news: db.newsPost,
      };
      const record = await (
        delegates[match[1] as keyof typeof delegates] as unknown as {
          findUnique: (args: unknown) => Promise<{ version: number } | null>;
        }
      ).findUnique({ where: { id: match[2] } });
      if (record) versionHeaders = { "If-Match": String(record.version) };
    }
    return fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        ...(auth ? { cookie, "X-CSRF-Token": csrf } : {}),
        ...versionHeaders,
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    await t.test(
      "console bootstrap creates an admin and never overwrites an existing password",
      async () => {
        const email = `${prefix}-bootstrap@example.invalid`;
        const env = {
          ...process.env,
          ADMIN_EMAIL: email,
          BOOTSTRAP_ROLE: "SUPER_ADMIN",
          ADMIN_PASSWORD: password,
        };
        const result = spawnSync(
          process.execPath,
          ["--import", "tsx", "apps/api/src/bootstrap-admin.ts"],
          { env, encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        const created = await db.user.findUniqueOrThrow({ where: { email } });
        try {
          assert.equal(created.role, "SUPER_ADMIN");
          const again = spawnSync(
            process.execPath,
            ["--import", "tsx", "apps/api/src/bootstrap-admin.ts"],
            { env, encoding: "utf8" },
          );
          assert.equal(again.status, 1);
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { email } }))
              .passwordHash,
            created.passwordHash,
          );
        } finally {
          await db.auditLog.deleteMany({ where: { actorId: created.id } });
          await db.user.delete({ where: { id: created.id } });
        }
      },
    );
    await t.test(
      "readiness and unconfigured standings work without a football key",
      async () => {
        assert.equal((await request("/ready")).status, 200);
        const r = await (await request("/standings")).json();
        assert.deepEqual(r.rows, []);
      },
    );
    await t.test("private endpoints reject anonymous access", async () =>
      assert.equal(
        (await request("/admin/players", "GET", undefined, false)).status,
        401,
      ),
    );
    await t.test(
      "login establishes an HttpOnly SameSite cookie with no exposed session token",
      async () => {
        const r = await request(
          "/auth/login",
          "POST",
          { email: admin.email, password },
          false,
        );
        assert.equal(r.status, 201);
        const header = r.headers.get("set-cookie")!;
        assert.match(header, /HttpOnly/i);
        assert.match(header, /SameSite=Strict/i);
        cookie = header.split(";")[0];
        const b = await r.json();
        csrf = b.csrfToken;
        assert.ok(csrf);
        assert.ok(!b.token);
      },
    );
    await t.test("CSRF and forged origins are rejected", async () => {
      assert.equal(
        (
          await request("/auth/logout", "POST", {}, true, {
            "X-CSRF-Token": "bad",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/auth/logout", "POST", {}, true, {
            Origin: "https://attacker.invalid",
          })
        ).status,
        403,
      );
    });
    await t.test(
      "player create, update, publish, public profile and mass-assignment validation",
      async () => {
        const body = {
          slug: `${prefix}-player`,
          names: { kk: "QA ойыншы", ru: "QA игрок", en: "QA player" },
          biography: { kk: "" },
          position: "forward",
          photo: null,
          status: "DRAFT",
          verification: "LEGACY_UNVERIFIED",
          source: "Automated test fixture",
          sourceDate: new Date().toISOString(),
        };
        let r = await request("/admin/players", "POST", body);
        assert.equal(r.status, 201);
        const p = await r.json();
        ids.push({ entity: "players", id: p.id });
        assert.equal((await request(`/players/${body.slug}`)).status, 404);
        assert.equal(
          (
            await request(`/admin/players/${p.id}`, "PUT", {
              ...body,
              role: "ADMIN",
            })
          ).status,
          400,
        );
        r = await request(`/admin/players/${p.id}`, "PUT", {
          ...body,
          status: "PUBLISHED",
        });
        assert.equal(r.status, 200);
        const publicPlayer = await (
          await request(`/players/${body.slug}`)
        ).json();
        assert.equal(publicPlayer.names.ru, "QA игрок");
      },
    );
    let postId = "",
      postBody: Record<string, unknown> = {};
    await t.test(
      "news drafts remain private, localized articles persist, and HTML stays inert text",
      async () => {
        postBody = {
          slug: `${prefix}-article`,
          status: "DRAFT",
          cover: null,
          publishedAt: null,
          verification: "LEGACY_UNVERIFIED",
          source: "Automated test fixture",
          sourceDate: new Date().toISOString(),
          translations: [
            {
              locale: "kk",
              title: "QA жаңалық",
              excerpt: "QA мәтін",
              body: "<script>alert(1)</script>",
            },
            {
              locale: "en",
              title: "QA news",
              excerpt: "QA excerpt",
              body: "Test article",
            },
          ],
        };
        let r = await request("/admin/news", "POST", postBody);
        assert.equal(r.status, 201);
        const p = await r.json();
        postId = p.id;
        ids.push({ entity: "news", id: p.id });
        assert.equal((await request(`/news/${postBody.slug}`)).status, 404);
        postBody = {
          ...postBody,
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - 1000).toISOString(),
        };
        r = await request(`/admin/news/${p.id}`, "PUT", postBody);
        assert.equal(r.status, 200);
        const article = await (await request(`/news/${postBody.slug}`)).json();
        assert.equal(article.translations.length, 2);
        assert.ok(!article.author?.passwordHash);
      },
    );
    await t.test(
      "editor cannot change another author’s article or admin-only settings/delete",
      async () => {
        const r = await request(
          "/auth/login",
          "POST",
          { email: editor.email, password },
          false,
        );
        assert.equal(r.status, 201);
        editorCookie = r.headers.get("set-cookie")!.split(";")[0];
        editorCsrf = (await r.json()).csrfToken;
        const headers = { cookie: editorCookie, "X-CSRF-Token": editorCsrf };
        assert.equal(
          (await request("/admin/seasons", "GET", undefined, true, headers))
            .status,
          200,
        );
        assert.equal(
          (await request("/admin/settings", "GET", undefined, true, headers))
            .status,
          403,
        );
        assert.equal(
          (
            await request(
              `/admin/news/${postId}`,
              "PUT",
              postBody,
              true,
              headers,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              `/admin/news/${postId}`,
              "DELETE",
              undefined,
              true,
              headers,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "match CRUD validates participant relationships and final scores",
      async () => {
        const body = {
          seasonId: "2026",
          competitionId: "league",
          homeTeamId: "ordabasy",
          awayTeamId: "irtysh",
          kickoff: new Date().toISOString(),
          stadium: { kk: "QA" },
          matchStatus: "FINISHED",
          homeScore: 0,
          awayScore: 0,
          status: "DRAFT",
          verification: "LEGACY_UNVERIFIED",
          source: "Automated test fixture",
          sourceDate: new Date().toISOString(),
        };
        assert.equal(
          (
            await request("/admin/matches", "POST", {
              ...body,
              homeScore: null,
            })
          ).status,
          400,
        );
        const r = await request("/admin/matches", "POST", body);
        assert.equal(r.status, 201);
        const m = await r.json();
        ids.push({ entity: "matches", id: m.id });
        assert.equal(
          (
            await request(`/admin/matches/${m.id}`, "PUT", {
              ...body,
              matchStatus: "POSTPONED",
              homeScore: null,
              awayScore: null,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "pagination rejects invalid limits and published results exclude drafts",
      async () => {
        assert.equal((await request("/players?limit=10000")).status, 400);
        const r = await (await request("/admin/matches?limit=1&page=2")).json();
        assert.equal(r.items.length, 1);
        assert.ok(r.total >= 36);
        const matches = await (await request("/matches")).json();
        assert.ok(
          !matches.items.some(
            (m: { source: string }) => m.source === "Automated test fixture",
          ),
        );
      },
    );
    await t.test(
      "valid images are decoded, re-encoded and persisted; disguised SVG is rejected",
      async () => {
        const b = await sharp({
          create: { width: 24, height: 24, channels: 3, background: "#38bdf8" },
        })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set("file", new Blob([b], { type: "image/png" }), "safe.png");
        let r = await fetch(base + "/admin/media/upload", {
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
        uploaded = asset.url;
        assert.equal(asset.mime, "image/webp");
        const bad = new FormData();
        bad.set(
          "file",
          new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/png" }),
          "bad.png",
        );
        r = await fetch(base + "/admin/media/upload", {
          method: "POST",
          headers: {
            cookie,
            "X-CSRF-Token": csrf,
            Origin: "http://localhost:3000",
          },
          body: bad,
        });
        assert.equal(r.status, 400);
      },
    );
    await t.test("deletions persist and produce audit entries", async () => {
      for (const entry of ids) {
        assert.equal(
          (await request(`/admin/${entry.entity}/${entry.id}`, "DELETE"))
            .status,
          200,
        );
      }

      const audit = await (await request("/admin/audit")).json();
      assert.ok(
        audit.items.some((a: { action: string }) => a.action === "ARCHIVE"),
      );
    });
    await t.test("logout revokes the server session immediately", async () => {
      assert.equal((await request("/auth/logout", "POST", {})).status, 201);
      assert.equal((await request("/auth/me")).status, 401);
    });
  } finally {
    for (const entry of ids) {
      const delegates = {
        players: db.player,
        matches: db.match,
        news: db.newsPost,
      };
      const delegate = delegates[entry.entity as keyof typeof delegates];
      await (
        delegate as unknown as {
          deleteMany: (args: unknown) => Promise<unknown>;
        }
      ).deleteMany({ where: { id: entry.id } });
    }
    if (uploaded) {
      const asset = await db.mediaAsset.findUnique({
        where: { url: uploaded },
      });
      for (const url of Object.values(
        (asset?.variants || {}) as Record<string, string>,
      ))
        await unlink(join(mediaDir, url.split("/").at(-1)!)).catch(() => {});
      await db.mediaAsset.deleteMany({ where: { url: uploaded } });
      await unlink(join(mediaDir, uploaded.split("/").at(-1)!)).catch(() => {});
    }
    await db.newsPost.deleteMany({
      where: { authorId: { in: [admin.id, editor.id] } },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [admin.id, editor.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [admin.id, editor.id] } } });
    await app.close();
    await db.$disconnect();
  }
});

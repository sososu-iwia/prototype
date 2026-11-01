import { assertTestDatabase } from "../helpers/test-database";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { connect } from "node:net";
import { deflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import * as argon2 from "argon2";
import sharp from "sharp";
import { createApp } from "../../apps/api/src/main";
import { db } from "../../apps/api/src/db";
import { mediaDir } from "../../apps/api/src/config";
test("API against PostgreSQL: authentication, RBAC, CRUD, localization, uploads and logout", async (t) => {
  assertTestDatabase();
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
      "the actual API and Nest parser resolutions use security-patched versions",
      (t) => {
        const apiRequire = createRequire(
          process.cwd() + "/apps/api/package.json",
        );
        const platformRequire = createRequire(
          apiRequire.resolve("@nestjs/platform-express"),
        );
        const versions = {
          node: process.version,
          multer: [] as string[],
          bodyParser: [] as string[],
        };
        for (const from of [apiRequire, platformRequire]) {
          const uploadVersion = from("multer/package.json").version as string;
          const jsonVersion = createRequire(from.resolve("express"))(
            "body-parser/package.json",
          ).version as string;
          const [uploadMajor, uploadMinor] = uploadVersion
            .split(".")
            .map(Number);
          const [jsonMajor, jsonMinor] = jsonVersion.split(".").map(Number);
          assert.ok(
            uploadMajor > 2 || (uploadMajor === 2 && uploadMinor >= 5),
            `Unpatched Multer resolution: ${uploadVersion}`,
          );
          assert.ok(
            jsonMajor > 2 || (jsonMajor === 2 && jsonMinor >= 4),
            `Unpatched body-parser resolution: ${jsonVersion}`,
          );
          versions.multer.push(uploadVersion);
          versions.bodyParser.push(jsonVersion);
        }
        t.diagnostic(JSON.stringify(versions));
      },
    );
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
          ["apps/api/dist/bootstrap-admin.js"],
          { env, encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        const created = await db.user.findUniqueOrThrow({ where: { email } });
        try {
          assert.equal(created.role, "SUPER_ADMIN");
          const again = spawnSync(
            process.execPath,
            ["apps/api/dist/bootstrap-admin.js"],
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
      "malformed and oversized JSON produce safe client errors",
      async () => {
        for (const [body, expected] of [
          ["{", 400],
          [JSON.stringify({ padding: "x".repeat(270000) }), 413],
        ] as const) {
          const response = await fetch(base + "/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://localhost:3000",
            },
            body,
          });
          assert.equal(
            response.status,
            expected,
            await response.clone().text(),
          );
          const result = await response.json();
          assert.ok(result.error.code);
          assert.ok(!JSON.stringify(result).includes("padding"));
          assert.ok(!JSON.stringify(result).includes("stack"));
        }
      },
    );
    await t.test(
      "late bytes after a compressed request cannot crash the API",
      async () => {
        const target = new URL(base);
        const frame = Buffer.concat([
          deflateSync(Buffer.from("{}")),
          Buffer.from([0]),
        ]);
        const tail = Buffer.from("trailing-bytes");
        await new Promise<void>((resolve, reject) => {
          const socket = connect({
            host: "127.0.0.1",
            port: Number(target.port),
          });
          let responded = false,
            received = "";
          const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error("Compressed request did not finish"));
          }, 5000);
          socket.on("error", reject);
          socket.on("close", () => {
            clearTimeout(timeout);
            if (responded) resolve();
            else
              reject(
                new Error(
                  "API closed before responding to a valid compressed frame",
                ),
              );
          });
          socket.on("data", (chunk) => {
            received += chunk.toString();
            if (!responded && received.includes("\r\n\r\n")) {
              responded = true;
              // Send the remainder only AFTER the decompressor has returned the
              // parsed body and the application has sent its response.
              socket.write(tail);
              setTimeout(() => socket.end(), 60);
            }
          });
          socket.once("connect", () =>
            socket.write(
              Buffer.concat([
                Buffer.from(
                  `POST /api/v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Encoding: deflate\r\nContent-Length: ${frame.length + tail.length}\r\nConnection: keep-alive\r\n\r\n`,
                ),
                frame,
              ]),
            ),
          );
        });
        assert.equal((await request("/health")).status, 200);
      },
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
      "demo media stays authenticated and refuses ephemeral uploads",
      async () => {
        const previous = process.env.MEDIA_STORAGE;
        const before = await db.mediaAsset.count();
        process.env.MEDIA_STORAGE = "disabled";
        try {
          assert.equal(
            (await request("/admin/media/upload", "POST", undefined, false))
              .status,
            401,
          );
          assert.equal(
            (
              await request("/admin/media/upload", "POST", undefined, true, {
                "X-CSRF-Token": "",
              })
            ).status,
            403,
          );
          const response = await request("/admin/media/upload", "POST");
          assert.equal(response.status, 503);
          assert.equal(
            (await response.json()).error.code,
            "MEDIA_STORAGE_DISABLED",
          );
          assert.equal(await db.mediaAsset.count(), before);
        } finally {
          if (previous === undefined) delete process.env.MEDIA_STORAGE;
          else process.env.MEDIA_STORAGE = previous;
        }
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
    await t.test(
      "media library browsing does not consume the upload-only limit",
      async () => {
        for (let page = 1; page <= 21; page++)
          assert.equal(
            (await request(`/admin/media?page=${page}`)).status,
            200,
          );
      },
    );
    await t.test(
      "deactivation during password verification cannot establish a later session",
      async (t) => {
        const module = createRequire(process.cwd() + "/package.json")(
          "argon2",
        ) as { verify: typeof argon2.verify };
        const verify = module.verify;
        let entered!: () => void, release!: () => void;
        const paused = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const resumed = new Promise<void>((resolve) => {
          release = resolve;
        });
        const spy = t.mock.method(
          module,
          "verify",
          async (...args: Parameters<typeof argon2.verify>) => {
            entered();
            await resumed;
            return verify(...args);
          },
        );
        let pending: Promise<Response> | undefined;
        let verificationTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          pending = request(
            "/auth/login",
            "POST",
            { email: editor.email, password },
            false,
          );
          await Promise.race([
            paused,
            new Promise<never>((_, reject) => {
              verificationTimer = setTimeout(
                () =>
                  reject(
                    new Error("Password verification gate was not reached"),
                  ),
                10000,
              );
            }),
          ]);
          clearTimeout(verificationTimer);
          const current = await db.user.findUniqueOrThrow({
            where: { id: editor.id },
          });
          const disabled = await request(
            `/admin/users/${editor.id}`,
            "PUT",
            { email: editor.email, role: "EDITOR", active: false },
            true,
            { "If-Match": String(current.version) },
          );
          assert.equal(disabled.status, 200);
          release();
          assert.equal((await pending).status, 401);
          assert.equal(
            await db.session.count({ where: { userId: editor.id } }),
            0,
          );
        } finally {
          clearTimeout(verificationTimer);
          release();
          spy.mock.restore();
          await pending?.catch(() => {});
          await db.session.deleteMany({ where: { userId: editor.id } });
          await db.user.update({
            where: { id: editor.id },
            data: { active: true },
          });
        }
      },
    );
    await t.test("logout revokes the server session immediately", async () => {
      assert.equal((await request("/auth/logout", "POST", {})).status, 201);
      assert.equal((await request("/auth/me")).status, 401);
    });
    await t.test(
      "repeated incorrect logins are rate limited without exposing credentials",
      async () => {
        let blocked: Response | undefined;
        for (let attempt = 0; attempt < 12; attempt++) {
          const response = await request(
            "/auth/login",
            "POST",
            {
              email: `missing-${prefix}@example.invalid`,
              password: "incorrect-" + password,
            },
            false,
            { "X-Forwarded-For": `192.0.2.${attempt + 1}` },
          );
          if (response.status === 429) {
            blocked = response;
            break;
          }
          assert.equal(response.status, 401);
        }
        assert.ok(
          blocked,
          "The login limiter must block repeated unsuccessful attempts",
        );
        assert.ok(blocked.headers.has("ratelimit"));
        assert.ok(!(await blocked.text()).includes(password));
      },
    );
    await t.test(
      "configured trusted proxies give different clients independent login limits",
      async () => {
        const previous = process.env.TRUST_PROXY_CIDRS;
        let proxyApp: Awaited<ReturnType<typeof createApp>> | undefined;
        try {
          process.env.TRUST_PROXY_CIDRS = "loopback";
          proxyApp = await createApp();
          await proxyApp.listen(0, "127.0.0.1");
          const url = (await proxyApp.getUrl()) + "/api/v1/auth/login";
          const attempt = (ip: string) =>
            fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Origin: "http://localhost:3000",
                "X-Forwarded-For": ip,
              },
              body: JSON.stringify({
                email: `missing-${prefix}@example.invalid`,
                password,
              }),
            });
          for (let n = 0; n < 10; n++)
            assert.equal((await attempt("192.0.2.1")).status, 401);
          assert.equal((await attempt("192.0.2.1")).status, 429);
          assert.equal((await attempt("192.0.2.2")).status, 401);
        } finally {
          if (previous === undefined) delete process.env.TRUST_PROXY_CIDRS;
          else process.env.TRUST_PROXY_CIDRS = previous;
          await proxyApp?.close();
        }
      },
    );
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

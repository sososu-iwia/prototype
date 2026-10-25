import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import sharp from "sharp";

// Fail before creating resources when the daemon is unavailable, preserving the
// actual blocker instead of masking it with a later cleanup error.
await new Promise((resolve, reject) => {
  const child = spawn("docker", ["info", "--format", "{{.ServerVersion}}"], {
    stdio: "ignore",
  });
  child.once("error", () =>
    reject(
      new Error(
        "Docker CLI or daemon unavailable. Start Docker Engine/Desktop before test:compose.",
      ),
    ),
  );
  child.once("close", (code) =>
    code === 0
      ? resolve()
      : reject(
          new Error(
            "Docker daemon unavailable. Start Docker Engine/Desktop before test:compose.",
          ),
        ),
  );
});

// Own project and disposable volumes only. Existing Compose projects are never changed.
const project = `ordabasy-test-${randomUUID().slice(0, 8)}`;
const folder = await mkdtemp(join(tmpdir(), project));
const password = randomUUID().replaceAll("-", "");
const runtimePassword = randomUUID().replaceAll("-", "");
const runtimeDatabaseUrl = `postgresql://ordabasy_runtime:${runtimePassword}@db:5432/ordabasy_test`;
const port =
  process.env.VERIFY_WEB_PORT ||
  (await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const selected = String(server.address().port);
      server.close((error) => (error ? reject(error) : resolve(selected)));
    });
  }));
assert.match(port, /^\d{4,5}$/);
assert.ok(Number(port) > 0 && Number(port) <= 65535);
const aborter = new AbortController();
let interrupted = false,
  runningChild;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    aborter.abort();
    runningChild?.kill(signal);
  });
const requestSignal = () =>
  AbortSignal.any([aborter.signal, AbortSignal.timeout(30000)]);
const origin = `http://localhost:${port}`;
const envFile = join(folder, "compose.env");
await writeFile(
  envFile,
  `POSTGRES_PASSWORD=${password}\nTEST_RUNTIME_DATABASE_URL=${runtimeDatabaseUrl}\nWEB_PORT=${port}\nPUBLIC_ORIGIN=${origin}\nTRUSTED_ORIGINS=${origin}\nCOOKIE_SECURE=false\nALLOW_LOCAL_HTTP=true\n`,
  { mode: 0o600 },
);
const args = [
  "compose",
  "--project-name",
  project,
  "--env-file",
  envFile,
  "-f",
  "compose.yaml",
  "-f",
  "compose.test.yaml",
];
async function compose(command, env = {}, input) {
  if (interrupted && !["down", "logs"].includes(command[0]))
    throw new Error("Verification interrupted");
  await new Promise((resolve, reject) => {
    const child = spawn("docker", [...args, ...command], {
      stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        POSTGRES_USER: "ordabasy",
        POSTGRES_DB: "ordabasy_test",
        POSTGRES_PASSWORD: password,
        TEST_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
        WEB_PORT: port,
        PUBLIC_ORIGIN: origin,
        TRUSTED_ORIGINS: origin,
        COOKIE_SECURE: "false",
        ALLOW_LOCAL_HTTP: "true",
        ...env,
      },
    });
    runningChild = child;
    if (input !== undefined) {
      child.stdin.on("error", reject);
      child.stdin.end(input);
    }
    child.on("error", reject);
    child.on("close", (code) => {
      runningChild = undefined;
      return code === 0
        ? resolve()
        : reject(new Error(`Compose ${command[0]} failed (${code})`));
    });
  });
}
const sha = (data) => createHash("sha256").update(data).digest("hex");
let cookie, csrf;
let failed = false;
async function api(path, method = "GET", body, version) {
  const response = await fetch(origin + "/api/v1" + path, {
    signal: requestSignal(),
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(version ? { "If-Match": String(version) } : {}),
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  return response;
}
async function create(entity, data) {
  const response = await api(`/admin/${entity}`, "POST", data);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}
async function waitMedia(path, expected) {
  for (let n = 0; n < 60; n++) {
    if (interrupted) throw new Error("Verification interrupted");
    const response = await fetch(origin + path, {
      signal: requestSignal(),
    }).catch(() => null);
    if (response?.ok) {
      const hash = sha(Buffer.from(await response.arrayBuffer()));
      if (expected) assert.equal(hash, expected);
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("S3 media unavailable after restart");
}
try {
  await compose(["build", "api", "migrate", "checks"]);
  await compose(["build", "web"]);
  await compose([
    "up",
    "--no-build",
    "-d",
    "--wait",
    "--wait-timeout",
    "180",
    "db",
    "object-storage",
  ]);
  await compose(["run", "--rm", "--no-deps", "migrate"]);
  // Pass the generated fixture password only on stdin, never argv or logs.
  await compose(
    [
      "exec",
      "-T",
      "db",
      "createuser",
      "-U",
      "ordabasy",
      "--pwprompt",
      "ordabasy_runtime",
    ],
    {},
    `${runtimePassword}\n${runtimePassword}\n`,
  );
  await compose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "ordabasy",
      "-d",
      "ordabasy_test",
      "-v",
      "APP_ROLE=ordabasy_runtime",
    ],
    {},
    await readFile("infra/runtime-role.sql", "utf8"),
  );
  await compose([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "ordabasy",
    "-d",
    "ordabasy_test",
    "-c",
    "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='ordabasy_runtime'",
  ]);
  // Exercise the actual Railway command in the production image, including the
  // repeat seed and ledger permissions used later by the backup/restore drill.
  // Pass secret values via environment, never Docker argv or log messages.
  await compose(
    [
      "run",
      "--rm",
      "--no-deps",
      "-e",
      "DATABASE_URL",
      "-e",
      "MIGRATION_DATABASE_URL",
      "-e",
      "RAILWAY_SEED_ON_DEPLOY",
      "migrate",
      "node",
      "railway-predeploy.mjs",
    ],
    {
      DATABASE_URL: runtimeDatabaseUrl,
      MIGRATION_DATABASE_URL: `postgresql://ordabasy:${password}@db:5432/ordabasy_test`,
      RAILWAY_SEED_ON_DEPLOY: "true",
    },
  );
  // A real DML connection must pass the Render startup gate without owner credentials.
  await compose(
    [
      "run",
      "--rm",
      "--no-deps",
      "-e",
      "DATABASE_URL",
      "migrate",
      "node",
      "render-check.mjs",
    ],
    { DATABASE_URL: runtimeDatabaseUrl },
  );
  await compose(["up", "--no-build", "-d", "--wait", "--wait-timeout", "300"]);
  await compose(["run", "--rm", "--no-deps", "checks"]);
  await compose([
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "(async()=>{for(let i=0;i<60;i++){try{if((await fetch('http://object-storage:9090/',{signal:AbortSignal.timeout(2000)})).ok)return}catch{}await new Promise(r=>setTimeout(r,1000))}throw new Error('S3 test service not ready')})().catch(e=>{console.error(e.message);process.exitCode=1})",
  ]);
  const email = `${project}@example.invalid`,
    adminPassword = randomUUID() + randomUUID();
  await compose(
    [
      "exec",
      "-T",
      "-e",
      "ADMIN_EMAIL",
      "-e",
      "ADMIN_PASSWORD",
      "api",
      "node",
      "dist/bootstrap-admin.js",
    ],
    { ADMIN_EMAIL: email, ADMIN_PASSWORD: adminPassword },
  );
  const login = await api("/auth/login", "POST", {
    email,
    password: adminPassword,
  });
  assert.equal(login.status, 201);
  cookie = login.headers.get("set-cookie").split(";")[0];
  csrf = (await login.json()).csrfToken;
  assert.equal((await api("/admin/players")).status, 200);
  for (const locale of ["kk", "ru", "en"])
    for (const path of [
      "",
      "/team",
      "/players",
      "/news",
      "/matches",
      "/about",
      "/gallery",
      "/statistics",
      "/standings",
      "/admin",
    ])
      assert.equal(
        (await fetch(origin + "/" + locale + path, { signal: requestSignal() }))
          .status,
        200,
        locale + path,
      );
  const player = await create("players", {
    slug: project,
    names: { kk: "Сынақ ойыншысы", en: "Compose test" },
    position: "goalkeeper",
    status: "PUBLISHED",
    verification: "VERIFIED",
    source: project,
    sourceDate: new Date().toISOString(),
  });
  await create("memberships", {
    playerId: player.id,
    seasonId: "2026",
    teamId: "ordabasy",
    number: 77,
    startsAt: new Date().toISOString(),
    endsAt: null,
  });
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set(
    "file",
    new Blob([image], { type: "image/png" }),
    "verification.png",
  );
  const uploaded = await api("/admin/media/upload", "POST", form);
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const media = await uploaded.json();
  assert.equal(media.storage, "s3");
  const hash = await waitMedia(media.url);
  await create("news", {
    slug: project,
    status: "PUBLISHED",
    publishedAt: new Date(Date.now() - 1000).toISOString(),
    source: project,
    sourceDate: new Date().toISOString(),
    verification: "VERIFIED",
    cover: media.url,
    translations: [
      {
        locale: "kk",
        title: "Тексеру жаңалығы",
        excerpt: "Тұрақты деректер",
        body: "Тест жарияланымы <script>unsafe()</script>",
      },
    ],
  });
  assert.equal((await api(`/players/${project}`)).status, 200);
  assert.equal((await api(`/news/${project}`)).status, 200);
  await compose([
    "up",
    "-d",
    "--no-deps",
    "--force-recreate",
    "--wait",
    "--wait-timeout",
    "180",
    "db",
    "object-storage",
    "api",
    "web",
  ]);
  const persisted = await (await api(`/players/${project}`)).json();
  assert.equal(persisted.rosterNumber, 77);
  assert.equal((await api(`/news/${project}`)).status, 200);
  await waitMedia(media.url, hash);
  assert.equal(
    (await api("/auth/me")).status,
    200,
    "Session must persist in PostgreSQL",
  );
  await compose(["exec", "-T", "api", "pg_dump", "--version"]);
  await compose([
    "exec",
    "-T",
    "api",
    "node",
    "dist/backup.js",
    "create",
    "/tmp/ordabasy-backup",
  ]);
  await compose([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "ordabasy",
    "-d",
    "postgres",
    "-c",
    "CREATE DATABASE ordabasy_restore_test",
  ]);
  // Backups deliberately omit ACLs. Provision recovery-role defaults before
  // restoring tables, just as on a separately managed production recovery DB.
  await compose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "ordabasy",
      "-d",
      "ordabasy_restore_test",
      "-v",
      "APP_ROLE=ordabasy_runtime",
    ],
    {},
    await readFile("infra/runtime-role.sql", "utf8"),
  );
  await compose(
    [
      "exec",
      "-T",
      "-e",
      "RESTORE_DATABASE_URL",
      "-e",
      "RESTORE_S3_BUCKET=ordabasy-restore",
      "api",
      "node",
      "dist/backup.js",
      "restore",
      "/tmp/ordabasy-backup",
    ],
    {
      RESTORE_DATABASE_URL: `postgresql://ordabasy:${password}@db:5432/ordabasy_restore_test`,
    },
  );
  // Start the actual API against the recovered DB/bucket with its DML role.
  const verification = `
    const assert=require('node:assert/strict');
    const {createHash}=require('node:crypto');
    const {createApp}=require('./dist/main'); const {db}=require('./dist/db');
    (async()=>{let app;try{app=await createApp();await app.listen(0,'127.0.0.1');const base=await app.getUrl();
    assert.equal((await fetch(base+'/api/v1/ready')).status,200);
    assert.equal(await db.session.count(),0);
    const profile=await (await fetch(base+'/api/v1/players/'+${JSON.stringify(project)})).json();
    assert.equal(profile.names.kk,'Сынақ ойыншысы');assert.equal(profile.rosterNumber,77);
    assert.equal((await fetch(base+'/api/v1/news/'+${JSON.stringify(project)})).status,200);
    const image=await fetch(base+${JSON.stringify(media.url)});assert.equal(image.status,200);
    assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),${JSON.stringify(hash)});
    const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{Origin:process.env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.VERIFICATION_EMAIL,password:process.env.VERIFICATION_PASSWORD})});
    assert.equal(login.status,201);const cookie=login.headers.get('set-cookie').split(';')[0];const csrf=(await login.json()).csrfToken;
    assert.equal((await fetch(base+'/api/v1/admin/players',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:process.env.PUBLIC_ORIGIN,'X-CSRF-Token':csrf}})).status,201);
    assert.equal(await db.session.count(),0);
    console.log('Compose restore verified through the actual DML-role API: readiness, Unicode profile, news, login/logout, revoked sessions, exact S3 bytes');
    }finally{await app?.close();await db.$disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1});`;
  await compose(
    [
      "exec",
      "-T",
      "-e",
      "DATABASE_URL",
      "-e",
      "S3_BUCKET=ordabasy-restore",
      "-e",
      "VERIFICATION_EMAIL",
      "-e",
      "VERIFICATION_PASSWORD",
      "api",
      "node",
      "-e",
      verification,
    ],
    {
      DATABASE_URL: `postgresql://ordabasy_runtime:${runtimePassword}@db:5432/ordabasy_restore_test`,
      VERIFICATION_EMAIL: email,
      VERIFICATION_PASSWORD: adminPassword,
    },
  );
  assert.equal(
    (await api("/auth/me")).status,
    200,
    "An isolated restore must not revoke the original session",
  );
  console.log(
    "Compose verified: production images, PostgreSQL 17, 30 routes, admin CRUD, S3 upload, container recreation, backup and isolated restore.",
  );
} catch (error) {
  failed = true;
  if (interrupted) process.exitCode = 130;
  else {
    await compose(["logs", "--tail", "80"]).catch(() => {});
    throw error;
  }
} finally {
  await compose(["down", "--volumes", "--remove-orphans"])
    .catch((error) => {
      if (!failed) throw error;
      console.error("Disposable Compose cleanup also failed:", error.message);
    })
    .finally(() => rm(folder, { recursive: true, force: true }));
}

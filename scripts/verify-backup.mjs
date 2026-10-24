import { assertTestDatabase } from "../tests/helpers/test-database.ts";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { db } from "../apps/api/src/db.ts";
import { mediaDir } from "../apps/api/src/config.ts";
assertTestDatabase();
const folder = await mkdtemp(join(tmpdir(), "ordabasy-restore-check-")),
  name = `ordabasy_restore_test_${randomUUID().replaceAll("-", "")}`;
const target = new URL(process.env.DATABASE_URL);
target.pathname = `/${name}`;
assertTestDatabase(target.toString());
const owner = new Client({ connectionString: process.env.DATABASE_URL });
await owner.connect();
const objectName = `${randomUUID()}.webp`,
  url = `/uploads/${objectName}`;
let asset;
try {
  await mkdir(mediaDir, { recursive: true });
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "blue" },
  })
    .webp()
    .toBuffer();
  await writeFile(join(mediaDir, objectName), image);
  asset = await db.mediaAsset.create({
    data: {
      url,
      mime: "image/webp",
      size: image.length,
      width: 8,
      height: 8,
      alt: { kk: "Сақтық көшірме" },
      uploadedBy: "restore-test",
      storage: "local",
    },
  });
  await owner.query(`CREATE DATABASE "${name}"`);
  for (const action of ["create", "restore"]) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/api/src/backup.ts",
        action,
        join(folder, "backup"),
      ],
      {
        env: {
          ...process.env,
          RESTORE_DATABASE_URL: target.toString(),
          RESTORE_MEDIA_DIR: join(folder, "restored-media"),
          MEDIA_STORAGE: "local",
        },
        encoding: "utf8",
      },
    );
    if (result.status !== 0) throw new Error(result.stderr);
    process.stdout.write(result.stdout);
  }
  const restored = new Client({ connectionString: target.toString() });
  await restored.connect();
  try {
    const manifest = JSON.parse(
      await readFile(join(folder, "backup", "manifest.json"), "utf8"),
    );
    const counts = await restored.query(
      'SELECT (SELECT count(*)::int FROM "Player") as players,(SELECT count(*)::int FROM "RosterMembership") as memberships,(SELECT count(*)::int FROM "NewsPost") as articles',
    );
    if (JSON.stringify(counts.rows[0]) !== JSON.stringify(manifest.counts))
      throw new Error("Snapshot counts differ");
    const record = await restored.query(
      'SELECT alt FROM "MediaAsset" WHERE id=$1',
      [asset.id],
    );
    if (record.rows[0].alt.kk !== "Сақтық көшірме")
      throw new Error("Restored localization mismatch");
    if (
      !(await readFile(join(folder, "restored-media", objectName))).equals(
        image,
      )
    )
      throw new Error("Restored media differs");
    console.log(
      "Restore verified: PostgreSQL rows, localization and image bytes match.",
    );
  } finally {
    await restored.end();
  }
} finally {
  if (asset) await db.mediaAsset.delete({ where: { id: asset.id } });
  await rm(join(mediaDir, objectName), { force: true });
  await owner.query(`DROP DATABASE IF EXISTS "${name}"`);
  await owner.end();
  await db.$disconnect();
  await rm(folder, { recursive: true, force: true });
}

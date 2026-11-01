import "./config";
import { spawn } from "node:child_process";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  chmod,
  stat,
} from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "./db";
import { mutationLock } from "./cms";
import { readUpload } from "./storage";
import { mediaDir } from "./config";
import { backupCountSql } from "./backup-counts";
function pgEnv(url: string) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    ...(u.searchParams.get("sslmode")
      ? { PGSSLMODE: u.searchParams.get("sslmode")! }
      : {}),
  };
}
async function run(command: string, args: string[], url: string) {
  await new Promise<void>((ok, fail) => {
    const child = spawn(command, args, {
      env: pgEnv(url),
      stdio: ["ignore", "ignore", "pipe"],
    });
    let error = "";
    child.stderr.on("data", (b) => {
      error += String(b);
    });
    child.once("error", fail);
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(
            new Error(
              `${command} failed (${code}); check server/tool versions and database privileges. ${error.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted database URL]")}`,
            ),
          ),
    );
  });
}
const digest = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
async function backup(directory: string) {
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await mkdir(join(directory, "media"), { mode: 0o700 });
  const files: Record<string, string> = {};
  let counts: Record<string, number> = {};
  await db.$transaction(
    async (tx) => {
      await mutationLock(tx);
      const [snapshot] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT pg_export_snapshot() as id`;
      await run(
        "pg_dump",
        [
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          `--snapshot=${snapshot.id}`,
          `--file=${join(directory, "database.dump")}`,
        ],
        process.env.DATABASE_URL!,
      );
      await chmod(join(directory, "database.dump"), 0o600);
      // SQL identifiers come exclusively from the closed application table map.
      [counts] =
        await tx.$queryRawUnsafe<Record<string, number>[]>(backupCountSql());
      const assets = await tx.mediaAsset.findMany();
      for (const asset of assets)
        for (const url of [
          asset.url,
          ...Object.values(asset.variants as Record<string, string>),
        ]) {
          const name = basename(url),
            data = await readUpload(name);
          await writeFile(join(directory, "media", name), data, {
            mode: 0o600,
          });
          files[`media/${name}`] = digest(data);
        }
    },
    { isolationLevel: "RepeatableRead", timeout: 300000, maxWait: 30000 },
  );
  files["database.dump"] = digest(
    await readFile(join(directory, "database.dump")),
  );
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify(
      { version: 2, createdAt: new Date().toISOString(), counts, files },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`Backup created and checksummed: ${directory}`);
}
async function restore(directory: string) {
  const target = process.env.RESTORE_DATABASE_URL;
  if (!target || target === process.env.DATABASE_URL)
    throw new Error(
      "Set a separate RESTORE_DATABASE_URL. The running database is never a restore target.",
    );
  const manifest = JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8"),
  ) as {
    version: number;
    files: Record<string, string>;
    counts: Record<string, number>;
  };
  if (
    ![1, 2].includes(manifest.version) ||
    !manifest.files?.["database.dump"] ||
    !manifest.counts ||
    Object.values(manifest.counts).some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new Error("Unsupported backup manifest");
  const countSql = backupCountSql(Object.keys(manifest.counts));
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (
      name !== "database.dump" &&
      !/^media\/[a-f0-9-]{36}(?:-thumb)?\.(webp|avif)$/.test(name)
    )
      throw new Error("Invalid backup path");
    if (digest(await readFile(join(directory, name))) !== hash)
      throw new Error("Backup checksum mismatch");
  }
  const client = new Client({ connectionString: target });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema='public'",
    );
    if (result.rows[0].count !== 0)
      throw new Error("Restore target must be an empty database");
  } finally {
    await client.end();
  }
  const driver = process.env.MEDIA_STORAGE === "s3" ? "s3" : "local";
  const destination = process.env.RESTORE_MEDIA_DIR;
  const restoreBucket = process.env.RESTORE_S3_BUCKET;
  if (
    driver === "s3" &&
    (!restoreBucket || restoreBucket === process.env.S3_BUCKET)
  )
    throw new Error(
      "Set a separate RESTORE_S3_BUCKET; the live bucket is not a restore target",
    );
  if (driver === "local" && (!destination || resolve(destination) === mediaDir))
    throw new Error(
      "Set a separate RESTORE_MEDIA_DIR for isolated restoration",
    );
  if (driver === "local") {
    await mkdir(destination!, { recursive: true, mode: 0o700 });
    if ((await readdir(destination!)).length)
      throw new Error("Restore media directory must be empty");
  }
  const s3 =
    driver === "s3"
      ? new S3Client({
          region: process.env.S3_REGION || "us-east-1",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
          ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                credentials: {
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                },
              }
            : {}),
        })
      : null;
  try {
    for (const name of Object.keys(manifest.files).filter((n) =>
      n.startsWith("media/"),
    )) {
      const data = await readFile(join(directory, name));
      if (s3)
        await s3.send(
          new PutObjectCommand({
            Bucket: restoreBucket!,
            Key: basename(name),
            Body: data,
            ContentType: name.endsWith("avif") ? "image/avif" : "image/webp",
          }),
        );
      else
        await writeFile(join(destination!, basename(name)), data, {
          mode: 0o600,
          flag: "wx",
        });
    }
    await run(
      "pg_restore",
      [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        new URL(target).pathname.slice(1),
        join(directory, "database.dump"),
      ],
      target,
    );
    const verification = new Client({ connectionString: target });
    await verification.connect();
    try {
      await verification.query('DELETE FROM "Session"');
      await verification.query('UPDATE "MediaAsset" SET storage=$1', [driver]);
      const result = await verification.query(countSql);
      if (
        Object.entries(manifest.counts).some(
          ([key, expected]) => result.rows[0][key] !== expected,
        )
      )
        throw new Error(
          "Restored record counts differ from the backup snapshot",
        );
      console.log(
        JSON.stringify({
          restored: true,
          counts: result.rows[0],
          mediaFiles: Object.keys(manifest.files).length - 1,
        }),
      );
    } finally {
      await verification.end();
    }
  } finally {
    s3?.destroy();
  }
}
async function main() {
  const [action, dir] = process.argv.slice(2);
  if (!["create", "restore"].includes(action) || !dir)
    throw new Error(
      "Usage: backup.ts create|restore /absolute/backup-directory",
    );
  const directory = resolve(dir);
  if (action === "create") await backup(directory);
  else {
    if (!(await stat(directory)).isDirectory())
      throw new Error("Backup directory required");
    await restore(directory);
  }
}
main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

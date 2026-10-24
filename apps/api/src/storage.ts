import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { mediaDir } from "./config";
import type { AuthRequest } from "./auth";
import { audit, mutationLock } from "./cms";
const s3 = () =>
  new S3Client({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
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
  });
const bucket = () => process.env.S3_BUCKET!;
export const storageDriver = () =>
  process.env.MEDIA_STORAGE === "disabled"
    ? "disabled"
    : process.env.MEDIA_STORAGE === "s3"
      ? "s3"
      : "local";
function requireMediaStorage() {
  if (storageDriver() === "disabled")
    throw new ServiceUnavailableException({ code: "MEDIA_STORAGE_DISABLED" });
}
async function put(name: string, data: Buffer, mime: string, driver: string) {
  if (driver === "s3") {
    const client = s3();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: name,
          Body: data,
          ContentType: mime,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } finally {
      client.destroy();
    }
  } else {
    await mkdir(mediaDir, { recursive: true });
    await writeFile(join(mediaDir, name), data, { flag: "wx" });
  }
}
async function removeFile(name: string, driver: string) {
  if (driver === "s3") {
    const client = s3();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: name }),
      );
    } finally {
      client.destroy();
    }
  } else
    await unlink(join(mediaDir, name)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
}
export async function readUpload(name: string) {
  requireMediaStorage();
  if (!/^[a-f0-9-]{36}(?:-thumb)?\.(webp|avif)$/.test(name))
    throw new NotFoundException({ code: "NOT_FOUND" });
  const path = `/uploads/${name}`;
  const asset = await db.mediaAsset.findFirst({
    where: {
      OR: [
        { url: path },
        { variants: { path: ["avif"], equals: path } },
        { variants: { path: ["thumbnail"], equals: path } },
      ],
    },
  });
  if (!asset) throw new NotFoundException({ code: "NOT_FOUND" });
  if (asset.storage === "s3") {
    const client = s3();
    try {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket(), Key: name }),
      );
      if (!result.Body) throw new NotFoundException();
      return Buffer.from(await result.Body.transformToByteArray());
    } finally {
      client.destroy();
    }
  }
  return readFile(join(mediaDir, name));
}
export async function uploadImage(file: Express.Multer.File, req: AuthRequest) {
  requireMediaStorage();
  if (
    !file ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ||
    !/\.(jpe?g|png|webp)$/i.test(file.originalname)
  )
    throw new BadRequestException({ code: "INVALID_UPLOAD" });
  const b = file.buffer;
  if (!(
    (file.mimetype === "image/jpeg" &&
      b[0] === 255 &&
      b[1] === 216 &&
      b[2] === 255) ||
    (file.mimetype === "image/png" &&
      b
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === "image/webp" &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP")
  ))
    throw new BadRequestException({ code: "INVALID_UPLOAD" });
  const id = randomUUID(),
    driver = storageDriver();
  let main, avif, thumb;
  try {
    const image = sharp(b, { limitInputPixels: 40000000, animated: false })
      .rotate()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true });
    [main, avif, thumb] = await Promise.all([
      image.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      image.clone().avif({ quality: 55, effort: 3 }).toBuffer(),
      image
        .clone()
        .resize(320, 320, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer(),
    ]);
  } catch {
    throw new BadRequestException({ code: "INVALID_UPLOAD" });
  }
  const files = [
    { name: `${id}.webp`, data: main.data, mime: "image/webp" },
    { name: `${id}.avif`, data: avif, mime: "image/avif" },
    { name: `${id}-thumb.webp`, data: thumb, mime: "image/webp" },
  ];
  const uploaded: string[] = [];
  try {
    for (const f of files) {
      await put(f.name, f.data, f.mime, driver);
      uploaded.push(f.name);
    }
    return await db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          url: `/uploads/${id}.webp`,
          variants: {
            avif: `/uploads/${id}.avif`,
            thumbnail: `/uploads/${id}-thumb.webp`,
          },
          storage: driver,
          mime: "image/webp",
          size: main.data.length,
          width: main.info.width,
          height: main.info.height,
          alt: { kk: "" },
          uploadedBy: req.auth.userId,
        },
      });
      await audit(tx, req, "media", asset.id, "UPLOAD", null, asset);
      return asset;
    });
  } catch (e) {
    await Promise.allSettled(uploaded.map((n) => removeFile(n, driver)));
    throw e;
  }
}
export async function mediaReferences(
  tx: Prisma.TransactionClient,
  url: string,
) {
  const counts = await Promise.all([
    tx.player.count({ where: { photo: url } }),
    tx.newsPost.count({
      where: { OR: [{ cover: url }, { images: { array_contains: [url] } }] },
    }),
    tx.galleryItem.count({ where: { OR: [{ url }, { poster: url }] } }),
    tx.staffMember.count({ where: { photo: url } }),
    tx.team.count({ where: { logo: url } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}
export async function deleteMedia(id: string, req: AuthRequest) {
  requireMediaStorage();
  return db.$transaction(
    async (tx) => {
      await mutationLock(tx);
      const asset = await tx.mediaAsset.findUnique({ where: { id } });
      if (!asset) throw new NotFoundException({ code: "NOT_FOUND" });
      if (req.header("if-match") !== String(asset.version))
        throw new ConflictException({ code: "EDIT_CONFLICT" });
      if (
        (
          await Promise.all(
            [
              asset.url,
              ...Object.values(asset.variants as Record<string, string>),
            ].map((url) => mediaReferences(tx, url)),
          )
        ).some(Boolean)
      )
        throw new ConflictException({ code: "MEDIA_IN_USE" });
      const urls = [
        asset.url,
        ...Object.values(asset.variants as Record<string, string>),
      ];
      for (const url of urls)
        await removeFile(url.replace("/uploads/", ""), asset.storage);
      await tx.mediaAsset.delete({ where: { id } });
      await audit(tx, req, "media", id, "DELETE_UNUSED", asset, null);
      return { ok: true };
    },
    { timeout: 30000 },
  );
}

export async function migrateLocalMediaToS3() {
  if (storageDriver() !== "s3" || !bucket())
    throw new Error("Configure MEDIA_STORAGE=s3 and S3_BUCKET first");
  const assets = await db.mediaAsset.findMany({ where: { storage: "local" } });
  for (const asset of assets)
    await db.$transaction(
      async (tx) => {
        await mutationLock(tx);
        const current = await tx.mediaAsset.findUnique({
          where: { id: asset.id },
        });
        if (!current || current.storage !== "local") return;
        for (const path of [
          current.url,
          ...Object.values(current.variants as Record<string, string>),
        ]) {
          const name = path.replace("/uploads/", "");
          if (!/^[a-f0-9-]{36}(?:-thumb)?\.(webp|avif)$/.test(name))
            throw new Error("Invalid media path");
          await put(
            name,
            await readFile(join(mediaDir, name)),
            name.endsWith(".avif") ? "image/avif" : "image/webp",
            "s3",
          );
        }
        await tx.mediaAsset.update({
          where: { id: current.id },
          data: { storage: "s3", version: { increment: 1 } },
        });
        await tx.auditLog.create({
          data: {
            actorId: "operations",
            entity: "media",
            entityId: current.id,
            action: "MIGRATE_STORAGE",
            changes: { from: "local", to: "s3" },
          },
        });
      },
      { timeout: 90000 },
    );
  console.log(
    `Migrated ${assets.length} media assets to S3; local copies retained for rollback.`,
  );
}

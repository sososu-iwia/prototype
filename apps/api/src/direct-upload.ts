import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { z } from "zod";
import { db } from "./db";
import type { AuthRequest } from "./auth";
import { bucket, s3, storageDriver, uploadImage } from "./storage";

const maximum = 10 * 1024 * 1024;
const input = z
  .object({
    filename: z
      .string()
      .min(1)
      .max(200)
      .regex(/\.(jpe?g|png|webp)$/i),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().min(1).max(maximum),
    checksum: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  })
  .strict();
const receipt = z.object({ id: z.string().uuid() }).strict();
const stagingKey = (id: string) => `staging/${id}`;
function requireS3() {
  if (storageDriver() !== "s3")
    throw new ServiceUnavailableException({ code: "MEDIA_STORAGE_DISABLED" });
}
export function directUploadConfig() {
  return { direct: process.env.VERCEL === "1", maxBytes: maximum };
}
export async function presignUpload(value: unknown, req: AuthRequest) {
  requireS3();
  const data = input.parse(value);
  if (
    (await db.pendingUpload.count({
      where: {
        userId: req.auth.userId,
        state: { in: ["PENDING", "PROCESSING"] },
        expiresAt: { gt: new Date() },
      },
    })) >= 20
  )
    throw new ConflictException({ code: "UPLOAD_LIMIT" });
  const id = randomUUID();
  const client = s3();
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket(),
        Key: stagingKey(id),
        ContentType: data.mime,
        ContentLength: data.size,
      }),
      {
        expiresIn: 300,
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
    await db.pendingUpload.create({
      data: {
        id,
        key: stagingKey(id),
        userId: req.auth.userId,
        ...data,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return {
      id,
      url,
      method: "PUT",
      headers: { "Content-Type": data.mime },
      expiresIn: 300,
    };
  } finally {
    client.destroy();
  }
}
async function boundedBody(body: Readable, size: number) {
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    for await (const chunk of body) {
      const part = Buffer.from(chunk);
      length += part.length;
      if (length > size || length > maximum)
        throw new BadRequestException({ code: "INVALID_UPLOAD" });
      chunks.push(part);
    }
    if (length !== size)
      throw new BadRequestException({ code: "INVALID_UPLOAD" });
    return Buffer.concat(chunks, length);
  } finally {
    body.destroy();
  }
}
export async function completeUpload(value: unknown, req: AuthRequest) {
  requireS3();
  const { id } = receipt.parse(value);
  const ticket = await db.pendingUpload.findUnique({ where: { id } });
  if (
    !ticket ||
    ticket.userId !== req.auth.userId ||
    ticket.key !== stagingKey(id)
  )
    throw new NotFoundException({ code: "NOT_FOUND" });
  if (ticket.state === "COMPLETED" && ticket.mediaId) {
    const asset = await db.mediaAsset.findUnique({
      where: { id: ticket.mediaId },
    });
    if (!asset) throw new NotFoundException({ code: "NOT_FOUND" });
    return asset;
  }
  const now = new Date();
  const claimed = await db.pendingUpload.updateMany({
    where: {
      id,
      userId: req.auth.userId,
      expiresAt: { gt: now },
      OR: [
        { state: "PENDING" },
        {
          state: "PROCESSING",
          processingAt: { lt: new Date(Date.now() - 360000) },
        },
      ],
    },
    data: { state: "PROCESSING", processingAt: now },
  });
  if (!claimed.count)
    throw new ConflictException({ code: "UPLOAD_EXPIRED_OR_BUSY" });
  const client = s3();
  try {
    const meta = await client.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: ticket.key }),
    );
    if (meta.ContentLength !== ticket.size || meta.ContentType !== ticket.mime)
      throw new BadRequestException({ code: "INVALID_UPLOAD" });
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket(), Key: ticket.key }),
    );
    if (!object.Body) throw new BadRequestException({ code: "INVALID_UPLOAD" });
    const buffer = await boundedBody(object.Body as Readable, ticket.size);
    if (
      createHash("sha256").update(buffer).digest("base64") !== ticket.checksum
    )
      throw new BadRequestException({ code: "INVALID_UPLOAD" });
    // uploadImage verifies the real image signature, decodes within a pixel limit,
    // optimizes all variants, then commits the asset and receipt in one transaction.
    const asset = await uploadImage(
      {
        buffer,
        mimetype: ticket.mime,
        originalname: ticket.filename,
        size: buffer.length,
      } as Express.Multer.File,
      req,
      id,
    );
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket(), Key: ticket.key }))
      .catch(() => {});
    return asset;
  } catch (error) {
    // A failed network request can be retried. Only our staging record changes.
    await db.pendingUpload.updateMany({
      where: { id, state: "PROCESSING", processingAt: now },
      data: { state: "PENDING", processingAt: null },
    });
    throw error;
  } finally {
    client.destroy();
  }
}
export async function cleanupExpiredUploads() {
  requireS3();
  const expired = await db.pendingUpload.findMany({
    where: {
      expiresAt: { lt: new Date(Date.now() - 3600000) },
      OR: [
        { processingAt: null },
        { processingAt: { lt: new Date(Date.now() - 3600000) } },
      ],
    },
    take: 100,
    orderBy: { expiresAt: "asc" },
  });
  const client = s3();
  let cleaned = 0;
  try {
    for (const ticket of expired) {
      if (
        !z.string().uuid().safeParse(ticket.id).success ||
        ticket.key !== stagingKey(ticket.id)
      )
        continue;
      // Never remove committed MediaAsset files, even if a receipt is inconsistent.
      const asset = await db.mediaAsset.findFirst({
        where: { url: `/uploads/${ticket.id}.webp` },
      });
      const keys = [
        ticket.key,
        ...(!asset && ticket.state !== "COMPLETED"
          ? [
              `${ticket.id}.webp`,
              `${ticket.id}.avif`,
              `${ticket.id}-thumb.webp`,
            ]
          : []),
      ];
      for (const key of keys)
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
        );
      await db.pendingUpload.delete({ where: { id: ticket.id } });
      cleaned++;
    }
  } finally {
    client.destroy();
  }
  return { cleaned };
}

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { assertTestDatabase } from "../helpers/test-database";
import { PostgresRateLimitStore } from "../../apps/api/src/rate-limit";
import { verifyVercelRuntime } from "../../apps/api/src/vercel-runtime";
import {
  presignUpload,
  completeUpload,
  cleanupExpiredUploads,
} from "../../apps/api/src/direct-upload";
import { bucket, s3, readUpload } from "../../apps/api/src/storage";
import type { AuthRequest } from "../../apps/api/src/auth";
import { db } from "../../apps/api/src/db";
import { createApp } from "../../apps/api/src/main";
import { hash } from "../../apps/api/src/auth";

test("distributed rate limits remain atomic across API instances", async (t) => {
  assertTestDatabase();
  const scope = randomUUID();
  const a = new PostgresRateLimitStore(scope),
    b = new PostgresRateLimitStore(scope);
  try {
    const hits = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).increment("client")),
    );
    assert.deepEqual(
      hits.map((r) => r.totalHits).sort((a, b) => a - b),
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
    assert.equal(
      (await new PostgresRateLimitStore(scope).increment("client")).totalHits,
      41,
    );
    assert.equal(
      (await new PostgresRateLimitStore(scope + "other").increment("client"))
        .totalHits,
      1,
    );
    await t.test(
      "expired windows restart without restoring an instance's memory",
      async () => {
        const key = createHash("sha256")
          .update(`${scope}:client`)
          .digest("hex");
        await db.rateLimitWindow.update({
          where: { key },
          data: { resetAt: new Date(Date.now() - 1000) },
        });
        assert.equal((await b.increment("client")).totalHits, 1);
      },
    );
    await assert.rejects(verifyVercelRuntime([]), /Explicit Vercel/);
  } finally {
    await db.$disconnect();
  }
});

test("direct uploads authorize, validate actual S3 bytes, finalize once, and clean only expired staging", async (t) => {
  assertTestDatabase();
  if (process.env.VERIFY_DIRECT_S3 !== "true") {
    t.skip("S3 fixture runs separately in the serverless verification job");
    return;
  }
  assert.match(bucket(), /^ordabasy-test-/);
  const client = s3();
  await client.send(new CreateBucketCommand({ Bucket: bucket() }));
  const user = await db.user.create({
    data: {
      email: `direct-${randomUUID()}@example.invalid`,
      passwordHash: "unused-fixture",
      role: "ADMIN",
    },
  });
  const req = {
    auth: { userId: user.id, role: "ADMIN", sessionId: "test" },
    header: () => undefined,
  } as unknown as AuthRequest;
  const image = await sharp({
    create: { width: 12, height: 8, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  // A valid image with trailing bytes exercises a request larger than Functions'
  // payload ceiling. Only the signed S3 PUT contains these bytes.
  const large = Buffer.concat([image, Buffer.alloc(5 * 1024 * 1024)]);
  async function reserve(
    bytes = large,
    checksum = createHash("sha256").update(bytes).digest("base64"),
  ) {
    return presignUpload(
      {
        filename: "photo.png",
        mime: "image/png",
        size: bytes.length,
        checksum,
      },
      req,
    );
  }
  async function put(
    ticket: Awaited<ReturnType<typeof reserve>>,
    bytes = large,
  ) {
    return fetch(ticket.url, {
      method: ticket.method,
      headers: ticket.headers,
      body: new Uint8Array(bytes),
    });
  }
  let assetId = "";
  try {
    await t.test("rejects oversized tickets before contacting S3", async () => {
      await assert.rejects(
        presignUpload(
          {
            filename: "bad.png",
            mime: "image/png",
            size: 10485761,
            checksum: createHash("sha256").digest("base64"),
          },
          req,
        ),
      );
    });
    await t.test(
      "HTTP routes enforce session, Origin and CSRF before signing",
      async () => {
        const app = await createApp();
        await app.listen(0, "127.0.0.1");
        const url = (await app.getUrl()) + "/api/v1/admin/media/direct/presign";
        const token = randomUUID(),
          csrf = randomUUID();
        await db.session.create({
          data: {
            userId: user.id,
            tokenHash: hash(token),
            csrfHash: hash(csrf),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        const body = JSON.stringify({
          filename: "photo.png",
          mime: "image/png",
          size: large.length,
          checksum: createHash("sha256").update(large).digest("base64"),
        });
        try {
          assert.equal(
            (
              await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "http://localhost:3000",
                },
                body,
              })
            ).status,
            401,
          );
          assert.equal(
            (
              await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "http://localhost:3000",
                  Cookie: `ordabasy_session=${token}`,
                },
                body,
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "https://evil.invalid",
                  Cookie: `ordabasy_session=${token}`,
                  "X-CSRF-Token": csrf,
                },
                body,
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "http://localhost:3000",
                  Cookie: `ordabasy_session=${token}`,
                  "X-CSRF-Token": csrf,
                },
                body,
              })
            ).status,
            201,
          );
        } finally {
          await app.close();
        }
      },
    );
    const ticket = await reserve();
    const signedHeaders = new URL(ticket.url).searchParams.get(
      "X-Amz-SignedHeaders",
    )!;
    assert.ok(signedHeaders.includes("content-length"));
    assert.ok(signedHeaders.includes("content-type"));
    await t.test("another account cannot complete a ticket", async () => {
      await assert.rejects(
        completeUpload({ id: ticket.id }, {
          ...req,
          auth: { ...req.auth, userId: randomUUID() },
        } as AuthRequest),
        (e) => (e as { getStatus: () => number }).getStatus() === 404,
      );
    });
    assert.ok((await put(ticket)).ok);
    const asset = await completeUpload({ id: ticket.id }, req);
    assetId = asset.id;
    assert.equal(asset.storage, "s3");
    assert.equal(
      (await sharp(await readUpload(asset.url.slice(9))).metadata()).width,
      12,
    );
    const repeat = await completeUpload({ id: ticket.id }, req);
    assert.equal(repeat.id, asset.id);
    assert.equal(await db.mediaAsset.count({ where: { url: asset.url } }), 1);
    await t.test("a changed body is never linked to MediaAsset", async () => {
      const bad = await reserve(
        large,
        createHash("sha256").update("wrong").digest("base64"),
      );
      assert.ok((await put(bad)).ok);
      await assert.rejects(
        completeUpload({ id: bad.id }, req),
        (e) => (e as { getStatus: () => number }).getStatus() === 400,
      );
      assert.equal(
        await db.mediaAsset.count({
          where: { url: `/uploads/${bad.id}.webp` },
        }),
        0,
      );
    });
    await t.test(
      "expiry blocks completion and cleanup preserves committed and unrelated media",
      async () => {
        const expired = await reserve(image);
        assert.ok((await put(expired, image)).ok);
        await db.pendingUpload.updateMany({
          where: { userId: user.id },
          data: {
            expiresAt: new Date(Date.now() - 7200000),
            processingAt: null,
          },
        });
        await client.send(
          new PutObjectCommand({
            Bucket: bucket(),
            Key: "unrelated-original",
            Body: image,
          }),
        );
        await assert.rejects(
          completeUpload({ id: expired.id }, req),
          (e) => (e as { getStatus: () => number }).getStatus() === 409,
        );
        const cleaned = await cleanupExpiredUploads();
        assert.ok(cleaned.cleaned >= 3);
        assert.ok(await readUpload(asset.url.slice(9)));
        assert.ok(
          (
            await client.send(
              new GetObjectCommand({
                Bucket: bucket(),
                Key: "unrelated-original",
              }),
            )
          ).Body,
        );
        await assert.rejects(
          client.send(
            new GetObjectCommand({
              Bucket: bucket(),
              Key: `staging/${expired.id}`,
            }),
          ),
        );
      },
    );
  } finally {
    await db.pendingUpload.deleteMany({ where: { userId: user.id } });
    if (assetId) await db.mediaAsset.delete({ where: { id: assetId } });
    await db.user.delete({ where: { id: user.id } });
    client.destroy();
    await db.$disconnect();
  }
});

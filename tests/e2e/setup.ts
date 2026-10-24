import { assertTestDatabase } from "../helpers/test-database";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../apps/api/src/db";
import { mediaDir } from "../../apps/api/src/config";
export default async function setup() {
  assertTestDatabase();
  await mkdir(process.env.VERIFICATION_DIR || "docs/verification", {
    recursive: true,
  });
  const prefix = `e2e-${randomUUID().slice(0, 8)}`;
  const password = randomUUID() + randomUUID();
  const email = `${prefix}@example.invalid`;
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "ADMIN",
    },
  });
  process.env.E2E_EMAIL = email;
  process.env.E2E_PASSWORD = password;
  process.env.E2E_PREFIX = prefix;
  return async () => {
    const media = await db.mediaAsset.findMany({
      where: { uploadedBy: user.id },
    });
    for (const item of media)
      for (const url of [
        item.url,
        ...Object.values(item.variants as Record<string, string>),
      ])
        await unlink(join(mediaDir, url.split("/").at(-1)!)).catch(() => {});
    await db.mediaAsset.deleteMany({ where: { uploadedBy: user.id } });
    await db.newsPost.deleteMany({ where: { authorId: user.id } });
    await db.rosterMembership.deleteMany({
      where: { player: { slug: { startsWith: prefix } } },
    });
    await db.playerStatistics.deleteMany({
      where: { playerSeason: { player: { slug: { startsWith: prefix } } } },
    });
    await db.playerSeason.deleteMany({
      where: { player: { slug: { startsWith: prefix } } },
    });
    await db.player.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.match.deleteMany({ where: { source: { startsWith: prefix } } });
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.mutationKey.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  };
}

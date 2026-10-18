import "./config";
import * as argon2 from "argon2";
import { z } from "zod";
import { db } from "./db";
async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
  const password = z
    .string()
    .min(16)
    .max(128)
    .parse(process.env.ADMIN_PASSWORD);
  if (await db.user.findUnique({ where: { email } }))
    throw new Error(
      "Account already exists. This command never overwrites credentials.",
    );
  const role = z
    .enum(["SUPER_ADMIN", "ADMIN", "EDITOR"])
    .parse(process.env.BOOTSTRAP_ROLE || "SUPER_ADMIN");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "BOOTSTRAP",
        entity: "user",
        entityId: user.id,
      },
    });
  });
  console.log(
    "Administrator created. Remove ADMIN_PASSWORD from the environment.",
  );
}
main()
  .catch(() => {
    console.error(
      "Admin creation failed. Use a new email and a password of 16–128 characters.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

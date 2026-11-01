import type { Prisma } from "@prisma/client";

/** Records what the CMS knew at each version, without inventing employment dates. */
export async function recordStaffRevision(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const member = await tx.staffMember.findUniqueOrThrow({ where: { id } });
  await tx.staffRevision.upsert({
    where: {
      staffId_staffVersion: { staffId: id, staffVersion: member.version },
    },
    update: {},
    create: {
      staffId: id,
      staffVersion: member.version,
      teamId: member.teamId,
      seasonId: member.sourceSeasonId,
      title: member.title as Prisma.InputJsonValue,
      roleCode: member.roleCode,
      status: member.status,
      source: member.source,
    },
  });
}

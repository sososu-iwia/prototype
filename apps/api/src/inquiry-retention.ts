import { db } from "./db";
/** Erase personal fields, retain a nonpersonal audit trail. Run daily and before admin reads. */
export async function purgeExpiredInquiries() {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(786034)::text`;
    const expired = await tx.academyInquiry.findMany({
      where: { expiresAt: { lte: new Date() }, purgedAt: null },
      select: { id: true },
    });
    if (!expired.length) return 0;
    await tx.academyInquiry.updateMany({
      where: { id: { in: expired.map((v) => v.id) } },
      data: {
        guardianName: null,
        contact: null,
        ageGroup: null,
        message: null,
        state: "ARCHIVED",
        purgedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.auditLog.createMany({
      data: expired.map((v) => ({
        actorId: "retention-policy",
        action: "PURGE_PERSONAL_DATA",
        entity: "academy-inquiries",
        entityId: v.id,
        changes: { policy: "90 days" },
      })),
    });
    return expired.length;
  });
}

import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
@Injectable()
export class InquiryRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      await purgeExpiredInquiries();
      await db.inquiryRateBucket.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    } catch {
      console.error(JSON.stringify({ event: "inquiry_retention_failed" }));
    } finally {
      this.running = false;
    }
  }
  onModuleInit() {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 3600000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

import { createHash } from "node:crypto";
import { ipKeyGenerator, type Store, type Options } from "express-rate-limit";
import type { Request } from "express";
import { isIP } from "node:net";
import { db } from "./db";

// Atomic fixed windows in PostgreSQL are shared across invocations and replicas.
// Store errors fail closed through express-rate-limit; there is no memory fallback.
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60000;
  constructor(private readonly scope: string) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(key: string) {
    return createHash("sha256").update(`${this.scope}:${key}`).digest("hex");
  }
  async increment(key: string) {
    const rows = await db.$queryRaw<{ totalHits: number; resetTime: Date }[]>`
      WITH cleanup AS (
        DELETE FROM "RateLimitWindow" WHERE "key" IN
        (SELECT "key" FROM "RateLimitWindow" WHERE "resetAt" < CURRENT_TIMESTAMP - interval '1 day' AND "key" <> ${this.key(key)} LIMIT 100)
      )
      INSERT INTO "RateLimitWindow" ("key", "hits", "resetAt")
      VALUES (${this.key(key)}, 1, CURRENT_TIMESTAMP + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimitWindow"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimitWindow"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimitWindow"."resetAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ${this.windowMs} * interval '1 millisecond' ELSE "RateLimitWindow"."resetAt" END
      RETURNING "hits" AS "totalHits", "resetAt" AS "resetTime"`;
    return rows[0];
  }
  async decrement(key: string) {
    await db.$executeRaw`UPDATE "RateLimitWindow" SET "hits"=GREATEST(0,"hits"-1) WHERE "key"=${this.key(key)}`;
  }
  async resetKey(key: string) {
    await db.$executeRaw`DELETE FROM "RateLimitWindow" WHERE "key"=${this.key(key)}`;
  }
}
export function sharedRateLimit(scope: string) {
  return process.env.VERCEL === "1"
    ? {
        store: new PostgresRateLimitStore(scope),
        passOnStoreError: false,
        // Vercel replaces this header at its edge. Do not enable this resolver on
        // a directly reachable Node server or trust arbitrary forwarded chains.
        keyGenerator: (req: Request) => {
          const address = req.header("x-vercel-forwarded-for") || "";
          return isIP(address)
            ? ipKeyGenerator(address)
            : "unverified-vercel-client";
        },
      }
    : {};
}

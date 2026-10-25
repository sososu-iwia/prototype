import "./config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
// A module-level pool is reused for concurrent/warm invocations, never per request.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: process.env.VERCEL === "1" ? 3 : 10,
  idleTimeoutMillis: process.env.VERCEL === "1" ? 5000 : 30000,
  maxLifetimeSeconds: 300,
});
if (process.env.VERCEL === "1") attachDatabasePool(pool);
export const db = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }), log: [] });
export const playerInclude = {
  seasons: {
    include: { season: true, team: true, statistics: true },
    orderBy: { seasonId: "desc" as const },
  },
  memberships: {
    where: { cancelled: false },
    include: { team: true, season: true },
    orderBy: { startsAt: "desc" as const },
  },
  achievements: true,
};
export const matchInclude = {
  homeTeam: true,
  awayTeam: true,
  competition: true,
  season: true,
  events: true,
};

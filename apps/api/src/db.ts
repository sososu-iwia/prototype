import "./config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
export const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
    idleTimeoutMillis: 30000,
  }),
  log: [],
});
export const playerInclude = {
  seasons: {
    include: { season: true, team: true, statistics: true },
    orderBy: { seasonId: "desc" as const },
  },
  memberships: {
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

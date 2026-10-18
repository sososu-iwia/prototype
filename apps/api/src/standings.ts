import { z } from "zod";
import { db } from "./db";
const row = z.object({
  rank: z.number().int(),
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    logo: z.string().optional(),
  }),
  points: z.number().int(),
  goalsDiff: z.number().int(),
  all: z.object({
    played: z.number().int(),
    win: z.number().int(),
    draw: z.number().int(),
    lose: z.number().int(),
    goals: z.object({ for: z.number().int(), against: z.number().int() }),
  }),
});
const response = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(
    z.object({ league: z.object({ standings: z.array(z.array(row)) }) }),
  ),
});
let nextAttempt = 0;
let inflight: Promise<unknown> | null = null;
export async function getStandings() {
  if (inflight) return inflight;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}
async function load() {
  const settings = await db.clubSettings.findUnique({ where: { id: "main" } });
  const leagueId = settings?.leagueId || process.env.FOOTBALL_LEAGUE_ID;
  const season = settings?.externalSeason || process.env.FOOTBALL_SEASON;
  if (!leagueId || !season)
    return {
      rows: [],
      source: null,
      updatedAt: null,
      stale: false,
      reason: "NOT_CONFIGURED",
    };
  const last = await db.leagueStandingSnapshot.findFirst({
    where: { leagueId, season },
    orderBy: { fetchedAt: "desc" },
  });
  const ttl =
    Math.min(
      86400,
      Math.max(300, Number(process.env.STANDINGS_TTL_SECONDS) || 3600),
    ) * 1000;
  if (last && Date.now() - last.fetchedAt.getTime() < ttl)
    return {
      rows: last.rows,
      source: last.source,
      updatedAt: last.fetchedAt,
      stale: false,
    };
  const fallback = (reason: string) => ({
    rows: last?.rows || [],
    source: last?.source || null,
    updatedAt: last?.fetchedAt || null,
    stale: !!last,
    reason,
  });
  if (!process.env.API_FOOTBALL_KEY) return fallback("KEY_MISSING");
  if (Date.now() < nextAttempt) return fallback("TEMPORARILY_UNAVAILABLE");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = new URL("https://v3.football.api-sports.io/standings");
      url.searchParams.set("league", leagueId);
      url.searchParams.set("season", season);
      const res = await fetch(url, {
        headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 429) {
        nextAttempt = Date.now() + 60000;
        return fallback("RATE_LIMITED");
      }
      if (!res.ok) throw new Error("PROVIDER_RESPONSE");
      const data = response.parse(await res.json());
      if (Object.keys(data.errors).length) throw new Error("PROVIDER_RESPONSE");
      const rows = data.response[0]?.league.standings[0];
      if (!rows?.length) throw new Error("EMPTY_PROVIDER_RESPONSE");
      const saved = await db.leagueStandingSnapshot.create({
        data: { leagueId, season, rows, source: "API-Football / API-Sports" },
      });
      return {
        rows: saved.rows,
        source: saved.source,
        updatedAt: saved.fetchedAt,
        stale: false,
      };
    } catch {
      if (attempt < 2)
        await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
    }
  }
  nextAttempt = Date.now() + 60000;
  console.warn(
    JSON.stringify({ event: "standings_provider_failed", leagueId, season }),
  );
  return fallback("TEMPORARILY_UNAVAILABLE");
}

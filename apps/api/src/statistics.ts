import { db } from "./db";
// Confirmed season totals and per-match totals are alternative sources, never additive.
export async function seasonStatistics(
  seasonId: string,
  publicOnly = true,
  playerIds?: string[],
) {
  const rows = await db.playerStatistics.findMany({
    where: {
      verified: true,
      playerSeason: {
        seasonId,
        ...(playerIds ? { playerId: { in: playerIds } } : {}),
        ...(publicOnly ? { player: { status: "PUBLISHED" } } : {}),
      },
    },
    include: {
      playerSeason: { include: { player: true, season: true, team: true } },
    },
  });
  const derived = rows.filter((row) => row.mode === "MATCHES");
  // One batch for the season instead of a query (and event load) per player.
  const lines = derived.length
    ? await db.playerMatchStatistics.findMany({
        where: {
          verified: true,
          OR: derived.map((row) => ({
            playerId: row.playerSeason.playerId,
            teamId: row.playerSeason.teamId,
          })),
          match: {
            seasonId,
            matchStatus: "FINISHED",
            status: "PUBLISHED",
            verification: "VERIFIED",
          },
        },
        include: {
          match: { include: { events: { where: { cancelled: false } } } },
        },
      })
    : [];
  const byPlayerTeam = new Map<string, typeof lines>();
  const key = (player: string, team: string | null) =>
    JSON.stringify([player, team]);
  for (const line of lines) {
    const group = key(line.playerId, line.teamId);
    const items = byPlayerTeam.get(group) || [];
    items.push(line);
    byPlayerTeam.set(group, items);
  }
  return rows
    .map((row) => {
      if (row.mode !== "MATCHES") return row;
      const lines =
        byPlayerTeam.get(
          key(row.playerSeason.playerId, row.playerSeason.teamId),
        ) || [];
      if (!lines.length) return { ...row, verified: false };
      return {
        ...row,
        appearances: lines.reduce((n, l) => n + l.appearances, 0),
        minutes: lines.reduce((n, l) => n + l.minutes, 0),
        goals: lines.reduce(
          (n, l) =>
            n +
            l.match.events.filter(
              (e) =>
                e.teamId === l.teamId &&
                e.type === "GOAL" &&
                e.playerId === l.playerId,
            ).length,
          0,
        ),
        assists: lines.reduce(
          (n, l) =>
            n +
            l.match.events.filter(
              (e) =>
                e.teamId === l.teamId &&
                e.type === "ASSIST" &&
                e.playerId === l.playerId,
            ).length,
          0,
        ),
        yellowCards: lines.reduce(
          (n, l) =>
            n +
            l.match.events.filter(
              (e) =>
                e.teamId === l.teamId &&
                e.type === "YELLOW" &&
                e.playerId === l.playerId,
            ).length,
          0,
        ),
        redCards: lines.reduce(
          (n, l) =>
            n +
            l.match.events.filter(
              (e) =>
                e.teamId === l.teamId &&
                e.type === "RED" &&
                e.playerId === l.playerId,
            ).length,
          0,
        ),
        cleanSheets: lines.some((l) => l.cleanSheets !== null)
          ? lines.reduce((n, l) => n + (l.cleanSheets || 0), 0)
          : null,
        source:
          [...new Set(lines.map((l) => l.source))].join("; ") || row.source,
        updatedAt: new Date(
          Math.max(
            row.updatedAt.getTime(),
            ...lines.map((l) => l.match.updatedAt.getTime()),
          ),
        ),
      };
    })
    .filter((row) => row.verified);
}

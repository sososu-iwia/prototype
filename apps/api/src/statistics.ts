import { db } from "./db";
// Confirmed season totals and per-match totals are alternative sources, never additive.
export async function seasonStatistics(seasonId: string, publicOnly = true) {
  const rows = await db.playerStatistics.findMany({
    where: {
      verified: true,
      playerSeason: {
        seasonId,
        ...(publicOnly ? { player: { status: "PUBLISHED" } } : {}),
      },
    },
    include: {
      playerSeason: { include: { player: true, season: true, team: true } },
    },
  });
  return Promise.all(
    rows.map(async (row) => {
      if (row.mode !== "MATCHES") return row;
      const lines = await db.playerMatchStatistics.findMany({
        where: {
          playerId: row.playerSeason.playerId,
          verified: true,
          match: {
            seasonId,
            matchStatus: "FINISHED",
            status: "PUBLISHED",
            verification: "VERIFIED",
          },
        },
        include: { match: { include: { events: true } } },
      });
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
                !e.cancelled && e.type === "GOAL" && e.playerId === l.playerId,
            ).length,
          0,
        ),
        assists: lines.reduce(
          (n, l) =>
            n +
            l.match.events.filter(
              (e) =>
                !e.cancelled &&
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
                !e.cancelled &&
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
                !e.cancelled && e.type === "RED" && e.playerId === l.playerId,
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
    }),
  ).then((items) => items.filter((row) => row.verified));
}

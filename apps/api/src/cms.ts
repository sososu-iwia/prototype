import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthRequest } from "./auth";
import { cmsSchemas, type Entity } from "./domain";

type Tx = Prisma.TransactionClient;
export function expectedVersion(
  req: AuthRequest,
  existing: Record<string, unknown> | null,
) {
  if (!existing) throw new NotFoundException({ code: "NOT_FOUND" });
  const expected = req.header("if-match");
  if (!expected) throw new HttpException({ code: "VERSION_REQUIRED" }, 428);
  if (expected !== String(existing.version))
    throw new ConflictException({ code: "EDIT_CONFLICT" });
}
export async function mutationLock(tx: Tx) {
  // Serializes related content operations, including reference checks and media deletion.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(786032)::text`;
}
export async function audit(
  tx: Tx,
  req: AuthRequest,
  entity: string,
  entityId: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const changes: Record<string, unknown> = {};
  for (const key of new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ])) {
    if (/password|token|secret|csrf/i.test(key)) continue;
    if (
      entity === "academy-inquiries" &&
      !["state", "purgedAt", "version"].includes(key)
    )
      continue;
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      // Long article bodies are summarized, never logged verbatim.
      const summarize = (v: unknown) =>
        JSON.stringify(v ?? null).length > 500
          ? "[content changed]"
          : (v ?? null);
      changes[key] = {
        before: summarize(before?.[key]),
        after: summarize(after?.[key]),
      };
    }
  }
  await tx.auditLog.create({
    data: {
      actorId: req.auth.userId,
      entity,
      entityId,
      action,
      changes: changes as Prisma.InputJsonObject,
      result: "SUCCESS",
    },
  });
}
export async function validateRelations(
  tx: Tx,
  entity: Entity,
  body: unknown,
  id?: string,
) {
  if (entity === "staff") {
    const staff = cmsSchemas.staff.parse(body);
    if (
      (staff.teamId &&
        !(await tx.team.findUnique({ where: { id: staff.teamId } }))) ||
      (staff.sourceSeasonId &&
        !(await tx.season.findUnique({ where: { id: staff.sourceSeasonId } })))
    )
      throw new BadRequestException({ code: "INVALID_RELATION" });
  }
  if (id && ["player-seasons", "statistics", "seasons"].includes(entity)) {
    const data = body as Record<string, unknown>;
    if (entity === "seasons" && data.id !== id)
      throw new ConflictException({ code: "HISTORY_PROTECTED" });
    if (entity === "player-seasons") {
      const old = await tx.playerSeason.findUnique({ where: { id } });
      if (
        old &&
        ["playerId", "seasonId", "teamId"].some(
          (k) => data[k] !== old[k as "playerId"],
        )
      )
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
    }
    if (entity === "statistics") {
      const old = await tx.playerStatistics.findUnique({ where: { id } });
      if (old && old.playerSeasonId !== data.playerSeasonId)
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
    }
  }
  if (entity === "memberships") {
    const m = cmsSchemas.memberships.parse(body);
    const [season, player, team] = await Promise.all([
      tx.season.findUnique({ where: { id: m.seasonId } }),
      tx.player.findUnique({ where: { id: m.playerId } }),
      tx.team.findUnique({ where: { id: m.teamId } }),
    ]);
    if (!season || !player || !team || (!id && player.archivedAt))
      throw new BadRequestException({ code: "INVALID_RELATION" });
    if (
      (!id && season.state === "ARCHIVED") ||
      (season.startsAt && new Date(m.startsAt) < season.startsAt) ||
      (season.endsAt &&
        new Date(m.endsAt || m.startsAt).getTime() >
          season.endsAt.getTime() + 86400000)
    )
      throw new BadRequestException({ code: "INVALID_SEASON_PERIOD" });
    if (id) {
      const before = await tx.rosterMembership.findUnique({ where: { id } });
      if (
        before &&
        (before.playerId !== m.playerId ||
          before.teamId !== m.teamId ||
          before.seasonId !== m.seasonId)
      )
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
      const history = await tx.playerMatchStatistics.findMany({
        where: {
          playerId: m.playerId,
          OR: [{ teamId: m.teamId }, { teamId: null }],
          match: {
            seasonId: m.seasonId,
            OR: [{ homeTeamId: m.teamId }, { awayTeamId: m.teamId }],
          },
        },
        include: { match: true },
      });
      const events = await tx.matchEvent.findMany({
        where: {
          playerId: m.playerId,
          teamId: m.teamId,
          match: {
            seasonId: m.seasonId,
            OR: [{ homeTeamId: m.teamId }, { awayTeamId: m.teamId }],
          },
        },
        include: { match: true },
      });
      if (
        [...history, ...events].some(
          (record) =>
            record.match.kickoff >= before!.startsAt &&
            (!before!.endsAt || record.match.kickoff < before!.endsAt) &&
            (m.cancelled ||
              record.match.kickoff < new Date(m.startsAt) ||
              (m.endsAt && record.match.kickoff >= new Date(m.endsAt))),
        )
      )
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
    }
    if (
      player.archivedAt &&
      !m.cancelled &&
      (!m.endsAt || new Date(m.endsAt) > new Date())
    )
      throw new ConflictException({ code: "HISTORY_PROTECTED" });
    const overlap =
      !m.cancelled &&
      (await tx.rosterMembership.findFirst({
        where: {
          playerId: m.playerId,
          teamId: m.teamId,
          cancelled: false,
          ...(id ? { id: { not: id } } : {}),
          ...(m.endsAt ? { startsAt: { lt: new Date(m.endsAt) } } : {}),
          OR: [{ endsAt: null }, { endsAt: { gt: new Date(m.startsAt) } }],
        },
      }));
    if (overlap) throw new ConflictException({ code: "MEMBERSHIP_OVERLAP" });
    // Historical aggregate remains a stable player+season record across transfers and returns.
    await tx.playerSeason.upsert({
      where: {
        playerId_seasonId: { playerId: m.playerId, seasonId: m.seasonId },
      },
      create: {
        playerId: m.playerId,
        seasonId: m.seasonId,
        teamId: m.teamId,
        number: m.number,
      },
      update: {},
    });
  }
  if (entity === "match-events" || entity === "match-statistics") {
    const data =
      entity === "match-events"
        ? cmsSchemas["match-events"].parse(body)
        : cmsSchemas["match-statistics"].parse(body);
    const match = await tx.match.findUnique({ where: { id: data.matchId } });
    if (!match || !["LIVE", "FINISHED"].includes(match.matchStatus))
      throw new BadRequestException({ code: "MATCH_NOT_PLAYED" });
    const memberships = await tx.rosterMembership.findMany({
      where: {
        playerId: data.playerId,
        seasonId: match.seasonId,
        cancelled: false,
        teamId:
          "teamId" in data && data.teamId
            ? data.teamId
            : { in: [match.homeTeamId, match.awayTeamId] },
        startsAt: { lte: match.kickoff },
        OR: [{ endsAt: null }, { endsAt: { gt: match.kickoff } }],
      },
    });
    if (new Set(memberships.map((m) => m.teamId)).size > 1)
      throw new ConflictException({ code: "AMBIGUOUS_TEAM" });
    const membership = memberships[0];
    if (
      !membership ||
      ![match.homeTeamId, match.awayTeamId].includes(membership.teamId)
    )
      throw new BadRequestException({ code: "PLAYER_NOT_IN_ROSTER" });
    if (entity === "match-events") {
      const event = cmsSchemas["match-events"].parse(body);
      if (!event.cancelled && ["YELLOW", "RED"].includes(event.type)) {
        const count = await tx.matchEvent.count({
          where: {
            matchId: match.id,
            playerId: event.playerId,
            type: event.type,
            cancelled: false,
            ...(id ? { id: { not: id } } : {}),
          },
        });
        if (count >= (event.type === "RED" ? 1 : 2))
          throw new ConflictException({ code: "EVENT_SCORE_CONFLICT" });
      }
      if (!event.cancelled && ["GOAL", "ASSIST"].includes(event.type)) {
        const count = await tx.matchEvent.count({
          where: {
            matchId: match.id,
            teamId: event.teamId,
            type: event.type,
            cancelled: false,
            ...(id ? { id: { not: id } } : {}),
          },
        });
        const score =
          event.teamId === match.homeTeamId ? match.homeScore : match.awayScore;
        if (score !== null && count + 1 > score)
          throw new ConflictException({ code: "EVENT_SCORE_CONFLICT" });
      }
    } else if ("cleanSheets" in data && data.cleanSheets) {
      const player = await tx.player.findUnique({
        where: { id: data.playerId },
      });
      const conceded =
        membership.teamId === match.homeTeamId
          ? match.awayScore
          : match.homeScore;
      if (player?.position !== "goalkeeper" || conceded !== 0)
        throw new BadRequestException({ code: "INVALID_CLEAN_SHEET" });
    }
    if (entity === "match-statistics") return { teamId: membership.teamId };
  }
  if (entity === "matches" && id) {
    const m = cmsSchemas.matches.parse(body);
    if (["LIVE", "FINISHED"].includes(m.matchStatus)) {
      for (const [teamId, score] of [
        [m.homeTeamId, m.homeScore],
        [m.awayTeamId, m.awayScore],
      ] as const) {
        const goals = await tx.matchEvent.count({
          where: { matchId: id, teamId, type: "GOAL", cancelled: false },
        });
        const assists = await tx.matchEvent.count({
          where: { matchId: id, teamId, type: "ASSIST", cancelled: false },
        });
        if (Math.max(goals, assists) > (score ?? 0))
          throw new ConflictException({ code: "EVENT_SCORE_CONFLICT" });
      }
    }
    const old = await tx.match.findUnique({ where: { id } });
    if (
      old &&
      (old.seasonId !== m.seasonId ||
        old.homeTeamId !== m.homeTeamId ||
        old.awayTeamId !== m.awayTeamId ||
        old.kickoff.toISOString() !== m.kickoff) &&
      ((await tx.matchEvent.count({ where: { matchId: id } })) ||
        (await tx.playerMatchStatistics.count({ where: { matchId: id } })))
    )
      throw new ConflictException({ code: "MATCH_HAS_HISTORY" });
  }
  if (entity === "matches") {
    const match = cmsSchemas.matches.parse(body);
    const season = await tx.season.findUnique({
      where: { id: match.seasonId },
    });
    if (!season) throw new BadRequestException({ code: "INVALID_RELATION" });
    if (
      (season.startsAt && new Date(match.kickoff) < season.startsAt) ||
      (season.endsAt &&
        new Date(match.kickoff).getTime() > season.endsAt.getTime() + 86400000)
    )
      throw new BadRequestException({ code: "INVALID_SEASON_PERIOD" });
  }
  if (entity === "matches" && id) {
    const m = cmsSchemas.matches.parse(body);
    const lines = await tx.playerMatchStatistics.findMany({
      where: { matchId: id, cleanSheets: 1 },
    });
    for (const line of lines) {
      const conceded = line.teamId === m.homeTeamId ? m.awayScore : m.homeScore;
      if (conceded && conceded > 0)
        await tx.playerMatchStatistics.update({
          where: { id: line.id },
          data: { cleanSheets: 0, version: { increment: 1 } },
        });
    }
  }
  if (entity === "statistics") {
    const data = cmsSchemas.statistics.parse(body);
    const period = await tx.playerSeason.findUnique({
      where: { id: data.playerSeasonId },
      include: { player: true },
    });
    if (!period) throw new BadRequestException({ code: "INVALID_RELATION" });
    if (data.cleanSheets != null && period.player.position !== "goalkeeper")
      throw new BadRequestException({ code: "INVALID_CLEAN_SHEET" });
  }
  if (entity === "seasons") {
    const season = cmsSchemas.seasons.parse(body);
    if (id && (season.startsAt || season.endsAt)) {
      const outside: Prisma.RosterMembershipWhereInput[] = [];
      const matchDates: Prisma.DateTimeFilter = {};
      if (season.startsAt) {
        const start = new Date(season.startsAt);
        outside.push({ startsAt: { lt: start } });
        matchDates.lt = start;
      }
      if (season.endsAt) {
        const end = new Date(new Date(season.endsAt).getTime() + 86400000);
        outside.push({ startsAt: { gt: end } }, { endsAt: { gt: end } });
      }
      const period = await tx.rosterMembership.findFirst({
        where: { seasonId: id, cancelled: false, OR: outside },
      });
      const match = await tx.match.findFirst({
        where: {
          seasonId: id,
          OR: [
            ...(season.startsAt ? [{ kickoff: matchDates }] : []),
            ...(season.endsAt
              ? [
                  {
                    kickoff: {
                      gt: new Date(
                        new Date(season.endsAt).getTime() + 86400000,
                      ),
                    },
                  },
                ]
              : []),
          ],
        },
      });
      if (period || match)
        throw new ConflictException({ code: "INVALID_SEASON_PERIOD" });
    }
    if (season.current)
      await tx.season.updateMany({
        where: { current: true, id: { not: season.id } },
        data: { current: false, version: { increment: 1 } },
      });
  }
}

export async function validateAssetReferences(
  tx: Tx,
  data: Record<string, unknown>,
) {
  const paths = [
    ...["photo", "cover", "poster", "logo", "url"].map((k) => data[k]),
    ...(Array.isArray(data.images) ? data.images : []),
  ].filter(
    (p): p is string => typeof p === "string" && p.startsWith("/uploads/"),
  );
  for (const path of paths)
    if (
      !(await tx.mediaAsset.findFirst({
        where: {
          OR: [
            { url: path },
            { variants: { path: ["avif"], equals: path } },
            { variants: { path: ["thumbnail"], equals: path } },
          ],
        },
      }))
    )
      throw new BadRequestException({ code: "MISSING_MEDIA" });
}

export async function archivePlayerMemberships(
  tx: Tx,
  req: AuthRequest,
  playerId: string,
) {
  const now = new Date();
  const periods = await tx.rosterMembership.findMany({
    where: {
      playerId,
      cancelled: false,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });
  for (const before of periods) {
    if (before.startsAt >= now) {
      const match = {
        seasonId: before.seasonId,
        OR: [{ homeTeamId: before.teamId }, { awayTeamId: before.teamId }],
        kickoff: {
          gte: before.startsAt,
          ...(before.endsAt ? { lt: before.endsAt } : {}),
        },
      };
      const recorded = await tx.playerMatchStatistics.count({
        where: {
          playerId,
          OR: [{ teamId: before.teamId }, { teamId: null }],
          match,
        },
      });
      const events = await tx.matchEvent.count({
        where: { playerId, teamId: before.teamId, match },
      });
      if (recorded || events)
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
    }
    const saved = await tx.rosterMembership.update({
      where: { id: before.id },
      data: {
        ...(before.startsAt >= now ? { cancelled: true } : { endsAt: now }),
        departureReason: before.departureReason,
        version: { increment: 1 },
      },
    });
    await audit(
      tx,
      req,
      "memberships",
      before.id,
      before.startsAt >= now ? "CANCEL" : "END",
      before,
      saved,
    );
  }
}

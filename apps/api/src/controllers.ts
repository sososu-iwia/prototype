import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBody, ApiCookieAuth, ApiOperation } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import * as argon2 from "argon2";

import { z } from "zod";
import { db, playerInclude, matchInclude } from "./db";
import {
  AuthRequest,
  SessionGuard,
  hash,
  newToken,
  requireAdmin,
  requireOrigin,
} from "./auth";
import { secureCookie } from "./config";
import {
  Entity,
  cmsSchemas as schemas,
  settingsSchema,
  rankStatistics,
  publicBirthDate,
} from "./domain";
import { getStandings } from "./standings";
import {
  audit,
  expectedVersion,
  mutationLock,
  validateRelations,
  validateAssetReferences,
  archivePlayerMemberships,
} from "./cms";
import { seasonStatistics } from "./statistics";
import { uploadImage } from "./storage";
import { purgeExpiredInquiries } from "./inquiry-retention";
import { recordStaffRevision } from "./staff-history";
import { publicRegistration } from "./kff-import";
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().max(100).default(""),
});
const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const dummyHash = argon2.hash(newToken(), {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});
const published = { status: "PUBLISHED" as const };
const publishedNews = () => ({
  ...published,
  publishedAt: { lte: new Date() },
});
async function publicPlayerRows(
  players: Prisma.PlayerGetPayload<{ include: typeof playerInclude }>[],
  season?: string,
) {
  const totals = (
    await Promise.all(
      [
        ...new Set(players.flatMap((p) => p.seasons.map((s) => s.seasonId))),
      ].map((id) =>
        seasonStatistics(
          id,
          true,
          players.map((p) => p.id),
        ),
      ),
    )
  ).flat();
  const byPeriod = new Map(
    totals.map((row) => {
      const { playerSeason: _relation, ...statistics } = row;
      return [row.playerSeasonId, statistics] as const;
    }),
  );
  const now = new Date();
  const registrations = await db.rosterImportRecord.findMany({
    where: {
      playerId: { in: players.map((p) => p.id) },
      reviewStatus: "APPROVED",
    },
  });
  return players.map((player) => ({
    ...player,
    registrations: registrations
      .filter((r) => r.playerId === player.id)
      .map(publicRegistration),
    birthDate: publicBirthDate(player.birthDate, now),
    rosterNumber:
      player.memberships.find(
        (m) =>
          m.team.managed &&
          !m.cancelled &&
          (season
            ? m.seasonId === season
            : m.startsAt <= now && (!m.endsAt || m.endsAt > now)),
      )?.number ?? null,
    seasons: player.seasons.map((period) => ({
      ...period,
      statistics: byPeriod.get(period.id) || null,
    })),
  }));
}
@ApiTags("Public")
@Controller("api/v1")
export class PublicController {
  @Get("health") health() {
    return { status: "ok" };
  }
  @Get("ready") async ready() {
    await db.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
  @Get("players") async players(@Query() query: Record<string, string>) {
    const p = pagination.parse(query);
    const position = query.position
      ? z
          .enum(["goalkeeper", "defender", "midfielder", "forward"])
          .parse(query.position)
      : undefined;
    const season = query.season ? idSchema.parse(query.season) : undefined;
    const where = {
      ...published,
      ...(position ? { position } : {}),
      ...(query.archive === "true"
        ? {}
        : {
            archivedAt: null,
            memberships: {
              some: {
                team: { managed: true },
                cancelled: false,
                ...(season
                  ? { seasonId: season }
                  : {
                      startsAt: { lte: new Date() },
                      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
                    }),
              },
            },
          }),
      ...(season ? { seasons: { some: { seasonId: season } } } : {}),
    };
    const [items, total] = await db.$transaction([
      db.player.findMany({
        where,
        include: playerInclude,
        skip: (p.page - 1) * p.limit,
        take: p.limit,
        orderBy: { slug: "asc" },
      }),
      db.player.count({ where }),
    ]);
    return {
      items: await publicPlayerRows(items, season),
      total,
      page: p.page,
      limit: p.limit,
    };
  }
  @Get("players/:slug") async player(@Param("slug") slug: string) {
    const player = await db.player.findFirst({
      where: { slug: idSchema.parse(slug), ...published },
      include: playerInclude,
    });
    if (!player) throw new NotFoundException({ code: "NOT_FOUND" });
    return (await publicPlayerRows([player]))[0];
  }
  @Get("matches") async matches(@Query() query: Record<string, string>) {
    const p = pagination.parse(query);
    const status = query.status
      ? z
          .enum(["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"])
          .parse(query.status)
      : undefined;
    const where = {
      ...published,
      ...(status ? { matchStatus: status } : {}),
      ...(query.season ? { seasonId: idSchema.parse(query.season) } : {}),
      ...(query.competition
        ? { competitionId: idSchema.parse(query.competition) }
        : {}),
      ...(query.venue === "home"
        ? { homeTeam: { slug: "ordabasy" } }
        : query.venue === "away"
          ? { awayTeam: { slug: "ordabasy" } }
          : {}),
    };
    const [items, total] = await db.$transaction([
      db.match.findMany({
        where,
        include: matchInclude,
        orderBy: { kickoff: "asc" },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      db.match.count({ where }),
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get("news") async news(@Query() query: Record<string, string>) {
    const p = pagination.parse(query);
    const where = {
      ...publishedNews(),
      ...(p.q
        ? {
            translations: {
              some: { title: { contains: p.q, mode: "insensitive" as const } },
            },
          }
        : {}),
    };
    const [items, total] = await db.$transaction([
      db.newsPost.findMany({
        where,
        include: { translations: true, category: true },
        orderBy: { publishedAt: "desc" },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      db.newsPost.count({ where }),
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get("news/:slug") async article(@Param("slug") slug: string) {
    const post = await db.newsPost.findFirst({
      where: { slug: idSchema.parse(slug), ...publishedNews() },
      include: { translations: true, category: true },
    });
    if (!post) throw new NotFoundException({ code: "NOT_FOUND" });
    return post;
  }
  @Get("gallery") async gallery(@Query() query: Record<string, string>) {
    const p = pagination.parse(query);
    const [items, total] = await db.$transaction([
      db.galleryItem.findMany({
        where: published,
        orderBy: { sortOrder: "asc" },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      db.galleryItem.count({ where: published }),
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get("club") async club() {
    const [info, achievements, staff, settings] = await Promise.all([
      db.clubInfo.findMany(),
      db.clubAchievement.findMany({
        where: {
          playerId: null,
          status: "PUBLISHED",
          verification: "VERIFIED",
        },
        orderBy: { year: "desc" },
      }),
      db.staffMember.findMany({ where: published }),
      db.clubSettings.findUnique({ where: { id: "main" } }),
    ]);
    return {
      info,
      achievements,
      staff,
      sections: settings?.sections || [],
      timezone:
        settings?.timezone || process.env.DISPLAY_TIMEZONE || "Asia/Almaty",
    };
  }
  @Get("seasons") async seasons() {
    return db.season.findMany({ orderBy: { id: "desc" } });
  }
  @Get("competitions") async competitions() {
    return db.competition.findMany();
  }
  @Get("standings") async standings() {
    return getStandings();
  }
  @Get("statistics") async statistics(@Query() query: Record<string, string>) {
    const season = query.season
      ? idSchema.parse(query.season)
      : (await db.season.findFirst({ where: { current: true } }))?.id;
    const sort = z
      .enum(["goals", "assists", "appearances", "efficiency"])
      .parse(query.sort || "goals");
    if (!season) return { items: [], season: null, updatedAt: null };
    const rows = await seasonStatistics(season);
    return {
      items: rankStatistics(rows, sort),
      season,
      updatedAt: rows.length
        ? new Date(Math.max(...rows.map((r) => r.updatedAt.getTime())))
        : null,
      method: sort === "efficiency" ? "(goals + assists) × 90 / minutes" : sort,
    };
  }
}
@ApiTags("Authentication")
@Controller("api/v1/auth")
export class AuthController {
  @Post("login")
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 12, maxLength: 128 },
      },
    },
  })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireOrigin(req);
    const credentials = z
      .object({
        email: z.email().max(254),
        password: z.string().min(12).max(128),
      })
      .strict()
      .parse(body);
    const user = await db.user.findUnique({
      where: { email: credentials.email.toLowerCase() },
    });
    // A fixed-work Argon2 hash avoids the cheap unknown-user path.
    const valid = await argon2
      .verify(user?.passwordHash || (await dummyHash), credentials.password)
      .catch(() => false);
    if (!user?.active || !valid)
      throw new UnauthorizedException({ code: "INVALID_CREDENTIALS" });
    const token = newToken(),
      csrf = hash(`csrf:${token}`);
    await db.$transaction(async (tx) => {
      // Password verification is deliberately outside the mutation lock. Recheck
      // under the same lock as role/password/deactivation changes before writing
      // a session, so an in-flight login cannot outlive their revocation.
      await mutationLock(tx);
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { active: true, version: true, passwordHash: true },
      });
      if (
        !current?.active ||
        current.version !== user.version ||
        current.passwordHash !== user.passwordHash
      )
        throw new UnauthorizedException({ code: "INVALID_CREDENTIALS" });
      await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hash(token),
          csrfHash: hash(csrf),
          expiresAt: new Date(Date.now() + 8 * 3600000),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "LOGIN",
          entity: "session",
          entityId: user.id,
        },
      });
    });
    res.cookie("ordabasy_session", token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600000,
    });
    res.setHeader("Cache-Control", "no-store");
    return {
      user: { id: user.id, email: user.email, role: user.role },
      csrfToken: csrf,
    };
  }
  @Get("me") @UseGuards(SessionGuard) async me(@Req() req: AuthRequest) {
    return db.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true, role: true },
    });
  }
  @Get("csrf") @UseGuards(SessionGuard) async csrf(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = hash(`csrf:${req.cookies.ordabasy_session}`);
    await db.session.update({
      where: { id: req.auth.sessionId },
      data: { csrfHash: hash(token) },
    });
    res.setHeader("Cache-Control", "no-store");
    return { csrfToken: token };
  }
  @Post("logout") @UseGuards(SessionGuard) async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await db.session.delete({ where: { id: req.auth.sessionId } });
    res.clearCookie("ordabasy_session", {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "strict",
      path: "/",
    });
    return { ok: true };
  }
}
interface Delegate {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  count(args: Record<string, unknown>): Promise<number>;
  findUnique(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
}
function delegate(tx: Prisma.TransactionClient, entity: Entity): Delegate {
  return {
    players: tx.player,
    matches: tx.match,
    news: tx.newsPost,
    gallery: tx.galleryItem,
    club: tx.clubInfo,
    staff: tx.staffMember,
    achievements: tx.clubAchievement,
    sponsors: tx.sponsor,
    academy: tx.academyPage,
    "academy-inquiries": tx.academyInquiry,
    seasons: tx.season,
    teams: tx.team,
    competitions: tx.competition,
    categories: tx.category,
    "player-seasons": tx.playerSeason,
    statistics: tx.playerStatistics,
    memberships: tx.rosterMembership,
    "match-events": tx.matchEvent,
    "match-statistics": tx.playerMatchStatistics,
  }[entity] as unknown as Delegate;
}
function entityName(s: string): Entity {
  if (!Object.hasOwn(schemas, s))
    throw new NotFoundException({ code: "NOT_FOUND" });
  return s as Entity;
}
const includes = (e: Entity) =>
  e === "memberships"
    ? { player: true, season: true, team: true }
    : e === "match-events" || e === "match-statistics"
      ? { player: true, match: { include: matchInclude } }
      : e === "player-seasons"
        ? { player: true, season: true, team: true }
        : e === "statistics"
          ? { playerSeason: { include: { player: true, season: true } } }
          : e === "news"
            ? { translations: true }
            : e === "players"
              ? playerInclude
              : e === "matches"
                ? matchInclude
                : undefined;
const adminOnly: Entity[] = [
  "sponsors",
  "academy",
  "academy-inquiries",
  "club",
  "staff",
  "achievements",
  "seasons",
  "teams",
  "competitions",
  "categories",
  "players",
  "matches",
  "player-seasons",
  "statistics",
  "memberships",
  "match-events",
  "match-statistics",
];
@ApiTags("Administration")
@ApiCookieAuth("ordabasy_session")
@Controller("api/v1/admin")
@UseGuards(SessionGuard)
export class AdminController {
  @Get("dashboard") async dashboard() {
    const [players, matches, news, gallery] = await Promise.all([
      db.player.count(),
      db.match.count(),
      db.newsPost.count(),
      db.galleryItem.count(),
    ]);
    return { players, matches, news, gallery };
  }
  @Get("audit") async audit(
    @Req() req: AuthRequest,
    @Query() query: Record<string, string>,
  ) {
    requireAdmin(req);
    const p = pagination.parse(query);
    const actorsForSearch = p.q
      ? await db.user.findMany({
          where: { email: { contains: p.q, mode: "insensitive" } },
          select: { id: true },
        })
      : [];
    const where = {
      ...(query.entity
        ? { entity: z.string().max(50).parse(query.entity) }
        : {}),
      ...(query.q
        ? {
            OR: [
              { actorId: { contains: p.q } },
              { actorId: { in: actorsForSearch.map((a) => a.id) } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      db.auditLog.count({ where }),
    ]);
    const actors = await db.user.findMany({
      where: { id: { in: items.map((i) => i.actorId) } },
      select: { id: true, email: true },
    });
    return {
      items: items.map((i) => ({
        ...i,
        actor: actors.find((a) => a.id === i.actorId)?.email || i.actorId,
      })),
      total,
      page: p.page,
      limit: p.limit,
    };
  }
  @Get("settings") async settings(@Req() req: AuthRequest) {
    requireAdmin(req);
    return db.clubSettings.findUnique({ where: { id: "main" } });
  }
  @Put("settings") async saveSettings(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    const data = settingsSchema.parse(body);
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      const before = await tx.clubSettings.findUnique({
        where: { id: "main" },
      });
      if (before) expectedVersion(req, before);
      const saved = await tx.clubSettings.upsert({
        where: { id: "main" },
        create: { id: "main", ...data },
        update: { ...data, version: { increment: 1 } },
      });
      await audit(tx, req, "settings", "main", "UPDATE", before, saved);
      return saved;
    });
  }
  @Get(":entity") async list(
    @Param("entity") name: string,
    @Query() query: Record<string, string>,
    @Req() _req: AuthRequest,
  ) {
    const entity = entityName(name);
    if (entity === "academy-inquiries") {
      requireAdmin(_req);
      await purgeExpiredInquiries();
    }
    const p = pagination.parse(query);
    let where: Record<string, unknown> = {};
    if (p.q) {
      if (["players", "news", "teams", "categories"].includes(entity))
        where = {
          OR: [
            { slug: { contains: p.q, mode: "insensitive" } },
            ...(entity === "news"
              ? [
                  {
                    translations: {
                      some: { title: { contains: p.q, mode: "insensitive" } },
                    },
                  },
                ]
              : ["kk", "ru", "en"].map((l) => ({
                  names: {
                    path: [l],
                    string_contains: p.q,
                    mode: "insensitive",
                  },
                }))),
          ],
        };
      else if (entity === "sponsors")
        where = { name: { contains: p.q, mode: "insensitive" } };
      else if (entity === "achievements")
        where = {
          OR: [
            { source: { contains: p.q, mode: "insensitive" } },
            ...["kk", "ru", "en"].map((locale) => ({
              title: {
                path: [locale],
                string_contains: p.q,
                mode: "insensitive",
              },
            })),
          ],
        };
      else if (entity === "academy-inquiries")
        where = {
          OR: ["guardianName", "contact"].map((field) => ({
            [field]: { contains: p.q, mode: "insensitive" },
          })),
        };
      else if (entity === "matches")
        where = {
          OR: [
            { homeTeam: { slug: { contains: p.q, mode: "insensitive" } } },
            { awayTeam: { slug: { contains: p.q, mode: "insensitive" } } },
            { source: { contains: p.q, mode: "insensitive" } },
          ],
        };
      else if (
        [
          "memberships",
          "player-seasons",
          "match-events",
          "match-statistics",
        ].includes(entity)
      )
        where = {
          OR: [
            { id: { contains: p.q, mode: "insensitive" } },
            ...["kk", "ru", "en"].map((l) => ({
              player: {
                names: { path: [l], string_contains: p.q, mode: "insensitive" },
              },
            })),
          ],
        };
      else where = { id: { contains: p.q, mode: "insensitive" } };
    }
    if (
      query.status &&
      [
        "players",
        "matches",
        "news",
        "gallery",
        "staff",
        "sponsors",
        "academy",
        "teams",
        "achievements",
      ].includes(entity)
    )
      where = {
        ...where,
        ...(entity === "players" && query.status === "ARCHIVED"
          ? { archivedAt: { not: null } }
          : {
              status: z
                .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
                .parse(query.status),
              ...(entity === "players" ? { archivedAt: null } : {}),
            }),
      };
    for (const key of ["seasonId", "teamId", "playerId", "matchId"])
      if (query[key] && key in schemas[entity].shape)
        where[key] = idSchema.parse(query[key]);
    if (entity === "players" && query.seasonId)
      where.seasons = { some: { seasonId: idSchema.parse(query.seasonId) } };
    const sort =
      ["id", "slug", "kickoff", "publishedAt", "name", "startsAt"].includes(
        query.sort,
      ) &&
      (query.sort === "id" || query.sort in schemas[entity].shape)
        ? query.sort
        : "id";
    const direction = query.direction === "desc" ? "desc" : "asc";
    const d = delegate(db, entity);
    const [items, total] = await Promise.all([
      d.findMany({
        where,
        include: includes(entity),
        skip: (p.page - 1) * p.limit,
        take: p.limit,
        orderBy: { [sort]: direction },
      }),
      d.count({ where }),
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Post(":entity")
  @ApiOperation({
    summary:
      "Create a validated record. Resource schemas: /api/v1/admin-schema (see docs/API.md).",
  })
  async create(
    @Param("entity") name: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.save(name, undefined, body, req);
  }
  @Get(":entity/:id") async detail(
    @Param("entity") name: string,
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    const entity = entityName(name);
    if (entity === "academy-inquiries") {
      requireAdmin(req);
      await purgeExpiredInquiries();
    }
    const record = await delegate(db, entity).findUnique({
      where: { id: idSchema.parse(id) },
      include: includes(entity),
    });
    if (!record) throw new NotFoundException({ code: "NOT_FOUND" });
    return record;
  }
  @Put(":entity/:id") async update(
    @Param("entity") name: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.save(name, idSchema.parse(id), body, req);
  }
  private async save(
    name: string,
    id: string | undefined,
    body: unknown,
    req: AuthRequest,
  ) {
    const entity = entityName(name);
    if (adminOnly.includes(entity)) requireAdmin(req);
    if (entity === "academy-inquiries" && !id)
      throw new ForbiddenException({ code: "PUBLIC_FORM_ONLY" });
    const parsed = schemas[entity].parse(body);
    const data: Record<string, unknown> = { ...parsed };
    if (entity === "news") {
      const { translations, ...post } = schemas.news.parse(body);
      if (id) {
        const existing = await db.newsPost.findUnique({ where: { id } });
        if (
          existing &&
          existing.authorId !== req.auth.userId &&
          req.auth.role === "EDITOR"
        )
          throw new ForbiddenException({ code: "NOT_OWNER" });
      }
      Object.assign(data, post, {
        authorId: id ? undefined : req.auth.userId,
        translations: {
          ...(id ? { deleteMany: {} } : {}),
          create: translations,
        },
      });
    }
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      const key = req.header("idempotency-key");
      if (key && !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
        throw new BadRequestException({ code: "INVALID_IDEMPOTENCY_KEY" });
      if (key && !id) {
        const existing = await tx.mutationKey.findUnique({
          where: { userId_key: { userId: req.auth.userId, key } },
        });
        if (existing) {
          const response = existing.response as Prisma.JsonObject;
          if (
            response.entity !== entity ||
            response.body !== JSON.stringify(parsed)
          )
            throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT" });
          return response.saved;
        }
      }
      const d = delegate(tx, entity);
      const before = id
        ? await d.findUnique({ where: { id }, include: includes(entity) })
        : null;
      if (id) expectedVersion(req, before);
      if (entity === "academy-inquiries" && before?.purgedAt)
        throw new ConflictException({ code: "HISTORY_PROTECTED" });
      if (
        entity === "news" &&
        before &&
        req.auth.role === "EDITOR" &&
        before.authorId !== req.auth.userId
      )
        throw new ForbiddenException({ code: "NOT_OWNER" });
      Object.assign(data, await validateRelations(tx, entity, body, id));
      await validateAssetReferences(tx, data);
      if (
        entity === "players" &&
        id &&
        data.archivedAt &&
        !before?.archivedAt
      ) {
        await archivePlayerMemberships(tx, req, id);
      }
      const saved = await (id
        ? d.update({
            where: { id, version: Number(before!.version) },
            data: { ...data, version: { increment: 1 } },
            include: includes(entity),
          })
        : d.create({ data, include: includes(entity) }));
      if (entity === "staff") await recordStaffRevision(tx, String(saved.id));
      // Touch match timestamps when event/line changes so public provenance is current.
      if (entity === "match-events" || entity === "match-statistics")
        await tx.match.updateMany({
          where: {
            id: {
              in: [
                ...new Set([
                  String(saved.matchId),
                  ...(before?.matchId ? [String(before.matchId)] : []),
                ]),
              ],
            },
          },
          data: { version: { increment: 1 } },
        });
      await audit(
        tx,
        req,
        entity,
        String(saved.id),
        id ? "UPDATE" : "CREATE",
        before,
        saved,
      );
      if (key && !id)
        await tx.mutationKey.create({
          data: {
            userId: req.auth.userId,
            key,
            response: JSON.parse(
              JSON.stringify({ entity, body: JSON.stringify(parsed), saved }),
            ),
          },
        });
      return saved;
    });
  }
  @Delete(":entity/:id") async remove(
    @Param("entity") name: string,
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    const entity = entityName(name);
    idSchema.parse(id);
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      const d = delegate(tx, entity),
        before = await d.findUnique({ where: { id } });
      expectedVersion(req, before);
      if (entity === "academy-inquiries") {
        const saved = await d.update({
          where: { id },
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
        await audit(tx, req, entity, id, "PURGE_PERSONAL_DATA", before, saved);
        return { ok: true };
      }
      if (
        [
          "players",
          "matches",
          "news",
          "gallery",
          "staff",
          "sponsors",
          "academy",
          "teams",
          "achievements",
        ].includes(entity)
      ) {
        const data =
          entity === "players"
            ? { archivedAt: new Date() }
            : entity === "staff"
              ? { status: "ARCHIVED", archivedAt: new Date() }
              : { status: "ARCHIVED" };
        if (entity === "players") await archivePlayerMemberships(tx, req, id);
        const saved = await d.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        });
        await audit(tx, req, entity, id, "ARCHIVE", before, saved);
        if (entity === "staff") await recordStaffRevision(tx, id);
      } else throw new ConflictException({ code: "HISTORY_PROTECTED" });
      return { ok: true };
    });
  }
  @Post("media/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    return uploadImage(file, req);
  }
}

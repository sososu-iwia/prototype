import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  Body,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, playerInclude, matchInclude } from "./db";
import { requireOrigin } from "./auth";
import { secureCookie } from "./config";
import { purgeExpiredInquiries } from "./inquiry-retention";
import { inquirySchema } from "./domain";
function secret() {
  const key = process.env.INQUIRY_RATE_SECRET;
  if (!key || key.length < 32)
    throw new HttpException({ code: "INQUIRIES_UNAVAILABLE" }, 503);
  return key;
}
function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
@Controller("api/v1")
export class PremiumController {
  @Get("sponsors") async sponsors(@Query("youth") youth?: string) {
    const now = new Date();
    return {
      items: await db.sponsor.findMany({
        where: {
          status: "PUBLISHED",
          logoApproved: true,
          verifiedAt: { lte: now },
          verificationSource: { not: null },
          logo: { not: null },
          ...(youth === "true" ? { youthSafe: true } : {}),
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    };
  }
  @Get("team-pages/:category") async team(
    @Param("category") category: string,
    @Query("season") season?: string,
  ) {
    z.enum(["first-team", "first-league", "second-league"]).parse(category);
    if (season)
      z.string()
        .regex(/^[a-zA-Z0-9_-]{1,80}$/)
        .parse(season);
    const team = await db.team.findUnique({ where: { category } });
    if (
      !team ||
      team.status !== "PUBLISHED" ||
      team.verification !== "VERIFIED"
    )
      return { published: false, category };
    const seasons = await db.season.findMany({
      where: {
        OR: [
          { memberships: { some: { teamId: team.id } } },
          {
            matches: {
              some: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
            },
          },
        ],
      },
      orderBy: { id: "desc" },
      select: { id: true, name: true, current: true },
    });
    const selected =
      season || seasons.find((s) => s.current)?.id || seasons[0]?.id;
    const now = new Date();
    const current = seasons.some((s) => s.id === selected && s.current);
    const membership = {
      teamId: team.id,
      seasonId: selected,
      cancelled: false,
      datesVerified: true,
      ...(current
        ? {
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          }
        : {}),
    };
    const [players, matches, staff, news] = await Promise.all([
      selected
        ? db.player.findMany({
            where: {
              status: "PUBLISHED",
              verification: "VERIFIED",
              memberships: {
                some: membership,
              },
            },
            include: playerInclude,
          })
        : [],
      selected
        ? db.match.findMany({
            where: {
              status: "PUBLISHED",
              verification: "VERIFIED",
              seasonId: selected,
              OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
            },
            include: matchInclude,
            orderBy: { kickoff: "asc" },
          })
        : [],
      db.staffMember.findMany({
        where: {
          teamId: team.id,
          status: "PUBLISHED",
          verification: "VERIFIED",
        },
      }),
      // No team taxonomy exists on news; never label general club news as team news.
      db.newsPost.findMany({
        where: {
          status: "PUBLISHED",
          verification: "VERIFIED",
          publishedAt: { lte: new Date() },
        },
        include: { translations: true },
        orderBy: { publishedAt: "desc" },
        take: 4,
      }),
    ]);
    return {
      published: true,
      team,
      seasons,
      season: selected || null,
      players: players.map((p) => ({
        id: p.id,
        slug: p.slug,
        names: p.names,
        position: p.position,
        photo: p.photo,
        verification: p.verification,
        rosterNumber:
          p.memberships.find(
            (m) =>
              m.teamId === team.id &&
              m.seasonId === selected &&
              !m.cancelled &&
              m.datesVerified &&
              (!current ||
                (m.startsAt <= now && (!m.endsAt || m.endsAt > now))),
          )?.number ?? null,
      })),
      matches,
      staff: staff.map((s) => ({
        id: s.id,
        names: s.names,
        title: s.title,
        photo: s.photo,
      })),
      news,
      statistics: (() => {
        const played = matches.filter(
          (m) =>
            m.matchStatus === "FINISHED" &&
            m.homeScore !== null &&
            m.awayScore !== null,
        );
        return {
          played: played.length,
          won: played.filter(
            (m) =>
              (m.homeTeamId === team.id ? m.homeScore! : m.awayScore!) >
              (m.homeTeamId === team.id ? m.awayScore! : m.homeScore!),
          ).length,
          goals: played.reduce(
            (sum, m) =>
              sum + (m.homeTeamId === team.id ? m.homeScore! : m.awayScore!),
            0,
          ),
        };
      })(),
    };
  }
  @Get("academy") async academy() {
    const page = await db.academyPage.findUnique({ where: { id: "main" } });
    if (!page || page.status !== "PUBLISHED")
      return {
        published: false,
        admissionState: "UNCONFIRMED",
        inquiriesEnabled: false,
      };
    return {
      ...page,
      published: true,
      inquiriesEnabled:
        page.inquiriesEnabled &&
        !!process.env.INQUIRY_RATE_SECRET &&
        process.env.INQUIRY_RATE_SECRET.length >= 32,
    };
  }
  @Get("academy/csrf") async token(@Res({ passthrough: true }) res: Response) {
    const page = await db.academyPage.findUnique({ where: { id: "main" } });
    if (!page?.inquiriesEnabled || page.status !== "PUBLISHED")
      throw new NotFoundException({ code: "INQUIRIES_UNAVAILABLE" });
    const value = `${Date.now()}.${randomBytes(24).toString("hex")}`;
    const token = `${value}.${signature(value)}`;
    res.setHeader("Cache-Control", "no-store");
    res.cookie("academy_csrf", token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "strict",
      path: "/api/v1/academy",
      maxAge: 3600000,
    });
    return { token };
  }
  @Post("academy/inquiries") async inquiry(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireOrigin(req);
    res.setHeader("Cache-Control", "no-store");
    const token = req.header("x-csrf-token") || "",
      cookie = req.cookies?.academy_csrf;
    const [issued, nonce, sig] = token.split(".");
    const age = Date.now() - Number(issued);
    if (
      typeof cookie !== "string" ||
      cookie !== token ||
      !/^\d{13}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token) ||
      !nonce ||
      !sig ||
      !timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(signature(`${issued}.${nonce}`)),
      ) ||
      age < 2000 ||
      age > 3600000
    )
      throw new ForbiddenException({ code: "CSRF_REJECTED" });
    const data = inquirySchema.parse(body);
    const page = await db.academyPage.findUnique({ where: { id: "main" } });
    if (
      !page?.inquiriesEnabled ||
      page.status !== "PUBLISHED" ||
      !(page.content as Record<string, { kk?: string }>).privacyNotice?.kk
    )
      throw new ForbiddenException({ code: "INQUIRIES_UNAVAILABLE" });
    await purgeExpiredInquiries();
    const key = signature(`rate:${req.ip}:${Math.floor(Date.now() / 900000)}`);
    await db.$transaction(async (tx) => {
      const bucket = await tx.inquiryRateBucket.upsert({
        where: { key },
        create: { key, expiresAt: new Date(Date.now() + 1800000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 5)
        throw new HttpException({ code: "RATE_LIMITED" }, 429);
      // A signed, single-use form token also prevents duplicate submission/replay.
      const used = await tx.inquiryRateBucket.createMany({
        data: [
          {
            key: signature(`used:${token}`),
            expiresAt: new Date(Date.now() + 3600000),
          },
        ],
        skipDuplicates: true,
      });
      if (!used.count)
        throw new HttpException({ code: "ALREADY_SUBMITTED" }, 409);
      const record = await tx.academyInquiry.create({
        data: {
          guardianName: data.guardianName,
          contact: data.contact,
          ageGroup: data.ageGroup || null,
          message: data.message,
          locale: data.locale,
          consentAt: new Date(),
          privacyVersion: `academy-${page.version}`,
          expiresAt: new Date(Date.now() + 90 * 86400000),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: "public-inquiry",
          action: "CREATE",
          entity: "academy-inquiries",
          entityId: record.id,
          changes: { consent: true, privacyVersion: `academy-${page.version}` },
        },
      });
      await tx.inquiryRateBucket.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    });
    res.clearCookie("academy_csrf", {
      path: "/api/v1/academy",
      httpOnly: true,
      secure: secureCookie,
      sameSite: "strict",
    });
    return { ok: true };
  }
}

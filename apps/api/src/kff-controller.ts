import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { db } from "./db";
import { SessionGuard, requireAdmin, type AuthRequest } from "./auth";
import { mutationLock } from "./cms";
import { reviewKffRecord, reviewSchema } from "./kff-import";

@Controller("api/v1/admin")
@UseGuards(SessionGuard)
export class KffReviewController {
  @Get("kff-review") async list(
    @Query() query: Record<string, string>,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    const filter = z
      .object({
        status: z
          .enum(["PENDING", "APPROVED", "REJECTED", "DEFERRED"])
          .optional(),
        season: z.string().max(80).default("2026"),
      })
      .parse(query);
    const [items, players, teams] = await Promise.all([
      db.rosterImportRecord.findMany({
        where: {
          seasonId: filter.season,
          ...(filter.status ? { reviewStatus: filter.status } : {}),
        },
        include: {
          player: {
            select: {
              id: true,
              names: true,
              slug: true,
              position: true,
              status: true,
            },
          },
          team: { select: { id: true, names: true, category: true } },
        },
        orderBy: { shirtNumber: "asc" },
        take: 100,
      }),
      db.player.findMany({
        select: { id: true, names: true, slug: true },
        orderBy: { slug: "asc" },
        take: 500,
      }),
      db.team.findMany({
        where: { category: { in: ["first-team", "second-league"] } },
        select: { id: true, names: true, category: true },
      }),
    ]);
    return { items, players, teams };
  }
  @Put("kff-review/:id") async review(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    const input = reviewSchema.parse(body);
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      return reviewKffRecord(tx, id, input, req);
    });
  }
  @Get("staff/:id/history") async history(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    return db.staffRevision.findMany({
      where: { staffId: id },
      orderBy: { staffVersion: "desc" },
      include: {
        team: { select: { names: true } },
        season: { select: { name: true } },
      },
    });
  }
}

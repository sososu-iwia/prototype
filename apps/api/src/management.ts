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
  UseGuards,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import * as argon2 from "argon2";
import { db } from "./db";
import { AuthRequest, SessionGuard, requireAdmin } from "./auth";
import { audit, mutationLock, expectedVersion } from "./cms";
import { deleteMedia } from "./storage";
import { localized } from "./domain";
const userSelect = {
  id: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  version: true,
} as const;
const userInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]),
    active: z.boolean(),
    password: z.string().min(16).max(128).optional(),
  })
  .strict();
@Controller("api/v1/admin")
@UseGuards(SessionGuard)
export class ManagementController {
  @Get("users") async users(
    @Req() req: AuthRequest,
    @Query() query: Record<string, string>,
  ) {
    requireAdmin(req);
    const page = z.coerce.number().int().min(1).default(1).parse(query.page),
      limit = 20;
    const where = {
      email: {
        contains: z.string().max(100).default("").parse(query.q),
        mode: "insensitive" as const,
      },
    };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: userSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { email: "asc" },
      }),
      db.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  @Post("users") async create(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.save(undefined, body, req);
  }
  @Put("users/:id") async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.save(id, body, req);
  }
  private async save(id: string | undefined, body: unknown, req: AuthRequest) {
    requireAdmin(req);
    const data = userInput.parse(body);
    if (!id && !data.password)
      throw new ConflictException({ code: "PASSWORD_REQUIRED" });
    const passwordHash = data.password
      ? await argon2.hash(data.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        })
      : undefined;
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      const before = id
        ? await tx.user.findUnique({ where: { id }, select: userSelect })
        : null;
      if (id) expectedVersion(req, before);
      if (
        req.auth.role !== "SUPER_ADMIN" &&
        (data.role !== "EDITOR" || (before && before.role !== "EDITOR"))
      )
        throw new ForbiddenException({ code: "ROLE_ESCALATION" });
      if (
        before?.id === req.auth.userId &&
        (!data.active || data.role !== before.role)
      )
        throw new ConflictException({ code: "SELF_LOCKOUT" });
      if (
        before?.role === "SUPER_ADMIN" &&
        before.active &&
        (!data.active || data.role !== "SUPER_ADMIN") &&
        (await tx.user.count({
          where: { role: "SUPER_ADMIN", active: true },
        })) <= 1
      )
        throw new ConflictException({ code: "LAST_SUPER_ADMIN" });
      const { password: _password, ...safe } = data;
      const saved = id
        ? await tx.user.update({
            where: { id },
            data: { ...safe, passwordHash, version: { increment: 1 } },
            select: userSelect,
          })
        : await tx.user.create({
            data: { ...safe, passwordHash: passwordHash! },
            select: userSelect,
          });
      if (id && (!data.active || before?.role !== data.role || passwordHash))
        await tx.session.deleteMany({ where: { userId: id } });
      await audit(
        tx,
        req,
        "users",
        saved.id,
        id ? "UPDATE" : "CREATE",
        before,
        saved,
      );
      return saved;
    });
  }
  @Get("media") async media(@Query() query: Record<string, string>) {
    const page = z.coerce.number().int().min(1).default(1).parse(query.page),
      limit = 20;
    const q = z.string().max(100).default("").parse(query.q);
    const where = q
      ? {
          OR: [
            { url: { contains: q } },
            ...["kk", "ru", "en"].map((l) => ({
              alt: { path: [l], string_contains: q },
            })),
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      db.mediaAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.mediaAsset.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  @Put("media/:id") async updateMedia(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const data = z.object({ alt: localized }).strict().parse(body);
    return db.$transaction(async (tx) => {
      await mutationLock(tx);
      const before = await tx.mediaAsset.findUnique({ where: { id } });
      expectedVersion(req, before);
      const saved = await tx.mediaAsset.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
      await audit(tx, req, "media", id, "UPDATE", before, saved);
      return saved;
    });
  }
  @Delete("media/:id") async removeMedia(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    requireAdmin(req);
    return deleteMedia(id, req);
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { origins } from "./config";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export type AuthRequest = Request & {
  auth: { userId: string; role: Role; sessionId: string };
};
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.cookies?.ordabasy_session;
    if (typeof token !== "string" || token.length > 100)
      throw new UnauthorizedException({ code: "UNAUTHORIZED" });
    const session = await db.session.findUnique({
      where: { tokenHash: hash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active)
      throw new UnauthorizedException({ code: "UNAUTHORIZED" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const csrf = req.header("x-csrf-token");
      const origin = req.header("origin");
      if (
        !origin ||
        !origins.includes(origin) ||
        !csrf ||
        csrf.length > 100 ||
        !timingSafeEqual(Buffer.from(hash(csrf)), Buffer.from(session.csrfHash))
      )
        throw new ForbiddenException({ code: "CSRF_REJECTED" });
    }
    req.auth = {
      userId: session.userId,
      role: session.user.role,
      sessionId: session.id,
    };
    return true;
  }
}
export function requireAdmin(req: AuthRequest) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(req.auth.role))
    throw new ForbiddenException({ code: "ADMIN_REQUIRED" });
}
export function requireOrigin(req: Request) {
  if (!req.header("origin") || !origins.includes(req.header("origin")!))
    throw new ForbiddenException({ code: "CSRF_REJECTED" });
}

export function requireSuper(req: AuthRequest) {
  if (req.auth.role !== "SUPER_ADMIN")
    throw new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" });
}

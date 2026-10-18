import "reflect-metadata";
import {
  Module,
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ZodError, z } from "zod";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { cmsSchemas as schemas, settingsSchema } from "./domain";
import { Prisma } from "@prisma/client";
import {
  PublicController,
  AuthController,
  AdminController,
} from "./controllers";
import { ManagementController } from "./management";
import { readUpload } from "./storage";
import { SessionGuard } from "./auth";
import { validateConfig, validateStorage, origins, production } from "./config";
import { db } from "./db";
@Catch()
class ErrorFilter implements ExceptionFilter {
  async catch(error: unknown, host: ArgumentsHost) {
    const req = host
      .switchToHttp()
      .getRequest<express.Request & { auth?: { userId: string } }>();
    let fields: { path: string; message: string }[] | undefined;
    const res = host.switchToHttp().getResponse<express.Response>();
    let status = 500,
      code = "INTERNAL_ERROR";
    if (error instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      fields = error.issues
        .slice(0, 10)
        .map((issue) => ({
          path: issue.path.join("."),
          message: issue.message.slice(0, 200),
        }));
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      const r = error.getResponse();
      code =
        typeof r === "object" && "code" in r
          ? String(r.code)
          : `HTTP_${status}`;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      status = ["P2002", "P2003", "P2034", "P2004"].includes(error.code)
        ? 409
        : error.code === "P2025"
          ? 404
          : 503;
      code =
        status === 409
          ? "CONFLICT"
          : status === 404
            ? "NOT_FOUND"
            : "DATABASE_UNAVAILABLE";
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      status = 503;
      code = "DATABASE_UNAVAILABLE";
    }
    console.error(JSON.stringify({ event: "request_error", status, code }));
    if (
      ["POST", "PUT", "DELETE"].includes(req.method) &&
      status < 500 &&
      (req.auth || req.path === "/api/v1/auth/login")
    ) {
      await db.auditLog
        .create({
          data: {
            actorId: req.auth?.userId || "anonymous",
            action: "REJECTED",
            entity: req.path.split("/")[4] || "authentication",
            entityId: String(req.params.id || ""),
            result: "FAILURE",
            changes: { code },
          },
        })
        .catch(() => {});
    }
    res.status(status).json({ error: { code, ...(fields ? { fields } : {}) } });
  }
}
@Module({
  controllers: [
    PublicController,
    AuthController,
    ManagementController,
    AdminController,
  ],
  providers: [SessionGuard],
})
class AppModule {}
export async function createApp() {
  validateConfig();
  validateStorage();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn"],
  });
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const start = Date.now(),
        requestId = randomUUID();
      res.setHeader("X-Request-Id", requestId);
      res.on("finish", () =>
        console.log(
          JSON.stringify({
            event: "request",
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - start,
          }),
        ),
      );
      next();
    },
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
      "If-Match",
      "Idempotency-Key",
    ],
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  // The API is private behind Caddy in production; do not trust client-supplied forwarding headers.
  app.use(
    "/api/v1",
    rateLimit({
      windowMs: 60000,
      limit: 1000,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/v1/auth/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      skipSuccessfulRequests: true,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/v1/admin/media",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app
    .getHttpAdapter()
    .get(
      "/uploads/:name",
      async (req: express.Request, res: express.Response) => {
        try {
          const name = String(req.params.name);
          const data = await readUpload(name);
          res.setHeader(
            "Content-Type",
            name.endsWith(".avif") ? "image/avif" : "image/webp",
          );
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("Content-Security-Policy", "default-src 'none'");
          res.send(data);
        } catch {
          res.status(404).json({ error: { code: "NOT_FOUND" } });
        }
      },
    );
  app.use(
    ["/api/v1/admin", "/api/v1/auth"],
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  app.useGlobalFilters(new ErrorFilter());
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("FC Ordabasy API")
      .setVersion("1.0")
      .addCookieAuth("ordabasy_session")
      .build(),
  );
  doc.components ??= {};
  doc.components.schemas ??= {};
  for (const [name, schema] of Object.entries({
    ...schemas,
    settings: settingsSchema,
  })) {
    doc.components.schemas[name] = z.toJSONSchema(schema, {
      target: "openapi-3.0",
    }) as unknown as SchemaObject;
  }
  app
    .getHttpAdapter()
    .get(
      "/api/v1/admin-schema",
      (_req: express.Request, res: express.Response) =>
        res.json(doc.components?.schemas),
    );
  if (!production) SwaggerModule.setup("api/docs", app, doc);
  app
    .getHttpAdapter()
    .get(
      "/api/v1/openapi.json",
      (_req: express.Request, res: express.Response) => res.json(doc),
    );
  app.enableShutdownHooks();
  await app.init();
  return app;
}
if (require.main === module) {
  createApp()
    .then(async (app) => {
      await app.listen(Number(process.env.API_PORT) || 4000, "0.0.0.0");
    })
    .catch(() => {
      console.error(
        "API startup failed. Check database and environment configuration.",
      );
      process.exitCode = 1;
    });
}
process.on("beforeExit", () => {
  void db.$disconnect();
});

-- Additive only: no existing football, media, account or history data is changed.
CREATE TABLE "RateLimitWindow" ("key" TEXT PRIMARY KEY, "hits" INTEGER NOT NULL, "resetAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimitWindow_resetAt_idx" ON "RateLimitWindow"("resetAt");
CREATE TABLE "DeploymentEnvironment" ("id" TEXT PRIMARY KEY, "stage" TEXT NOT NULL CHECK ("stage" IN ('production','preview','development')));
CREATE TABLE "PendingUpload" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "key" TEXT NOT NULL UNIQUE,
 "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 10485760),
 "mime" TEXT NOT NULL, "filename" TEXT NOT NULL, "checksum" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'PENDING', "mediaId" TEXT,
 "expiresAt" TIMESTAMP(3) NOT NULL, "processingAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PendingUpload_expiresAt_idx" ON "PendingUpload"("expiresAt");

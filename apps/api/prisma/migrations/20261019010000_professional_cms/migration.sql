-- AlterEnum
ALTER TYPE "PublicationStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "MatchEvent" DROP CONSTRAINT "MatchEvent_matchId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerSeason" DROP CONSTRAINT "PlayerSeason_playerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerStatistics" DROP CONSTRAINT "PlayerStatistics_playerSeasonId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "changes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "result" TEXT NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ClubAchievement" ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "seasonId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ClubInfo" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "GalleryItem" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "cancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'Legacy import — unverified',
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "storage" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "variants" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "images" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "rosterStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PlayerSeason" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PlayerStatistics" ADD COLUMN     "cleanSheets" INTEGER,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "redCards" INTEGER,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "yellowCards" INTEGER;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "endsAt" DATE,
ADD COLUMN     "startsAt" DATE,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'PLANNED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "managed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "RosterMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "departureReason" TEXT,
    "nextClub" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RosterMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStatistics" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "appearances" INTEGER NOT NULL DEFAULT 1,
    "minutes" INTEGER NOT NULL,
    "cleanSheets" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayerMatchStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutationKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterMembership_playerId_seasonId_idx" ON "RosterMembership"("playerId", "seasonId");

-- CreateIndex
CREATE INDEX "RosterMembership_teamId_seasonId_endsAt_idx" ON "RosterMembership"("teamId", "seasonId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStatistics_matchId_playerId_key" ON "PlayerMatchStatistics"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "MutationKey_createdAt_idx" ON "MutationKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MutationKey_userId_key_key" ON "MutationKey"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_matchId_eventKey_key" ON "MatchEvent"("matchId", "eventKey");

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStatistics" ADD CONSTRAINT "PlayerStatistics_playerSeasonId_fkey" FOREIGN KEY ("playerSeasonId") REFERENCES "PlayerSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAchievement" ADD CONSTRAINT "ClubAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAchievement" ADD CONSTRAINT "ClubAchievement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStatistics" ADD CONSTRAINT "PlayerMatchStatistics_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStatistics" ADD CONSTRAINT "PlayerMatchStatistics_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing IDs and events; new IDs are generated as UUIDs by Prisma.
UPDATE "MatchEvent" SET "eventKey" = gen_random_uuid()::text WHERE "eventKey" IS NULL;
ALTER TABLE "MatchEvent" ALTER COLUMN "eventKey" SET NOT NULL;
UPDATE "Team" SET "managed" = true WHERE "slug" = 'ordabasy';
UPDATE "Season" SET "year" = "id"::integer WHERE "id" ~ '^[0-9]{4}$';
UPDATE "Season" SET "state" = CASE WHEN "current" THEN 'ACTIVE' ELSE 'COMPLETED' END;
INSERT INTO "RosterMembership" ("id","playerId","teamId","seasonId","number","startsAt","endsAt","departureReason")
SELECT gen_random_uuid()::text, ps."playerId", ps."teamId", ps."seasonId", ps."number",
  p."sourceDate", CASE WHEN s."current" THEN NULL ELSE p."sourceDate" + interval '1 day' END,
  'Legacy snapshot; exact joining/departure dates unverified'
FROM "PlayerSeason" ps JOIN "Player" p ON p.id = ps."playerId" JOIN "Season" s ON s.id = ps."seasonId";
ALTER TABLE "RosterMembership" ADD CONSTRAINT "membership_dates" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
-- Concurrency-safe interval protection, including writes made outside the API.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "RosterMembership" ADD CONSTRAINT "membership_no_overlap"
EXCLUDE USING gist ("playerId" WITH =, "teamId" WITH =, tsrange("startsAt","endsAt",'[)') WITH &&);
CREATE UNIQUE INDEX "one_current_season" ON "Season" ("current") WHERE "current" = true;
ALTER TABLE "PlayerMatchStatistics" ADD CONSTRAINT "match_statistics_ranges" CHECK ("minutes" BETWEEN 0 AND 150 AND "appearances" BETWEEN 0 AND 1 AND ("cleanSheets" IS NULL OR "cleanSheets" BETWEEN 0 AND 1));

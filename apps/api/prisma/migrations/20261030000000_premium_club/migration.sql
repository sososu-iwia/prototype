-- Additive migration: retain existing rows and all roster/history constraints.
ALTER TABLE "Team" ADD COLUMN "category" TEXT, ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT', ADD COLUMN "verification" "Verification" NOT NULL DEFAULT 'LEGACY_UNVERIFIED', ADD COLUMN "overview" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "source" TEXT NOT NULL DEFAULT 'Pending club approval';
CREATE UNIQUE INDEX "Team_category_key" ON "Team"("category");
ALTER TABLE "StaffMember" ADD COLUMN "teamId" TEXT REFERENCES "Team"("id") ON DELETE RESTRICT;
ALTER TABLE "ClubAchievement" ADD COLUMN "clubKey" TEXT NOT NULL DEFAULT 'ordabasy', ADD COLUMN "competitionKey" TEXT, ADD COLUMN "achievementType" TEXT NOT NULL DEFAULT 'MILESTONE', ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';
-- Nullable competitionKey keeps unclassified historical records intact, including duplicates.
CREATE UNIQUE INDEX "ClubAchievement_club_competition_year_key" ON "ClubAchievement"("clubKey","competitionKey","year") WHERE "playerId" IS NULL AND "competitionKey" IS NOT NULL;
ALTER TABLE "ClubAchievement" ADD CONSTRAINT "achievement_sporting_identity" CHECK ("achievementType" IN ('LEAGUE','CUP','SUPERCUP','MILESTONE') AND ("achievementType" = 'MILESTONE' OR ("competitionKey" IS NOT NULL AND "year" IS NOT NULL)));
CREATE TABLE "Sponsor" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "logo" TEXT, "description" JSONB NOT NULL DEFAULT '{}', "websiteUrl" TEXT, "tier" TEXT, "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT', "sortOrder" INTEGER NOT NULL DEFAULT 0, "validFrom" TIMESTAMP(3), "validUntil" TIMESTAMP(3), "verificationSource" TEXT, "verifiedAt" TIMESTAMP(3), "logoApproved" BOOLEAN NOT NULL DEFAULT false, "youthSafe" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "sponsor_validity" CHECK ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil" > "validFrom"),
 CONSTRAINT "sponsor_publication" CHECK ("status" <> 'PUBLISHED' OR ("logo" IS NOT NULL AND "logoApproved" AND "verifiedAt" IS NOT NULL AND "verificationSource" IS NOT NULL))
);
CREATE TABLE "AcademyPage" ("id" TEXT PRIMARY KEY DEFAULT 'main', "content" JSONB NOT NULL DEFAULT '{}', "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT', "admissionState" TEXT NOT NULL DEFAULT 'UNCONFIRMED', "inquiriesEnabled" BOOLEAN NOT NULL DEFAULT false, "contactEmail" TEXT, "contactPhone" TEXT, "source" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "AcademyInquiry" ("id" TEXT PRIMARY KEY, "guardianName" TEXT, "contact" TEXT, "ageGroup" TEXT, "message" TEXT, "locale" TEXT NOT NULL, "consentAt" TIMESTAMP(3) NOT NULL, "privacyVersion" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'NEW', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "purgedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1);
CREATE INDEX "AcademyInquiry_expiresAt_purgedAt_idx" ON "AcademyInquiry"("expiresAt","purgedAt");
CREATE TABLE "InquiryRateBucket" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "InquiryRateBucket_expiresAt_idx" ON "InquiryRateBucket"("expiresAt");

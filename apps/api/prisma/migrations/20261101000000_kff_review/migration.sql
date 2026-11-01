-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "aliases" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "aliases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "externalKey" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "roleCode" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "sourceCapturedAt" TIMESTAMP(3),
ADD COLUMN     "sourceSeasonId" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "StaffRevision" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffVersion" INTEGER NOT NULL,
    "teamId" TEXT,
    "seasonId" TEXT,
    "title" JSONB NOT NULL,
    "roleCode" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportRecord" (
    "id" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "profileExternalId" TEXT,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT,
    "teamId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "profileUrl" TEXT,
    "sourceCapturedAt" TIMESTAMP(3) NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourcePosition" TEXT NOT NULL,
    "sourceNationality" TEXT,
    "shirtNumber" INTEGER NOT NULL,
    "profileTeam" TEXT,
    "profilePosition" TEXT,
    "position" TEXT,
    "positionSource" TEXT,
    "evidence" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "proposedAliases" JSONB NOT NULL DEFAULT '[]',
    "matchKind" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RosterImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRevision_staffId_staffVersion_key" ON "StaffRevision"("staffId", "staffVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RosterImportRecord_referenceKey_key" ON "RosterImportRecord"("referenceKey");

-- CreateIndex
CREATE INDEX "RosterImportRecord_seasonId_teamId_reviewStatus_idx" ON "RosterImportRecord"("seasonId", "teamId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RosterImportRecord_seasonId_profileExternalId_key" ON "RosterImportRecord"("seasonId", "profileExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_externalKey_key" ON "StaffMember"("externalKey");

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_sourceSeasonId_fkey" FOREIGN KEY ("sourceSeasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRevision" ADD CONSTRAINT "StaffRevision_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRevision" ADD CONSTRAINT "StaffRevision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRevision" ADD CONSTRAINT "StaffRevision_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRecord" ADD CONSTRAINT "RosterImportRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRecord" ADD CONSTRAINT "RosterImportRecord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRecord" ADD CONSTRAINT "RosterImportRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "RosterMembership" ADD COLUMN "datesVerified" BOOLEAN NOT NULL DEFAULT true;
UPDATE "RosterMembership" SET "datesVerified" = false WHERE "departureReason" LIKE 'Legacy snapshot;%';

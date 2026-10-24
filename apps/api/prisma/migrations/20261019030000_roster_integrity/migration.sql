ALTER TABLE "RosterMembership" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerMatchStatistics" ADD COLUMN "teamId" TEXT;
ALTER TABLE "PlayerMatchStatistics" ADD CONSTRAINT "PlayerMatchStatistics_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "PlayerMatchStatistics" s SET "teamId"=(
  SELECT min(r."teamId") FROM "RosterMembership" r JOIN "Match" m ON m.id=s."matchId"
  WHERE r."playerId"=s."playerId" AND r."seasonId"=m."seasonId"
    AND r."teamId" IN(m."homeTeamId",m."awayTeamId") AND r."startsAt"<=m.kickoff
    AND (r."endsAt" IS NULL OR r."endsAt">m.kickoff)
  HAVING count(DISTINCT r."teamId")=1
);
ALTER TABLE "RosterMembership" DROP CONSTRAINT "membership_no_overlap";
ALTER TABLE "RosterMembership" ADD CONSTRAINT "membership_no_overlap"
EXCLUDE USING gist ("playerId" WITH =,"teamId" WITH =,tsrange("startsAt","endsAt",'[)') WITH &&) WHERE (NOT cancelled);
-- NOT VALID preserves any imported historical anomaly while enforcing valid new writes.
ALTER TABLE "PlayerMatchStatistics" ADD CONSTRAINT "appearance_minutes_consistency"
CHECK ((appearances=1 OR minutes=0) AND ("cleanSheets" IS DISTINCT FROM 1 OR (appearances=1 AND minutes>0))) NOT VALID;

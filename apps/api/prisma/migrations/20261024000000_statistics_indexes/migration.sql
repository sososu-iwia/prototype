-- Additive indexes for season-wide batched statistics. Existing records are preserved.
CREATE INDEX "Match_seasonId_matchStatus_status_idx" ON "Match"("seasonId", "matchStatus", "status");
CREATE INDEX "PlayerMatchStatistics_playerId_teamId_idx" ON "PlayerMatchStatistics"("playerId", "teamId");

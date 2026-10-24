import test from "node:test";
import assert from "node:assert/strict";
import type { Match, Team } from "../apps/web/lib/api/types";
import { nextClubMatch } from "../apps/web/features/matches/select-next";

test("next match ignores foreign, past and unverified fixtures and preserves home/away data", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  const club: Team = {
    id: "club",
    slug: "ordabasy",
    names: { kk: "Fixture club" },
    managed: true,
  };
  const first: Team = {
    id: "first",
    slug: "fixture-first",
    names: { kk: "Fixture first" },
    managed: false,
  };
  const second: Team = {
    id: "second",
    slug: "fixture-second",
    names: { kk: "Fixture second" },
    managed: false,
  };
  const match = (
    id: string,
    days: number,
    homeTeam: Team,
    awayTeam: Team,
    verification = "VERIFIED",
  ): Match => ({
    id,
    homeTeam,
    awayTeam,
    verification,
    kickoff: new Date(now.getTime() + days * 86400000).toISOString(),
    competition: { id: "fixture", names: { kk: "Unit fixture" } },
    seasonId: "fixture",
    stadium: { kk: "" },
    matchStatus: "SCHEDULED",
    homeScore: null,
    awayScore: null,
    source: "Unit fixture",
  });
  const foreign = match("foreign", 1, first, second);
  const unverified = match("unverified", 1, club, first, "LEGACY_UNVERIFIED");
  const past = match("past", -1, club, first);
  const away = match("club-away", 2, first, club);
  const fixtures = [
    match("club-home", 4, club, first),
    foreign,
    unverified,
    past,
    away,
  ];
  const originalOrder = fixtures.map((fixture) => fixture.id);
  assert.equal(nextClubMatch(fixtures, now), away);
  assert.equal(nextClubMatch([foreign, unverified, past], now), undefined);
  assert.deepEqual(
    fixtures.map((fixture) => fixture.id),
    originalOrder,
  );
  assert.equal(away.homeTeam.id, first.id);
  assert.equal(away.awayTeam.id, club.id);
});

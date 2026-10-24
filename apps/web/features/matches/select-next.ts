import type { Match, Team } from "../../lib/api/types";

export const isClubTeam = (team: Team) =>
  team.managed === true || team.slug === "ordabasy";

export function nextClubMatch(
  matches: Match[],
  now = new Date(),
): Match | undefined {
  return matches
    .filter(
      (match) =>
        (isClubTeam(match.homeTeam) || isClubTeam(match.awayTeam)) &&
        match.matchStatus === "SCHEDULED" &&
        match.verification === "VERIFIED" &&
        new Date(match.kickoff) > now,
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
}

import type { Match } from "../../lib/api/types";
import { date, localized, type Locale } from "../../lib/i18n/config";
import { getTranslations } from "next-intl/server";
import { Archive } from "../../components/ui/State";
export async function MatchCard({
  match,
  locale,
  timeZone = "Asia/Almaty",
}: {
  match: Match;
  locale: Locale;
  timeZone?: string;
}) {
  const u = await getTranslations("ui");
  const state = {
    SCHEDULED: "scheduled",
    LIVE: "LIVE",
    FINISHED: "finished",
    POSTPONED: "postponed",
    CANCELLED: "cancelled",
  } as const;
  return (
    <article className="fixture-card">
      <div className="fixture-top">
        <span
          className={`match-status ${match.matchStatus === "FINISHED" ? "finished" : "upcoming"}`}
        >
          {u(state[match.matchStatus])}
        </span>
        <time dateTime={match.kickoff}>
          {date(match.kickoff, locale, timeZone, true)}
        </time>
      </div>
      <p className="fixture-competition">
        {localized(match.competition.names, locale)}
      </p>
      <div className="fixture-teams">
        <div>
          <span className="mini-logo">
            {localized(match.homeTeam.names, locale).slice(0, 1)}
          </span>
          <span>{localized(match.homeTeam.names, locale)}</span>
        </div>
        <strong>
          {match.matchStatus === "FINISHED"
            ? `${match.homeScore} : ${match.awayScore}`
            : "VS"}
        </strong>
        <div>
          <span className="mini-logo opponent-mini">
            {localized(match.awayTeam.names, locale).slice(0, 1)}
          </span>
          <span>{localized(match.awayTeam.names, locale)}</span>
        </div>
      </div>
      <p className="fixture-stadium">
        {match.homeTeam.slug === "ordabasy" ? u("home") : u("away")}
        {localized(match.stadium, locale)
          ? ` · ${localized(match.stadium, locale)}`
          : ""}
      </p>
      <Archive verification={match.verification} />
    </article>
  );
}

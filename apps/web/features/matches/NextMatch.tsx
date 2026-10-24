import type { Match, Team } from "../../lib/api/types";
import { date, localized, type Locale } from "../../lib/i18n/config";
import { getTranslations } from "next-intl/server";
import { Media } from "../../components/ui/Media";
import { isClubTeam, nextClubMatch } from "./select-next";
export async function NextMatch({
  matches,
  locale,
  timeZone = "Asia/Almaty",
  featured = false,
}: {
  matches: Match[];
  locale: Locale;
  timeZone?: string;
  featured?: boolean;
}) {
  const t = await getTranslations("site"),
    u = await getTranslations("ui");
  const next = nextClubMatch(matches);
  const opponent = next
    ? isClubTeam(next.homeTeam)
      ? next.awayTeam
      : next.homeTeam
    : null;
  if (featured) {
    const m = await getTranslations("match");
    function team(team: Team | undefined, clubFallback = false) {
      const name = team
        ? localized(team.names, locale)
        : t(clubFallback ? "ordabasy" : "opponent");
      return (
        <div className="featured-club">
          {(team ? isClubTeam(team) : clubFallback) ? (
            <Media
              src="/media/logo-320.webp"
              alt={name}
              sizes="(max-width:650px) 80px, 105px"
            />
          ) : (
            <div className="opponent-logo" aria-hidden="true">
              {team ? name.slice(0, 1) : "?"}
            </div>
          )}
          <h3>{name}</h3>
        </div>
      );
    }
    return (
      <div className="featured-match-card">
        <div className="featured-match-top">
          <span>{next ? localized(next.competition.names, locale) : "—"}</span>
          <span className="featured-match-status">
            {next ? m("upcoming") : "—"}
          </span>
        </div>
        <div className="featured-match-main">
          {team(next?.homeTeam, true)}
          <div className="featured-match-center">
            <p>
              {next
                ? new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "short",
                    timeZone,
                  }).format(new Date(next.kickoff))
                : "—"}
            </p>
            <strong>
              {next
                ? new Intl.DateTimeFormat(locale, {
                    timeStyle: "short",
                    timeZone,
                  }).format(new Date(next.kickoff))
                : "—"}
            </strong>
            <span>VS</span>
          </div>
          {team(next?.awayTeam)}
        </div>
        <div className="featured-match-bottom">
          <div>
            <span>{m("matchType")}</span>
            <strong>
              {next ? m(isClubTeam(next.homeTeam) ? "home" : "away") : "—"}
            </strong>
          </div>
          <div>
            <span>{m("matchDate")}</span>
            <strong>{next ? date(next.kickoff, locale, timeZone) : "—"}</strong>
          </div>
        </div>
        {!next && <p className="featured-match-empty">{u("noNext")}</p>}
      </div>
    );
  }
  return (
    <div className="match-card">
      <p className="match-title">{t("nextMatch")}</p>
      <div className="teams">
        <div className="team">
          <div className="team-logo">О</div>
          <p className="team-name">{t("ordabasy")}</p>
        </div>
        <div className="match-info">
          <span className="match-date">
            {next ? date(next.kickoff, locale, timeZone) : "—"}
          </span>
          <strong>VS</strong>
          <span className="match-time">
            {next
              ? new Intl.DateTimeFormat(locale, {
                  timeStyle: "short",
                  timeZone,
                }).format(new Date(next.kickoff))
              : "—"}
          </span>
        </div>
        <div className="team">
          <div className="team-logo opponent">
            {opponent ? localized(opponent.names, locale).slice(0, 1) : "?"}
          </div>
          <p className="team-name">
            {opponent ? localized(opponent.names, locale) : t("opponent")}
          </p>
        </div>
      </div>
      <p className="stadium">
        {next ? localized(next.stadium, locale) : u("noNext")}
      </p>
    </div>
  );
}

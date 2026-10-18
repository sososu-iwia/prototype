import type { Match } from "../../lib/api/types";
import { date, localized, type Locale } from "../../lib/i18n/config";
import { getTranslations } from "next-intl/server";
export async function NextMatch({
  matches,
  locale,
  timeZone = "Asia/Almaty",
}: {
  matches: Match[];
  locale: Locale;
  timeZone?: string;
}) {
  const t = await getTranslations("site"),
    u = await getTranslations("ui");
  const next = matches
    .filter(
      (m) =>
        m.matchStatus === "SCHEDULED" &&
        m.verification === "VERIFIED" &&
        new Date(m.kickoff) > new Date(),
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
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
            {next
              ? localized(
                  (next.homeTeam.slug === "ordabasy"
                    ? next.awayTeam
                    : next.homeTeam
                  ).names,
                  locale,
                ).slice(0, 1)
              : "?"}
          </div>
          <p className="team-name">
            {next
              ? localized(
                  (next.homeTeam.slug === "ordabasy"
                    ? next.awayTeam
                    : next.homeTeam
                  ).names,
                  locale,
                )
              : t("opponent")}
          </p>
        </div>
      </div>
      <p className="stadium">
        {next ? localized(next.stadium, locale) : u("noNext")}
      </p>
    </div>
  );
}

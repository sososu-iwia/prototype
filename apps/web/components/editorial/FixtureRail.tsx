import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Match } from "../../lib/api/types";
import { date, localized, type Locale } from "../../lib/i18n/config";
import { nextClubMatch } from "../../features/matches/select-next";
import { Icon } from "./Icon";
export async function FixtureRail({
  matches,
  locale,
  timeZone,
}: {
  matches: Match[];
  locale: Locale;
  timeZone: string;
}) {
  const p = await getTranslations("premium"),
    next = nextClubMatch(matches);
  return (
    <section className="fixture-rail" aria-label={p("nextFixture")}>
      <div className="container fixture-inner">
        <div className="fixture-label">
          <Icon name="calendar" />
          <span>{p("nextFixture")}</span>
        </div>
        <img
          src="/media/logo-header-96.webp"
          alt="FC Ordabasy"
          width="40"
          height="44"
        />
        <div className="fixture-copy">
          {next ? (
            <>
              <span>
                {localized(next.competition.names, locale)} ·{" "}
                {date(next.kickoff, locale, timeZone, true)}
              </span>
              <strong>
                {localized(next.homeTeam.names, locale)} <span>vs</span>{" "}
                {localized(next.awayTeam.names, locale)}
              </strong>
              <span>{localized(next.stadium, locale)}</span>
            </>
          ) : (
            <>
              <strong>FC ORDABASY</strong>
              <p>{p("noFixture")}</p>
            </>
          )}
        </div>
        <Link href={`/${locale}/matches`} prefetch={false}>
          {p("viewMatches")}
          <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}

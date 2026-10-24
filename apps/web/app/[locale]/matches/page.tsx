import { HeroPreload } from "../../../components/ui/HeroPreload";
import { getTranslations } from "next-intl/server";
import {
  getMatches,
  getStandings,
  getSeasons,
  getCompetitions,
  getClub,
} from "../../../lib/api/server";
import { localized, type Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { NextMatch } from "../../../features/matches/NextMatch";
import { MatchCard } from "../../../features/matches/MatchCard";
import { StandingsTable } from "../../../features/standings/Table";
import { Offline, Empty } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "/matches", t("matches"), t("matchesTitle"));
}
export default async function Matches({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params,
    q = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["status", "season", "competition", "venue"])
    if (q[key]) query.set(key, q[key]);
  const [matches, standings, seasons, competitions, club] = await Promise.all([
    getMatches(query.toString()),
    getStandings(),
    getSeasons(),
    getCompetitions(),
    getClub(),
  ]);
  const t = await getTranslations("match"),
    u = await getTranslations("ui");
  return (
    <main id="content">
      <HeroPreload />
      <section className="matches-page-hero">
        <div className="container">
          <div className="matches-page-hero-content">
            <p className="hero-label">{t("heroLabel")}</p>
            <h1>
              <span>{t("heroFirst")}</span>
              <span>{t("heroSecond")}</span>
            </h1>
            <p className="matches-hero-description">{t("heroDescription")}</p>
          </div>
        </div>
      </section>
      <section
        className="featured-match-section"
        aria-labelledby="next-match-title"
      >
        <div className="container">
          <h2 className="section-label" id="next-match-title">
            {t("nextMatch")}
          </h2>
          <NextMatch
            matches={matches.data.items}
            locale={locale}
            timeZone={club.data.timezone}
            featured
          />
        </div>
      </section>
      <section className="section-pad">
        <div className="container">
          <Offline show={matches.offline || standings.offline} />
          <div className="section-heading">
            <div>
              <p className="section-label">{t("scheduleLabel")}</p>
              <h2>{t("scheduleTitle")}</h2>
            </div>
          </div>
          <form className="filter-form">
            <label>
              {u("status")}
              <select name="status" defaultValue={q.status || ""}>
                <option value="">{u("all")}</option>
                <option value="SCHEDULED">{u("scheduled")}</option>
                <option value="FINISHED">{u("finished")}</option>
                <option value="POSTPONED">{u("postponed")}</option>
                <option value="CANCELLED">{u("cancelled")}</option>
              </select>
            </label>
            <label>
              {u("season")}
              <select name="season" defaultValue={q.season || ""}>
                <option value="">{u("all")}</option>
                {seasons.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {u("competition")}
              <select name="competition" defaultValue={q.competition || ""}>
                <option value="">{u("all")}</option>
                {competitions.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localized(c.names, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {u("home")} / {u("away")}
              <select name="venue" defaultValue={q.venue || ""}>
                <option value="">{u("all")}</option>
                <option value="home">{u("home")}</option>
                <option value="away">{u("away")}</option>
              </select>
            </label>
            <button className="btn btn-primary">{u("search")}</button>
          </form>
          <div className="fixtures-grid">
            {matches.data.items.map((match) => (
              <MatchCard
                match={match}
                locale={locale}
                key={match.id}
                timeZone={club.data.timezone}
              />
            ))}
          </div>
          {!matches.data.items.length && <Empty />}
        </div>
      </section>
      <section className="section-pad standings-section">
        <div className="container">
          <StandingsTable
            data={standings.data}
            locale={locale}
            timeZone={club.data.timezone}
          />
        </div>
      </section>
    </main>
  );
}

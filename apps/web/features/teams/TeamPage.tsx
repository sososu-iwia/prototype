import { getTranslations } from "next-intl/server";
import { getTeamPage } from "../../lib/api/server";
import { localized, type Locale } from "../../lib/i18n/config";
import { SectionTitle } from "../../components/editorial/SectionTitle";
import { TeamSelector } from "./TeamSelector";
import { Squad } from "../players/Squad";
import { MatchCard } from "../matches/MatchCard";
import { NewsGrid } from "../news/NewsGrid";
import { Media } from "../../components/ui/Media";
import { Offline } from "../../components/ui/State";
import { PortraitPlaceholder } from "../../components/editorial/PortraitPlaceholder";
export async function TeamPage({
  locale,
  category,
  season,
}: {
  locale: Locale;
  category: "first-team" | "first-league" | "second-league";
  season?: string;
}) {
  const { data, offline } = await getTeamPage(category, season),
    p = await getTranslations("premium"),
    k = await getTranslations("kff"),
    s = await getTranslations("ui");
  const key =
    category === "first-team"
      ? "firstTeam"
      : category === "first-league"
        ? "firstLeague"
        : "secondLeague";
  return (
    <main id="content" className="premium">
      <section className="team-page-hero">
        <Media src="/media/gallery2-960.webp" alt="" priority sizes="100vw" />
        <div className="container">
          <p className="eyebrow">FC ORDABASY · {p("photoArchive")}</p>
          <h1>{p(key)}</h1>
          <p>
            {data.published
              ? localized(data.team?.overview, locale)
              : p("pending")}
          </p>
        </div>
      </section>
      <div className="container">
        <Offline show={offline} />
      </div>
      {!data.published ? (
        <section className="editorial-section">
          <div className="container">
            <div className="editorial-empty">
              <p className="eyebrow">{p("pending")}</p>
              <h2>{p(key)}</h2>
              <p>{p("pendingTeam")}</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="team-subnav">
            <div className="container">
              <a href="#squad">{p("viewSquad")}</a>
              <a href="#fixtures">{p("teamFixtures")}</a>
              <a href="#coaches">{p("coaches")}</a>
              <a href="#statistics">{p("teamStats")}</a>
            </div>
          </div>
          <section className="editorial-section" id="squad">
            <div className="container">
              <SectionTitle label="FC ORDABASY" title={p("viewSquad")} />
              <nav className="kff-views" aria-label={k("season")}>
                <a
                  href={`/${locale}/teams/${category}#squad`}
                  aria-current={data.view === "current" ? "page" : undefined}
                >
                  {k("current")}
                </a>
                {data.seasons?.map((s) => (
                  <a
                    key={s.id}
                    href={`?season=${encodeURIComponent(s.id)}#squad`}
                    aria-current={
                      data.view === "season" && data.season === s.id
                        ? "page"
                        : undefined
                    }
                  >
                    {k("season")} {s.name}
                  </a>
                ))}
              </nav>
              {data.view === "season" && (
                <p className="source-notice">{k("seasonNotice")}</p>
              )}
              {!!data.seasons?.length && (
                <form className="filter-form">
                  <label>
                    {p("season")}
                    <select name="season" defaultValue={data.season || ""}>
                      {data.seasons.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="editorial-button">{p("discover")}</button>
                </form>
              )}
              {data.players?.length ? (
                <Squad players={data.players} />
              ) : (
                <div className="editorial-empty">
                  <p>{p("teamEmpty")}</p>
                </div>
              )}
            </div>
          </section>
          <section className="editorial-section editorial-news" id="fixtures">
            <div className="container">
              <SectionTitle
                label={data.season || "FC ORDABASY"}
                title={p("teamFixtures")}
              />
              {data.matches?.length ? (
                <div className="fixtures-grid">
                  {data.matches.map((m) => (
                    <MatchCard key={m.id} match={m} locale={locale} />
                  ))}
                </div>
              ) : (
                <div className="editorial-empty">
                  <p>{p("noFixture")}</p>
                </div>
              )}
            </div>
          </section>
          <section className="editorial-section" id="coaches">
            <div className="container">
              <SectionTitle label="FC ORDABASY" title={p("teamStaff")} />
              {data.staff?.length ? (
                <div className="staff-grid">
                  {data.staff.map((s) => (
                    <article
                      key={s.id}
                      className="coach-card"
                      data-role={s.roleCode}
                    >
                      <div className="coach-portrait">
                        {s.photo ? (
                          <Media
                            src={s.photo}
                            alt={localized(s.names, locale)}
                          />
                        ) : (
                          <PortraitPlaceholder label={k("photoPending")} />
                        )}
                      </div>
                      <div className="coach-content">
                        <p className="eyebrow">{localized(s.title, locale)}</p>
                        <h3>{localized(s.names, locale)}</h3>
                        {s.nationality && <p>{s.nationality}</p>}
                        {s.sourceUrl && (
                          <a
                            href={s.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {k("source")}
                          </a>
                        )}
                        {s.sourceSeasonId && s.sourceCapturedAt && (
                          <p className="source-notice">
                            {k("staffNotice", {
                              season: s.sourceSeasonId,
                              date: new Intl.DateTimeFormat(
                                locale === "en"
                                  ? "en-GB"
                                  : locale === "kk"
                                    ? "kk-KZ"
                                    : "ru-RU",
                                { timeZone: "Asia/Almaty" },
                              ).format(new Date(s.sourceCapturedAt)),
                            })}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>{p("noApprovedContent")}</p>
              )}
            </div>
          </section>
          <section className="editorial-section editorial-news" id="statistics">
            <div className="container">
              <SectionTitle
                label={data.season || "FC ORDABASY"}
                title={p("teamStats")}
              />
              {data.statistics?.played ? (
                <div className="team-statistics">
                  <div>
                    <strong>{data.statistics.played}</strong>
                    <span>{p("teamFixtures")}</span>
                  </div>
                  <div>
                    <strong>{data.statistics.won}</strong>
                    <span>{s("wins")}</span>
                  </div>
                  <div>
                    <strong>{data.statistics.goals}</strong>
                    <span>{s("goals")}</span>
                  </div>
                </div>
              ) : (
                <p>{p("teamStatsEmpty")}</p>
              )}
            </div>
          </section>
          {!!data.news?.length && (
            <section className="editorial-section">
              <div className="container">
                <SectionTitle label="FC ORDABASY" title={p("clubNews")} />
                <NewsGrid posts={data.news} locale={locale} />
              </div>
            </section>
          )}
        </>
      )}
      <section className="editorial-section">
        <div className="container">
          <SectionTitle label={p("teamIntro")} title={p("ourTeams")} />
          <TeamSelector locale={locale} />
        </div>
      </section>
    </main>
  );
}

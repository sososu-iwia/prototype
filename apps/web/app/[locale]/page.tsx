import { getTranslations } from "next-intl/server";
import {
  getPlayers,
  getMatches,
  getNews,
  getGallery,
  getClub,
  getSponsors,
} from "../../lib/api/server";
import type { Locale } from "../../lib/i18n/config";
import { metadata } from "../../lib/metadata";
import { EditorialHero } from "../../components/editorial/EditorialHero";
import { SectionTitle } from "../../components/editorial/SectionTitle";
import { FixtureRail } from "../../components/editorial/FixtureRail";
import { TeamSelector } from "../../features/teams/TeamSelector";
import { AcademyPromo } from "../../features/academy/AcademyPromo";
import { Achievements } from "../../features/club/Achievements";
import { SponsorGrid } from "../../features/sponsors/SponsorGrid";
import { PlayerCard } from "../../features/players/PlayerCard";
import { NewsGrid } from "../../features/news/NewsGrid";
import { Gallery } from "../../features/gallery/Gallery";
import { Offline } from "../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "", t("title"), t("description"));
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [players, matches, news, gallery, club, sponsors] = await Promise.all([
    getPlayers(),
    getMatches(),
    getNews(),
    getGallery(),
    getClub(),
    getSponsors(),
  ]);
  const p = await getTranslations("premium"),
    s = await getTranslations("site"),
    u = await getTranslations("ui");
  const enabled = (key: string) => club.data.sections.includes(key);
  const cards = players.data.items
    .filter((p) => p.verification === "VERIFIED")
    .slice(0, 4);
  return (
    <main id="content" className="premium">
      {enabled("hero") && (
        <EditorialHero
          locale={locale}
          champion={club.data.achievements.some(
            (a) =>
              a.year === 2026 &&
              a.status === "PUBLISHED" &&
              a.verification === "VERIFIED",
          )}
        />
      )}
      {enabled("matches") && (
        <FixtureRail
          matches={matches.data.items}
          locale={locale}
          timeZone={club.data.timezone}
        />
      )}
      <div className="container">
        <Offline show={club.offline || news.offline || matches.offline} />
      </div>
      {enabled("news") && (
        <section className="editorial-section editorial-news">
          <div className="container">
            <SectionTitle
              label="ORDABASY TODAY"
              title={p("latest")}
              href={`/${locale}/news`}
              action={p("allNews")}
            />
            <NewsGrid
              posts={news.data.items.slice(0, 5)}
              locale={locale}
              timeZone={club.data.timezone}
            />
          </div>
        </section>
      )}
      <section className="editorial-section">
        <div className="container">
          <SectionTitle label={p("teamIntro")} title={p("ourTeams")} />
          <TeamSelector locale={locale} />
        </div>
      </section>
      {enabled("achievements") && (
        <Achievements items={club.data.achievements} locale={locale} />
      )}
      <AcademyPromo locale={locale} />
      {enabled("team") && (
        <section className="editorial-section">
          <div className="container">
            <SectionTitle
              label="FC ORDABASY"
              title={p("featuredPlayers")}
              href={`/${locale}/players`}
              action={p("allPlayers")}
            />
            {cards.length ? (
              <div className="players-grid">
                {cards.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    locale={locale}
                    positionLabel={s(player.position)}
                    compact
                  />
                ))}
              </div>
            ) : (
              <div className="editorial-empty">
                <span>01 — {p("firstTeam")}</span>
                <p>{p("teamEmpty")}</p>
                <p>{u("archive")}</p>
              </div>
            )}
          </div>
        </section>
      )}
      {enabled("gallery") && (
        <section className="editorial-section editorial-media" id="gallery">
          <div className="container">
            <SectionTitle
              label={p("galleryLabel")}
              title={p("galleryTitle")}
              href={`/${locale}/gallery`}
              action={s("gallery")}
            />
            <Gallery items={gallery.data.items.slice(0, 4)} />
          </div>
        </section>
      )}
      <SponsorGrid items={sponsors.data.items} />
    </main>
  );
}

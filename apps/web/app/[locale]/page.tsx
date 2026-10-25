import { Suspense } from "react";
import Loading from "../../components/ui/Loading";
import { ScrollEffects } from "../../components/layout/ScrollEffects";
import { HeroPreload } from "../../components/ui/HeroPreload";
import Link from "next/link";
import { Achievements } from "../../features/club/Achievements";
import { getTranslations } from "next-intl/server";
import {
  getPlayers,
  getMatches,
  getNews,
  getGallery,
  getClub,
} from "../../lib/api/server";
import { localized, type Locale, type SiteKey } from "../../lib/i18n/config";
import { metadata } from "../../lib/metadata";
import { NextMatch } from "../../features/matches/NextMatch";
import { MatchCard } from "../../features/matches/MatchCard";
import { PlayerCard } from "../../features/players/PlayerCard";
import { NewsGrid } from "../../features/news/NewsGrid";
import { Gallery } from "../../features/gallery/Gallery";
import {
  ClubNumbers,
  HomeAbout,
  ContactSection,
} from "../../components/club/PreservedSections";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Empty, Offline } from "../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "", t("title"), t("description"));
}
export default function Home(props: Parameters<typeof HomeContent>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent {...props} />
    </Suspense>
  );
}
async function HomeContent({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [players, matches, news, gallery, club] = await Promise.all([
    getPlayers(),
    getMatches(),
    getNews(),
    getGallery(),
    getClub(),
  ]);
  const s = await getTranslations("site"),
    u = await getTranslations("ui");
  const content = club.data.info.find((i) => i.id === "main")?.content;
  const t = (key: SiteKey) => localized(content?.[key], locale) || s(key);
  const props = { locale, t };
  const enabled = (section: string) => club.data.sections.includes(section);
  const featured = [
    "bekhan-shaizada",
    "sergey-maly",
    "david-abagna",
    "everton-moraes",
  ]
    .map((slug) => players.data.items.find((p) => p.slug === slug))
    .filter((p) => p != null);
  const cards = featured.length ? featured : players.data.items.slice(0, 4);
  return (
    <main id="content">
      <HeroPreload priority="low" />
      {enabled("hero") && (
        <section className="hero">
          <div className="container hero-container">
            <div className="hero-content">
              <p className="hero-label">{t("location")}</p>
              <h1>
                <span className="hero-first">{t("heroFirst")}</span>
                <span className="hero-second">{t("heroSecond")}</span>
              </h1>
              <p className="hero-description">{t("description")}</p>
              <div className="hero-buttons">
                <Link
                  prefetch={false}
                  href={`/${locale}/about`}
                  className="btn btn-primary"
                >
                  {t("aboutButton")}
                </Link>
                <Link
                  prefetch={false}
                  href={`/${locale}/matches`}
                  className="btn btn-secondary"
                >
                  {t("matchesButton")}
                </Link>
              </div>
            </div>
            <NextMatch
              matches={matches.data.items}
              locale={locale}
              timeZone={club.data.timezone}
            />
          </div>
        </section>
      )}
      {enabled("club-stats") && <ClubNumbers {...props} />}
      <div className="container">
        <Offline
          show={
            players.offline ||
            matches.offline ||
            news.offline ||
            gallery.offline ||
            club.offline
          }
        />
        {club.data.info.some((i) => i.verification === "LEGACY_UNVERIFIED") && (
          <p className="archive-badge">{u("archivedContent")}</p>
        )}
      </div>
      {enabled("about") && <HomeAbout {...props} />}
      {enabled("matches") && (
        <section className="matches-section">
          <div className="container">
            <SectionHeading
              label={t("matchesLabel")}
              title={t("matchesTitle")}
              href={`/${locale}/matches`}
              action={t("allMatches")}
            />
            <div className="fixtures-grid">
              {matches.data.items.slice(-3).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  locale={locale}
                  timeZone={club.data.timezone}
                />
              ))}
            </div>
            {!matches.data.items.length && <Empty />}
          </div>
        </section>
      )}
      {enabled("team") && (
        <section className="team-section">
          <div className="container">
            <SectionHeading
              label={t("teamLabel")}
              title={t("teamTitle")}
              href={`/${locale}/team`}
              action={t("allPlayers")}
            />
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
            {cards.some((p) => p.verification === "LEGACY_UNVERIFIED") && (
              <p className="archive-badge">{u("archive")}</p>
            )}
          </div>
        </section>
      )}
      {enabled("achievements") && (
        <Achievements items={club.data.achievements} locale={locale} />
      )}
      {enabled("news") && (
        <section className="news-section">
          <div className="container">
            <SectionHeading
              label={t("newsLabel")}
              title={t("newsTitle")}
              href={`/${locale}/news`}
              action={t("allNews")}
            />
            <NewsGrid
              posts={news.data.items.slice(0, 3)}
              locale={locale}
              timeZone={club.data.timezone}
            />
          </div>
        </section>
      )}
      {enabled("gallery") && (
        <section className="gallery-section" id="gallery">
          <div className="container">
            <div className="gallery-heading">
              <p className="section-label">{t("galleryLabel")}</p>
              <h2>{t("galleryTitle")}</h2>
              <p>{t("galleryDescription")}</p>
            </div>
            <Gallery items={gallery.data.items} />
          </div>
        </section>
      )}
      {enabled("contact") && <ContactSection {...props} />}
      <ScrollEffects />
    </main>
  );
}

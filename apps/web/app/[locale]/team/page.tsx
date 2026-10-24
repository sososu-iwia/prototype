import { Suspense } from "react";
import Loading from "../../../components/ui/Loading";
import Link from "next/link";
import { HeroPreload } from "../../../components/ui/HeroPreload";
import { getTranslations } from "next-intl/server";
import { getPlayers } from "../../../lib/api/server";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { Squad } from "../../../features/players/Squad";
import { Offline } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "/team", t("team"), t("teamPageDescription"));
}
export default function Team(props: Parameters<typeof TeamContent>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <TeamContent {...props} />
    </Suspense>
  );
}
async function TeamContent({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const u = await getTranslations("ui");
  const t = await getTranslations("site"),
    players = await getPlayers();
  return (
    <main id="content">
      <HeroPreload team />
      <section className="team-page-hero">
        <div className="container team-page-hero-content">
          <p className="hero-label">{t("teamLabel")}</p>
          <h1>
            <span>{t("teamHeroFirst")}</span>
            <span>{t("teamHeroSecond")}</span>
          </h1>
          <p className="team-hero-description">{t("teamPageDescription")}</p>
        </div>
      </section>
      <section className="team-page-section">
        <div className="container">
          <Offline show={players.offline} />
          <div className="admin-toolbar">
            <Link
              prefetch={false}
              className="section-link"
              href={`/${locale}/players`}
            >
              {u("archiveRoster")} →
            </Link>
          </div>
          <Squad players={players.data.items} />
        </div>
      </section>
    </main>
  );
}

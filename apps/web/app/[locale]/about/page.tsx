import { HeroPreload } from "../../../components/ui/HeroPreload";
import { getTranslations } from "next-intl/server";
import { getClub } from "../../../lib/api/server";
import { localized, type Locale, type SiteKey } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import {
  AboutHero,
  AboutIntro,
  AboutNumbers,
  AboutTimeline,
  AboutStadium,
  AboutValues,
  AboutCta,
} from "../../../components/club/PreservedSections";
import { Empty, Offline } from "../../../components/ui/State";
import { Media } from "../../../components/ui/Media";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "/about", t("about"), t("aboutPageHeroText"));
}
export default async function About({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    s = await getTranslations("site"),
    u = await getTranslations("ui"),
    club = await getClub();
  const content = club.data.info.find((i) => i.id === "main")?.content;
  const t = (key: SiteKey) => localized(content?.[key], locale) || s(key);
  const props = { locale, t };
  return (
    <main id="content">
      <HeroPreload />
      <AboutHero {...props} />
      <div className="container">
        <Offline show={club.offline} />
        {club.data.info.some((i) => i.verification === "LEGACY_UNVERIFIED") && (
          <p className="archive-badge">{u("archivedContent")}</p>
        )}
      </div>
      <AboutIntro {...props} />
      <AboutNumbers {...props} />
      <AboutTimeline {...props} />
      <AboutStadium {...props} />
      <AboutValues {...props} />
      <section className="section-pad">
        <div className="container">
          <h2>{u("staff")}</h2>
          {club.data.staff.length ? (
            <div className="staff-grid">
              {club.data.staff.map((member) => (
                <article className="achievement-card" key={member.id}>
                  {member.photo && (
                    <Media
                      src={member.photo}
                      alt={localized(member.names, locale)}
                    />
                  )}
                  <h3>{localized(member.names, locale)}</h3>
                  <p>{localized(member.title, locale)}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </div>
      </section>
      <AboutCta {...props} />
    </main>
  );
}

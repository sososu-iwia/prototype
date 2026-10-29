import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "../../lib/i18n/config";
import { Icon } from "./Icon";
export async function EditorialHero({
  locale,
  champion,
}: {
  locale: Locale;
  champion: boolean;
}) {
  const p = await getTranslations("premium");
  return (
    <section className="editorial-hero">
      <picture>
        <source
          media="(max-width:600px)"
          srcSet="/media/hero-640.avif"
          type="image/avif"
        />
        <source srcSet="/media/hero-1600.avif" type="image/avif" />
        <img
          className="editorial-hero-image"
          src="/media/hero-1600.webp"
          alt=""
          width="1600"
          height="1067"
          fetchPriority="high"
          loading="eager"
        />
      </picture>
      <div className="editorial-hero-shade" />
      <div className="container editorial-hero-content">
        <p className="eyebrow">
          <span />
          FC ORDABASY · {p("city")}
        </p>
        <h1>
          {p("heroLine1")}
          <br />
          <span>{p("heroLine2")}</span>
        </h1>
        <p className="editorial-hero-copy">{p("heroSubtitle")}</p>
        <div className="editorial-actions">
          <Link
            className="editorial-button"
            href={`/${locale}/teams/first-team`}
            prefetch={false}
          >
            {p("viewSquad")}
            <Icon name="arrow" />
          </Link>
          <Link
            className="editorial-text-link"
            href={`/${locale}/academy`}
            prefetch={false}
          >
            {p("academy")}
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="hero-footnote">
          <span>{p("photoArchive")}</span>
          {champion && (
            <Link href="#honours">
              <Icon name="trophy" />
              2026 · {p("leagueTitle")}
            </Link>
          )}
        </div>
      </div>
      <div className="hero-vertical" aria-hidden="true">
        SHYMKENT. OUR HOME.
      </div>
    </section>
  );
}

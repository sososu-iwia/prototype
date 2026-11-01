import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "../../lib/i18n/config";
import { Icon } from "./Icon";
import { HeroPreload } from "../ui/HeroPreload";
import { editorialHero as hero } from "../../lib/hero-media";
export async function EditorialHero({
  locale,
  champion,
}: {
  locale: Locale;
  champion: boolean;
}) {
  const p = await getTranslations("premium");
  return (
    <>
      <HeroPreload editorial />
      <section className="editorial-hero">
        <picture>
          <source
            media="(max-width:480px)"
            srcSet={hero.mobileAvif}
            sizes={hero.mobileSizes}
            type="image/avif"
          />
          <source
            media="(max-width:480px)"
            srcSet={hero.mobileWebp}
            sizes={hero.mobileSizes}
            type="image/webp"
          />
          <source
            srcSet={hero.desktopAvif}
            sizes={hero.desktopSizes}
            type="image/avif"
          />
          <img
            className="editorial-hero-image"
            src={hero.desktopFallback.webp}
            srcSet={hero.desktopWebp}
            sizes={hero.desktopSizes}
            alt=""
            width={hero.width}
            height={hero.height}
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
    </>
  );
}

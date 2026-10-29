import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "../../lib/i18n/config";
import { Media } from "../../components/ui/Media";
import { Icon } from "../../components/editorial/Icon";
export async function TeamSelector({ locale }: { locale: Locale }) {
  const p = await getTranslations("premium");
  return (
    <div className="team-selector">
      {(
        [
          ["first-team", "firstTeam", "gallery2"],
          ["first-league", "firstLeague", "news3"],
          ["second-league", "secondLeague", "news1"],
        ] as const
      ).map(([slug, key, asset], i) => (
        <Link
          href={`/${locale}/teams/${slug}`}
          prefetch={false}
          key={slug}
          className="team-destination"
        >
          <Media
            src={`/media/${asset}-640.webp`}
            alt=""
            sizes="(max-width:600px) 100vw, 33vw"
          />
          <div>
            <span className="team-index">0{i + 1}</span>
            <p>{slug === "first-league" ? p("pending") : p("onThePitch")}</p>
            <h3>{p(key)}</h3>
            <Icon name="arrow" />
          </div>
        </Link>
      ))}
    </div>
  );
}

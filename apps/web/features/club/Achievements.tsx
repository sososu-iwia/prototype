import { getTranslations } from "next-intl/server";
import type { Club } from "../../lib/api/types";
import { localized, type Locale } from "../../lib/i18n/config";
import { Archive, Empty } from "../../components/ui/State";
export async function Achievements({
  items,
  locale,
}: {
  items: Club["achievements"];
  locale: Locale;
}) {
  const t = await getTranslations("site");
  const types = ["championship", "cup", "league", "history"] as const;
  return (
    <section className="achievements-section">
      <div className="container">
        <div className="achievements-heading">
          <p className="section-label">{t("achievementsLabel")}</p>
          <h2>{t("achievementsTitle")}</h2>
          <p className="achievements-description">
            {t("achievementsDescription")}
          </p>
        </div>
        <div className="achievements-grid">
          {items.map((item, i) => (
            <article
              key={item.id}
              className={`achievement-card${i === 0 ? " main-achievement" : ""}`}
            >
              <div className="achievement-year">{item.year || "★"}</div>
              <div className="trophy-icon" aria-hidden="true">
                {i < 2 ? "🏆" : i === 2 ? "⚽" : "◉"}
              </div>
              <p className="achievement-type">{t(types[i % types.length])}</p>
              <h3>{localized(item.title, locale)}</h3>
              <p>{localized(item.description, locale)}</p>
              <Archive verification={item.verification} />
            </article>
          ))}
        </div>
        {!items.length && <Empty />}
      </div>
    </section>
  );
}

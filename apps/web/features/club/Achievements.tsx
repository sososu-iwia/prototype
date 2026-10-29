import { getTranslations } from "next-intl/server";
import type { Club } from "../../lib/api/types";
import { localized, type Locale } from "../../lib/i18n/config";
import { Icon } from "../../components/editorial/Icon";
export async function Achievements({
  items,
  locale,
}: {
  items: Club["achievements"];
  locale: Locale;
}) {
  const p = await getTranslations("premium");
  const verified = items
    .filter((i) => i.verification === "VERIFIED" && i.status === "PUBLISHED")
    .sort((a, b) => (b.year || 0) - (a.year || 0));
  return (
    <section className="honours-section" id="honours">
      <div className="honours-watermark" aria-hidden="true">
        ORDABASY
      </div>
      <div className="container">
        <div className="honours-heading">
          <p className="eyebrow">FC ORDABASY · {p("history")}</p>
          <h2>
            {p("honours")}
            <span>.</span>
          </h2>
        </div>
        <div className="honours-grid">
          {verified.map((item) => (
            <article
              key={item.id}
              data-achievement-type={item.achievementType}
              className={`honour-card${item.year === 2026 && item.competitionKey === "kazakhstan-premier-league" ? " honour-featured" : ""}`}
            >
              <span className="honour-year">{item.year || "—"}</span>
              <Icon
                name={
                  item.achievementType === "MILESTONE" ? "shield" : "trophy"
                }
                className="honour-icon"
              />
              <p className="honour-category">
                {p(
                  item.achievementType === "LEAGUE"
                    ? "leagueTitle"
                    : item.achievementType === "CUP"
                      ? "cupTitle"
                      : "milestone",
                )}
              </p>
              <h3>{localized(item.title, locale)}</h3>
              <p>{localized(item.description, locale)}</p>
              {/^https:\/\//.test(item.source) && (
                <a href={item.source} target="_blank" rel="noopener noreferrer">
                  {p("verifiedSource")}{" "}
                  <Icon
                    name="arrow"
                    width="13"
                    height="13"
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      transform: "rotate(-45deg)",
                    }}
                  />
                </a>
              )}
            </article>
          ))}
        </div>
        {!verified.length && (
          <p className="honours-empty">{p("noApprovedContent")}</p>
        )}
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import type { Sponsor } from "../../lib/api/types";
export async function SponsorGrid({
  items,
  headingLevel = 2,
}: {
  items: Sponsor[];
  headingLevel?: 1 | 2;
}) {
  const p = await getTranslations("premium");
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className="sponsor-section" id="partners">
      <div className="container">
        <p className="eyebrow">FC ORDABASY</p>
        <Heading>{p("partners")}</Heading>
        {items.length ? (
          <div className="sponsor-grid">
            {items.map((item) => (
              <div className="sponsor-logo" key={item.id}>
                {item.websiteUrl ? (
                  <a
                    href={item.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                  >
                    <img
                      src={item.logo}
                      alt={item.name}
                      width="240"
                      height="100"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <img
                    src={item.logo}
                    alt={item.name}
                    width="240"
                    height="100"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>{p("noApprovedContent")}</p>
        )}
      </div>
    </section>
  );
}

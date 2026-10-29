import { getTranslations } from "next-intl/server";
import type { Sponsor } from "../../lib/api/types";
export async function SponsorGrid({ items }: { items: Sponsor[] }) {
  const p = await getTranslations("premium");
  return (
    <section className="sponsor-section" id="partners">
      <div className="container">
        <p className="eyebrow">FC ORDABASY</p>
        <h2>{p("partners")}</h2>
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

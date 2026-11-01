import { getTranslations } from "next-intl/server";
import type { Sponsor } from "../../lib/api/types";
import { SponsorMarquee } from "./SponsorMarquee";
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
          <SponsorMarquee
            items={items}
            labels={{
              partners: p("partners"),
              pause: p("pauseSponsors"),
              resume: p("resumeSponsors"),
            }}
          />
        ) : (
          <p>{p("noApprovedContent")}</p>
        )}
      </div>
    </section>
  );
}

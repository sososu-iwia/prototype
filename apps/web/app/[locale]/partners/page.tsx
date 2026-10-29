import { getTranslations } from "next-intl/server";
import { getSponsors } from "../../../lib/api/server";
import { SponsorGrid } from "../../../features/sponsors/SponsorGrid";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    p = await getTranslations({ locale, namespace: "premium" });
  return metadata(locale, "/partners", p("partners"), p("official"));
}
export default async function Page() {
  const sponsors = await getSponsors();
  return (
    <main id="content" className="premium partners-page">
      <SponsorGrid items={sponsors.data.items} headingLevel={1} />
    </main>
  );
}

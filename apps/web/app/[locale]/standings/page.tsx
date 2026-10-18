import { getTranslations } from "next-intl/server";
import { getStandings, getClub } from "../../../lib/api/server";
import { StandingsTable } from "../../../features/standings/Table";
import { Offline } from "../../../components/ui/State";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "ui" });
  return metadata(locale, "/standings", t("standings"), t("standings"));
}
export default async function Standings({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [result, club] = await Promise.all([getStandings(), getClub()]);
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <Offline show={result.offline} />
        <StandingsTable
          data={result.data}
          locale={locale}
          timeZone={club.data.timezone}
        />
      </div>
    </main>
  );
}

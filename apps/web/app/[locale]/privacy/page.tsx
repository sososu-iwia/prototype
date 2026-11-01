import { getTranslations } from "next-intl/server";
import { getAcademy } from "../../../lib/api/server";
import { localized, type Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    p = await getTranslations({ locale, namespace: "premium" });
  return metadata(locale, "/privacy", p("privacy"), p("retention"));
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    p = await getTranslations("premium"),
    { data } = await getAcademy();
  return (
    <main id="content" className="premium">
      <article className="container editorial-section privacy-page">
        <p className="eyebrow">FC ORDABASY</p>
        <h1>{p("privacy")}</h1>
        <p>{p("privacySummary")}</p>
        {localized(data.content?.privacyNotice, locale) && (
          <p>{localized(data.content?.privacyNotice, locale)}</p>
        )}
        <h2>{p("contact")}</h2>
        <p>{data.contactEmail || data.contactPhone || p("contactPending")}</p>
      </article>
    </main>
  );
}

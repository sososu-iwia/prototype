import { getTranslations } from "next-intl/server";
import { AcademyPage } from "../../../features/academy/AcademyPage";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    p = await getTranslations({ locale, namespace: "premium" });
  return metadata(locale, "/academy", p("academy"), p("academyIntro"));
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <AcademyPage locale={locale} />;
}

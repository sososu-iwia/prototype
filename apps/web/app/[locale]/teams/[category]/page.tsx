import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TeamPage } from "../../../../features/teams/TeamPage";
import type { Locale } from "../../../../lib/i18n/config";
import { metadata } from "../../../../lib/metadata";
type Props = {
  params: Promise<{ locale: Locale; category: string }>;
  searchParams: Promise<{ season?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const { locale, category } = await params,
    p = await getTranslations({ locale, namespace: "premium" });
  return metadata(
    locale,
    `/teams/${category}`,
    p(
      category === "first-team"
        ? "firstTeam"
        : category === "first-league"
          ? "firstLeague"
          : "secondLeague",
    ),
    p("teamIntro"),
  );
}
export default async function Page({ params, searchParams }: Props) {
  const { locale, category } = await params,
    { season } = await searchParams;
  if (!["first-team", "first-league", "second-league"].includes(category))
    notFound();
  return (
    <TeamPage
      locale={locale}
      category={category as "first-team" | "first-league" | "second-league"}
      season={season}
    />
  );
}

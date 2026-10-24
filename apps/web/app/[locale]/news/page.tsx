import { Suspense } from "react";
import Loading from "../../../components/ui/Loading";
import { Pagination } from "../../../components/ui/Pagination";
import { HeroPreload } from "../../../components/ui/HeroPreload";
import { getTranslations } from "next-intl/server";
import { getNews, getClub } from "../../../lib/api/server";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { NewsGrid } from "../../../features/news/NewsGrid";
import { Offline } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "/news", t("news"), t("newsTitle"));
}
export default function News(props: Parameters<typeof NewsContent>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <NewsContent {...props} />
    </Suspense>
  );
}
async function NewsContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params,
    q = await searchParams,
    page = Math.max(1, Math.floor(Number(q.page) || 1)),
    [result, club] = await Promise.all([
      getNews(`page=${page}&limit=12`),
      getClub(),
    ]),
    t = await getTranslations("site");
  return (
    <main id="content">
      <HeroPreload />
      <section className="about-page-hero compact-hero">
        <div className="container">
          <p className="hero-label">{t("newsLabel")}</p>
          <h1>{t("newsTitle")}</h1>
        </div>
      </section>
      <section className="news-section">
        <div className="container">
          <Offline show={result.offline} />
          <NewsGrid
            headingLevel={2}
            posts={result.data.items}
            locale={locale}
            timeZone={club.data.timezone}
          />
          <Pagination
            page={page}
            total={result.data.total}
            limit={12}
            path={`/${locale}/news`}
          />
        </div>
      </section>
    </main>
  );
}

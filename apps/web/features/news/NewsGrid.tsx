import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { date, type Locale } from "../../lib/i18n/config";
import type { News } from "../../lib/api/types";
import { Media } from "../../components/ui/Media";
import { Empty, Archive } from "../../components/ui/State";
export function translation(post: News, locale: Locale) {
  return (
    post.translations.find((t) => t.locale === locale) ||
    post.translations.find((t) => t.locale === "kk") ||
    post.translations[0]
  );
}
export async function NewsGrid({
  posts,
  locale,
  timeZone = "Asia/Almaty",
  headingLevel = 3,
}: {
  posts: News[];
  locale: Locale;
  timeZone?: string;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations("site");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (!posts.length) return <Empty />;
  return (
    <div className="news-layout">
      <div>
        {posts.slice(0, 1).map((post) => {
          const copy = translation(post, locale);
          return (
            <article className="main-news-card" key={post.id}>
              {post.cover && (
                <div className="news-image big-news-image">
                  <Media src={post.cover} alt={copy.title} />
                  <span className="news-category">{t("clubNews")}</span>
                </div>
              )}
              <div className="main-news-content">
                <time className="news-date" dateTime={post.publishedAt}>
                  {date(post.publishedAt, locale, timeZone)}
                </time>
                <Heading>
                  <Link prefetch={false} href={`/${locale}/news/${post.slug}`}>
                    {copy.title}
                  </Link>
                </Heading>
                <p>{copy.excerpt}</p>
                <Archive verification={post.verification} />
                <Link
                  prefetch={false}
                  className="news-read"
                  href={`/${locale}/news/${post.slug}`}
                >
                  {t("readMore")}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="small-news-column">
        {posts.slice(1).map((post) => {
          const copy = translation(post, locale);
          return (
            <article className="small-news-card" key={post.id}>
              {post.cover && (
                <div className="small-news-image">
                  <Media src={post.cover} alt={copy.title} />
                </div>
              )}
              <div className="small-news-content">
                <time className="news-date" dateTime={post.publishedAt}>
                  {date(post.publishedAt, locale, timeZone)}
                </time>
                <Heading>
                  <Link prefetch={false} href={`/${locale}/news/${post.slug}`}>
                    {copy.title}
                  </Link>
                </Heading>
                <Link prefetch={false} href={`/${locale}/news/${post.slug}`}>
                  {t("readMore")}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

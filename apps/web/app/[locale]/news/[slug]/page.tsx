import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getArticle, getClub } from "../../../../lib/api/server";
import { date, type Locale } from "../../../../lib/i18n/config";
import { metadata } from "../../../../lib/metadata";
import { translation } from "../../../../features/news/NewsGrid";
import { Media } from "../../../../components/ui/Media";
import { Offline, Archive } from "../../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params,
    result = await getArticle(slug);
  if (!result.data) return {};
  const copy = translation(result.data, locale);
  return {
    ...metadata(
      locale,
      `/news/${slug}`,
      copy.title,
      copy.excerpt,
      result.data.cover || undefined,
    ),
    openGraph: {
      type: "article" as const,
      title: copy.title,
      description: copy.excerpt,
      publishedTime: result.data.publishedAt,
      images: result.data.cover ? [result.data.cover] : undefined,
    },
  };
}
export default async function Article({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params,
    [result, club] = await Promise.all([getArticle(slug), getClub()]);
  const post = result.data;
  if (!post) notFound();
  const copy = translation(post, locale),
    s = await getTranslations("site"),
    u = await getTranslations("ui");
  return (
    <main id="content" className="detail-page">
      <article className="container article">
        <Link className="section-link" href={`/${locale}/news`}>
          ← {s("news")}
        </Link>
        <Offline show={result.offline} />
        <p className="section-label">{s("clubNews")}</p>
        <h1>{copy.title}</h1>
        <time dateTime={post.publishedAt}>
          {date(post.publishedAt, locale, club.data.timezone)}
        </time>
        <Archive verification={post.verification} />
        {copy.locale !== locale && (
          <p className="source-notice">{u("fallback")}</p>
        )}
        {post.cover && (
          <div className="article-cover">
            <Media
              src={post.cover}
              alt={copy.title}
              priority
              sizes="(max-width: 900px) 90vw, 900px"
            />
          </div>
        )}
        <div className="article-body" lang={copy.locale}>
          {copy.body.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {!!post.images?.length && (
          <div className="gallery-grid">
            {post.images.map((src, i) => (
              <Media key={src} src={src} alt={`${copy.title} · ${i + 1}`} />
            ))}
          </div>
        )}
        <p className="source-notice">
          {u("source")}: {post.source}
        </p>
      </article>
    </main>
  );
}

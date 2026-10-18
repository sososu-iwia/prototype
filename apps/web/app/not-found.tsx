import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
export default async function NotFound() {
  const t = await getTranslations("ui"),
    s = await getTranslations("site"),
    locale = await getLocale();
  return (
    <main id="content" className="detail-page">
      <div className="container empty-state">
        <p className="hero-label">404</p>
        <h1>{t("notFound")}</h1>
        <Link className="btn btn-primary" href={`/${locale}`}>
          {s("home")}
        </Link>
      </div>
    </main>
  );
}

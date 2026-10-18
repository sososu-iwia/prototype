import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
export async function Footer() {
  const t = await getTranslations("site"),
    u = await getTranslations("ui"),
    locale = await getLocale();
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link prefetch={false} href={`/${locale}`} className="footer-logo">
            <span>ФК</span> ОРДАБАСЫ
          </Link>
          <p>{t("footerText")}</p>
        </div>
        <div className="footer-column">
          <h2>{t("navigation")}</h2>
          {(["home", "about", "team", "matches"] as const).map((key, i) => (
            <Link
              prefetch={false}
              key={key}
              href={`/${locale}${i ? `/${key}` : ""}`}
            >
              {t(key)}
            </Link>
          ))}
        </div>
        <div className="footer-column">
          <h2>{t("media")}</h2>
          <Link prefetch={false} href={`/${locale}/news`}>
            {t("news")}
          </Link>
          <Link prefetch={false} href={`/${locale}/gallery`}>
            {t("gallery")}
          </Link>
          <Link prefetch={false} href={`/${locale}/statistics`}>
            {u("stats")}
          </Link>
        </div>
        <div className="footer-column">
          <h2>{t("clubInfo")}</h2>
          <p>📍 {t("footerCity")}</p>
          <p>⚽ {t("footerClub")}</p>
          <Link prefetch={false} href={`/${locale}/admin`}>
            {u("admin")}
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          © {new Date().getUTCFullYear()} FC Ordabasy. {t("rights")}
        </p>
        <a href="#top-sentinel" className="back-to-top" aria-label={u("top")}>
          ↑
        </a>
      </div>
    </footer>
  );
}

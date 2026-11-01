import Link from "next/link";
import { Icon } from "../editorial/Icon";
import { getLocale, getTranslations } from "next-intl/server";
export async function Footer() {
  const locale = await getLocale(),
    p = await getTranslations("premium"),
    s = await getTranslations("site"),
    u = await getTranslations("ui");
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-wordmark" aria-hidden="true">
          ORDABASY
        </div>
        <div className="site-footer-grid">
          <div>
            <img
              src="/media/logo-header-96.webp"
              width="58"
              height="64"
              alt="FC Ordabasy"
            />
            <p>{p("city")}</p>
            <p>{s("footerText")}</p>
          </div>
          {[
            [
              "teams",
              [
                ["firstTeam", "/teams/first-team"],
                ["firstLeague", "/teams/first-league"],
                ["secondLeague", "/teams/second-league"],
              ],
            ],
            [
              "club",
              [
                ["history", "/about"],
                ["honours", "/#honours"],
                ["partners", "/partners"],
              ],
            ],
            [
              "academy",
              [
                ["academy", "/academy"],
                ["admission", "/academy/admission"],
                ["privacy", "/privacy"],
              ],
            ],
          ].map(([label, links]) => (
            <div key={String(label)}>
              <h2>{p(label as "teams")}</h2>
              {(links as string[][]).map(([key, url]) => (
                <Link key={url} prefetch={false} href={`/${locale}${url}`}>
                  {p(key as "teams")}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="site-footer-bottom">
          <span>
            © {new Date().getUTCFullYear()} FC Ordabasy. {s("rights")}
          </span>
          <Link href={`/${locale}/admin`} prefetch={false}>
            {u("admin")}
          </Link>
          <a href="#top-sentinel" aria-label={u("top")}>
            <Icon name="arrow" style={{ transform: "rotate(-90deg)" }} />
          </a>
        </div>
      </div>
    </footer>
  );
}

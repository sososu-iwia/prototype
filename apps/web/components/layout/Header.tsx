"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { locales } from "../../lib/i18n/config";
export function Header() {
  const t = useTranslations("site"),
    u = useTranslations("ui"),
    locale = useLocale(),
    path = usePathname();
  const [open, setOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    const sentinel = document.getElementById("top-sentinel");
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);
  const routes = [
    ["", "home"],
    ["/about", "about"],
    ["/team", "team"],
    ["/matches", "matches"],
    ["/news", "news"],
    ["/gallery", "gallery"],
  ] as const;
  return (
    <header className={`header${scrolled ? " scrolled" : ""}`} id="header">
      <div className="container nav-container">
        <Link
          prefetch={false}
          href={`/${locale}`}
          className="logo"
          onClick={() => setOpen(false)}
        >
          <img
            src="/media/logo-320.webp"
            width="45"
            height="50"
            alt={t("title")}
          />
          <div className="logo-text">
            <strong>ОРДАБАСЫ</strong>
            <small>FOOTBALL CLUB</small>
          </div>
        </Link>
        <nav
          aria-label={t("navigation")}
          className={`navbar${open ? " active" : ""}`}
          id="navbar"
        >
          {routes.map(([route, key]) => (
            <Link
              prefetch={false}
              href={`/${locale}${route}`}
              key={key}
              className={path === `/${locale}${route}` ? "active" : undefined}
              aria-current={path === `/${locale}${route}` ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="language-switcher" aria-label={u("language")}>
          {locales.map((l) => (
            <a
              href={path.replace(/^\/(kk|ru|en)/, `/${l}`)}
              lang={l}
              hrefLang={l}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${l}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
              }}
              aria-current={locale === l ? "page" : undefined}
              className={`lang-btn${locale === l ? " active" : ""}`}
              key={l}
            >
              {l === "kk" ? "KZ" : l.toUpperCase()}
            </a>
          ))}
        </div>
        <button
          className="menu-btn"
          ref={menu}
          aria-label={u("menu")}
          aria-controls="navbar"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
    </header>
  );
}

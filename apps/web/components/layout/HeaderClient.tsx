"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "../../lib/i18n/config";
import { Icon } from "../editorial/Icon";
export function HeaderClient({
  locale,
  labels: t,
}: {
  locale: Locale;
  labels: Record<string, string>;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false),
    [group, setGroup] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    toggle = useRef<HTMLButtonElement>(null),
    header = useRef<HTMLElement>(null),
    lastGroup = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = old;
      };
    }
    dialog.current?.close();
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Tab") {
        const focusable = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) || [],
        ).filter((node) => node.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable.at(-1),
          active = document.activeElement;
        if (
          first &&
          ((e.shiftKey && active === first) ||
            (!e.shiftKey && active === last) ||
            !dialog.current?.contains(active))
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
      if (e.key === "Escape") {
        if (
          !open &&
          lastGroup.current?.getAttribute("aria-expanded") !== "true"
        )
          return;
        setGroup(null);
        if (open) {
          setOpen(false);
          toggle.current?.focus();
        } else lastGroup.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setGroup(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => {
    const wide = window.matchMedia("(min-width:1001px)");
    const resize = () => {
      if (wide.matches) {
        setOpen(false);
        setGroup(null);
      }
    };
    wide.addEventListener("change", resize);
    return () => wide.removeEventListener("change", resize);
  }, []);
  const close = () => {
    setOpen(false);
    setGroup(null);
  };
  const groups: Record<string, [string, string][]> = {
    teams: [
      ["firstTeam", "/teams/first-team"],
      ["firstLeague", "/teams/first-league"],
      ["secondLeague", "/teams/second-league"],
      ["allPlayers", "/players"],
      ["coaches", "/teams/first-team#coaches"],
    ],
    academy: [
      ["academy", "/academy"],
      ["admission", "/academy/admission"],
      ["ageGroups", "/academy#age-groups"],
      ["coaches", "/academy#coaches"],
      ["faq", "/academy#faq"],
      ["contact", "/academy#contact"],
    ],
    club: [
      ["history", "/about"],
      ["honours", "/#honours"],
      ["stadium", "/about#stadium"],
      ["management", "/about#management"],
      ["partners", "/partners"],
    ],
  };
  function nav(mobile = false) {
    return (
      <nav
        id={mobile ? "mobile-navbar" : "navbar"}
        aria-label={t.navigation}
        className={mobile ? "drawer-nav" : "desktop-nav"}
      >
        {[
          ["home", ""],
          ["teams", null],
          ["matches", "/matches"],
          ["news", "/news"],
          ["academy", null],
          ["club", null],
          ["gallery", "/gallery"],
        ].map(([key, route]) =>
          route !== null ? (
            <Link
              key={key}
              href={`/${locale}${route}`}
              prefetch={false}
              onClick={close}
              aria-current={path === `/${locale}${route}` ? "page" : undefined}
            >
              {t[key!]}
            </Link>
          ) : (
            <div className="nav-disclosure" key={key}>
              <button
                aria-expanded={group === key}
                aria-controls={`${mobile ? "mobile" : "desktop"}-${key}`}
                onClick={(e) => {
                  lastGroup.current = e.currentTarget;
                  setGroup(group === key ? null : key);
                }}
              >
                {t[key!]}
                <Icon name="chevron" />
              </button>
              <div
                className="mega-menu"
                id={`${mobile ? "mobile" : "desktop"}-${key}`}
                hidden={group !== key}
              >
                <div className="mega-intro">
                  <span>FC ORDABASY</span>
                  <strong>{t[key!]}</strong>
                  <p>{t.navDescription}</p>
                </div>
                <div className="mega-links">
                  {groups[key!].map(([label, url]) => (
                    <Link
                      prefetch={false}
                      href={`/${locale}${url}`}
                      onClick={close}
                      key={url}
                    >
                      {t[label]}
                      <Icon name="arrow" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ),
        )}
      </nav>
    );
  }
  return (
    <header
      className="site-header"
      id="header"
      ref={header}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setGroup(null);
      }}
    >
      <div className="utility-bar">
        <span>{t.official}</span>
        <span>{t.city}</span>
      </div>
      <div className="site-nav">
        <Link
          href={`/${locale}`}
          prefetch={false}
          className="site-brand"
          onClick={close}
        >
          <img
            src="/media/logo-header-96.webp"
            width="48"
            height="54"
            alt="FC Ordabasy"
          />
          <span>
            ORDABASY<small>FOOTBALL CLUB</small>
          </span>
        </Link>
        {nav()}
        <div className="site-languages" aria-label={t.language}>
          {locales.map((l) => (
            <a
              href={path.replace(/^\/(kk|ru|en)/, `/${l}`)}
              key={l}
              lang={l}
              hrefLang={l}
              aria-current={locale === l ? "page" : undefined}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${l}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
              }}
            >
              {l === "kk" ? "KZ" : l.toUpperCase()}
            </a>
          ))}
        </div>
        <button
          className="site-menu-toggle"
          ref={toggle}
          aria-label={t.menu}
          aria-expanded={open}
          aria-controls="site-drawer"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
        </button>
      </div>
      <dialog
        className="mobile-drawer"
        ref={dialog}
        id="site-drawer"
        aria-label={t.navigation}
        onCancel={() => {
          setOpen(false);
          toggle.current?.focus();
        }}
      >
        <div className="drawer-top">
          <span>ORDABASY FC</span>
          <button
            aria-label={t.close}
            onClick={() => {
              close();
              toggle.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        {nav(true)}
        <p className="drawer-motto">{t.city}</p>
      </dialog>
    </header>
  );
}

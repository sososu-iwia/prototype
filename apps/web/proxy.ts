import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "./lib/i18n/config";
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname,
    first = path.split("/")[1];
  if (!isLocale(first)) {
    const saved = req.cookies.get("NEXT_LOCALE")?.value;
    const locale = saved && isLocale(saved) ? saved : "kk";
    const target = req.nextUrl.clone();
    target.pathname = `/${locale}${path === "/" ? "" : path}`;
    return NextResponse.redirect(target);
  }
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const https = process.env.PUBLIC_ORIGIN?.startsWith("https://");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'self'${dev ? " ws:" : ""}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${https ? " upgrade-insecure-requests;" : ""}`;
  const headers = new Headers(req.headers);
  headers.set("x-next-intl-locale", first);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  if (https)
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  const isPrefetch =
    req.headers.has("next-router-prefetch") ||
    req.headers.has("next-router-segment-prefetch") ||
    [req.headers.get("purpose"), req.headers.get("sec-purpose")].some((value) =>
      value?.includes("prefetch"),
    );
  if (
    !isPrefetch &&
    req.headers.get("sec-fetch-dest") === "document" &&
    req.cookies.get("NEXT_LOCALE")?.value !== first
  )
    res.cookies.set("NEXT_LOCALE", first, {
      path: "/",
      sameSite: "lax",
      secure: !dev && process.env.COOKIE_SECURE === "true",
      maxAge: 31536000,
    });
  return res;
}
export const config = {
  matcher: [
    "/((?!api|uploads|media|fonts|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.html$).*)",
  ],
};

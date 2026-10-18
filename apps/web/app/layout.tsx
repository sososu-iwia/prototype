import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

import { origin } from "../lib/metadata";
import "../styles/fonts.css";
import "../styles/legacy.css";
import "../styles/app.css";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: "FC Ordabasy", template: "%s" },
  description: "FC Ordabasy · Shymkent · Қазақстан",
  icons: { icon: "/media/logo-320.webp" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale(),
    u = await getTranslations("ui");
  return (
    <html lang={locale}>
      <head>
        {(locale === "en"
          ? ["latin"]
          : ["cyrillic-ext", "cyrillic", "latin"]
        ).map((subset) => (
          <link
            key={subset}
            rel="preload"
            href={`/fonts/noto-sans-${subset}-wght-normal.woff2`}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        <div id="top-sentinel" />
        <a className="skip-link" href="#content">
          {u("skip")}
        </a>
        <NextIntlClientProvider>
          <Header />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ErrorLabelsProvider } from "../components/ui/ErrorLabels";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

import { origin } from "../lib/metadata";
import "../styles/fonts.css";
import "../styles/primary-font.css";
import "../styles/legacy.css";
import "../styles/app.css";
import "../styles/editorial.css";
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: "FC Ordabasy", template: "%s" },
  description: "FC Ordabasy · Shymkent · Қазақстан",
  icons: { icon: "/media/logo-header-96.webp" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale(),
    u = await getTranslations("ui");
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <head>
        <link
          rel="preload"
          href="/fonts/noto-sans-2.015-primary-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div id="top-sentinel" />
        <a className="skip-link" href="#content">
          {u("skip")}
        </a>
        <Header />
        <ErrorLabelsProvider labels={{ error: u("error"), retry: u("retry") }}>
          {children}
        </ErrorLabelsProvider>
        <Footer />
      </body>
    </html>
  );
}

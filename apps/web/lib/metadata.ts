import type { Metadata } from "next";
import type { Locale } from "./i18n/config";
export const origin = process.env.PUBLIC_ORIGIN || "http://localhost:3000";
export function metadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  image = "/media/hero-1600.webp",
): Metadata {
  return {
    title: `${title} | FC Ordabasy`,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        kk: `/kk${path}`,
        ru: `/ru${path}`,
        en: `/en${path}`,
        "x-default": `/kk${path}`,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "kk" ? "kk_KZ" : locale === "ru" ? "ru_KZ" : "en_GB",
      url: `/${locale}${path}`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

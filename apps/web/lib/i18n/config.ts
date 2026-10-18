import kk from "../../messages/kk.json";
export const locales = ["kk", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export type SiteKey = keyof typeof kk.site;
export type UiKey = keyof typeof kk.ui;
export const isLocale = (locale: string): locale is Locale =>
  locales.includes(locale as Locale);
export function localized(value: unknown, locale: Locale): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const obj = value as Partial<Record<Locale, string>>;
  return obj[locale] || obj.kk || "";
}
export function date(
  value: string,
  locale: Locale,
  timeZone = "Asia/Almaty",
  withTime = false,
) {
  return new Intl.DateTimeFormat(
    locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-KZ" : "en-GB",
    {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" as const } : {}),
      timeZone,
    },
  ).format(new Date(value));
}
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof kk;
  }
}

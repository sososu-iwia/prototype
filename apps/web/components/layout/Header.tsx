import { getLocale, getTranslations } from "next-intl/server";
import { HeaderClient, type HeaderLabels } from "./HeaderClient";

export async function Header() {
  const locale = await getLocale(),
    site = await getTranslations("site"),
    ui = await getTranslations("ui");
  const keys = [
    "title",
    "navigation",
    "home",
    "about",
    "team",
    "matches",
    "news",
    "gallery",
  ] as const;
  const labels = {
    ...Object.fromEntries(keys.map((key) => [key, site(key)])),
    language: ui("language"),
    menu: ui("menu"),
  } as HeaderLabels;
  return <HeaderClient locale={locale} labels={labels} />;
}

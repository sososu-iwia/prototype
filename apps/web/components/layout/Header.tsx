import { getLocale, getTranslations } from "next-intl/server";
import { HeaderClient } from "./HeaderClient";
export async function Header() {
  const locale = await getLocale(),
    s = await getTranslations("site"),
    p = await getTranslations("premium"),
    u = await getTranslations("ui");
  return (
    <HeaderClient
      locale={locale}
      labels={{
        home: s("home"),
        matches: s("matches"),
        news: s("news"),
        gallery: s("gallery"),
        navigation: s("navigation"),
        language: u("language"),
        menu: u("menu"),
        ...Object.fromEntries(
          [
            "teams",
            "academy",
            "club",
            "firstTeam",
            "firstLeague",
            "secondLeague",
            "allPlayers",
            "coaches",
            "admission",
            "ageGroups",
            "faq",
            "contact",
            "history",
            "honours",
            "stadium",
            "management",
            "partners",
            "official",
            "city",
            "close",
            "navDescription",
          ].map((k) => [k, p(k as "teams")]),
        ),
      }}
    />
  );
}

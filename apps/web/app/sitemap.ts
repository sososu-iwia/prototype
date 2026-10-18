export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getPlayers, getNews } from "../lib/api/server";
import { origin } from "../lib/metadata";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [players, news] = await Promise.all([getPlayers("archive=true"), getNews()]);
  const paths = [
    "",
    "/about",
    "/team",
    "/players",
    "/matches",
    "/standings",
    "/news",
    "/gallery",
    "/statistics",
    ...players.data.items.map((p) => `/players/${p.slug}`),
    ...news.data.items.map((p) => `/news/${p.slug}`),
  ];
  return paths.flatMap((path) =>
    ["kk", "ru", "en"].map((locale) => ({
      url: `${origin}/${locale}${path}`,
      alternates: {
        languages: {
          kk: `${origin}/kk${path}`,
          ru: `${origin}/ru${path}`,
          en: `${origin}/en${path}`,
        },
      },
    })),
  );
}

export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getPlayers, getNews } from "../lib/api/server";
import { origin } from "../lib/metadata";
import type { List, Player, News } from "../lib/api/types";
import type { Result } from "../lib/api/server";
async function allPages<T>(read: (page: number) => Promise<Result<List<T>>>) {
  const first = await read(1);
  const items = [...first.data.items];
  if (first.offline) return items;
  for (let page = 2; items.length < first.data.total; page++) {
    const next = await read(page);
    if (next.offline || !next.data.items.length) break;
    items.push(...next.data.items);
  }
  return items;
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [players, news] = await Promise.all([
    allPages<Player>((page) =>
      getPlayers(`archive=true&page=${page}&limit=100`),
    ),
    allPages<News>((page) => getNews(`page=${page}&limit=100`)),
  ]);
  const paths = [
    "",
    "/about", "/academy", "/academy/admission", "/partners", "/privacy", "/teams/first-team", "/teams/second-league",
    "/team",
    "/players",
    "/matches",
    "/standings",
    "/news",
    "/gallery",
    "/statistics",
    ...players.map((p) => `/players/${p.slug}`),
    ...news.map((p) => `/news/${p.slug}`),
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

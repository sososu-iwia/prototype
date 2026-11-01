import "server-only";
import { cache } from "react";
import snapshot from "../../../../packages/content/public-snapshot.json";
import type {
  Player,
  Sponsor,
  Academy,
  TeamPageData,
  Match,
  News,
  GalleryItem,
  Club,
  List,
  Standings,
  RankedStatistic,
} from "./types";
const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000/api/v1";
export type Result<T> = { data: T; offline: boolean };
export const readApi = cache(async function <T>(
  path: string,
  fallback: T,
  missing: T = fallback,
): Promise<Result<T>> {
  try {
    const res = await fetch(`${base}/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (res.status === 404) return { data: missing, offline: false };
    if (!res.ok) throw new Error("API_UNAVAILABLE");
    return { data: (await res.json()) as T, offline: false };
  } catch {
    return { data: fallback, offline: true };
  }
});
const listQuery = (query: string) => {
  const q = new URLSearchParams(query);
  if (!q.has("limit")) q.set("limit", "100");
  return q.toString();
};
const list = <T>(items: T[]): List<T> => ({
  items,
  total: items.length,
  page: 1,
  limit: 100,
});
export const getPlayers = (query = "") =>
  readApi<List<Player>>(
    `players?${listQuery(query)}`,
    list(snapshot.players as unknown as Player[]),
  );
export const getPlayer = (slug: string) =>
  readApi<Player | null>(
    `players/${encodeURIComponent(slug)}`,
    (snapshot.players.find((p) => p.slug === slug) as unknown as Player) ||
      null,
    null,
  );
export const getMatches = (query = "") =>
  readApi<List<Match>>(`matches?${listQuery(query)}`, list([]));
export const getNews = (query = "") =>
  readApi<List<News>>(
    `news?${listQuery(query)}`,
    list(snapshot.news as unknown as News[]),
  );
export const getArticle = (slug: string) =>
  readApi<News | null>(
    `news/${encodeURIComponent(slug)}`,
    (snapshot.news.find((p) => p.slug === slug) as unknown as News) || null,
    null,
  );
export const getGallery = () =>
  readApi<List<GalleryItem>>(
    "gallery?limit=100",
    list(snapshot.gallery as unknown as GalleryItem[]),
  );
export const getClub = () =>
  readApi<Club>("club", {
    ...snapshot.club,
    achievements: [],
  } as unknown as Club);
export const getSeasons = () =>
  readApi<{ id: string; name: string; current: boolean }[]>(
    "seasons",
    snapshot.seasons,
  );
export const getCompetitions = () =>
  readApi<{ id: string; names: Record<string, string> }[]>(
    "competitions",
    snapshot.competitions,
  );
export const getStandings = () =>
  readApi<Standings>("standings", {
    rows: [],
    source: null,
    updatedAt: null,
    stale: false,
  });
export const getStatistics = (query = "") =>
  readApi<{
    items: RankedStatistic[];
    season: string | null;
    updatedAt: string | null;
    method?: string;
  }>(`statistics?${query}`, { items: [], season: null, updatedAt: null });

export const getSponsors = (youth = false) =>
  readApi<{ items: Sponsor[] }>(`sponsors${youth ? "?youth=true" : ""}`, {
    items: [],
  });
export const getAcademy = () =>
  readApi<Academy>("academy", {
    published: false,
    admissionState: "UNCONFIRMED",
    inquiriesEnabled: false,
  });
export const getTeamPage = (category: string, season?: string) =>
  readApi<TeamPageData>(
    `team-pages/${encodeURIComponent(category)}${season ? `?season=${encodeURIComponent(season)}` : ""}`,
    { published: false, category },
  );

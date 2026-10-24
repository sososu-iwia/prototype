import type { Locale } from "../i18n/config";
export type Text = Partial<Record<Locale, string>> & { kk: string };
export type Statistics = {
  id: string;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  yellowCards?: number | null;
  redCards?: number | null;
  cleanSheets?: number | null;
  source: string;
  updatedAt: string;
};
export type PlayerSeason = {
  id: string;
  seasonId: string;
  number: number | null;
  season: { id: string; name: string; current: boolean };
  statistics: Statistics | null;
};
export type Membership = {
  datesVerified?: boolean;
  id: string;
  team: Team;
  season: { id: string; name: string };
  number: number | null;
  startsAt: string;
  endsAt: string | null;
  departureReason: string | null;
  nextClub: string | null;
};
export type Player = {
  memberships?: Membership[];
  rosterNumber?: number | null;
  rosterStatus?: string;
  archivedAt?: string | null;
  achievements?: {
    id: string;
    title: Text;
    description: Text;
    year: number | null;
    verification: string;
  }[];
  id: string;
  slug: string;
  names: Text;
  biography: Text;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  photo: string | null;
  citizenship: string | null;
  birthDate: string | null;
  height: number | null;
  verification: string;
  source: string;
  sourceDate: string;
  updatedAt: string;
  seasons: PlayerSeason[];
};
export type Team = { id: string; slug: string; names: Text; managed?: boolean };
export type Match = {
  id: string;
  kickoff: string;
  homeTeam: Team;
  awayTeam: Team;
  competition: { id: string; names: Text };
  seasonId: string;
  stadium: Text;
  matchStatus: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore: number | null;
  awayScore: number | null;
  verification: string;
  source: string;
};
export type News = {
  id: string;
  slug: string;
  cover: string | null;
  images?: string[];
  publishedAt: string;
  verification: string;
  source: string;
  translations: {
    locale: Locale;
    title: string;
    excerpt: string;
    body: string;
  }[];
};
export type GalleryItem = {
  id: string;
  title: Text;
  url: string;
  poster: string | null;
  kind: "image" | "video";
};
export type Club = {
  info: {
    id: string;
    content: Record<string, Text>;
    source: string;
    verification: string;
  }[];
  achievements: {
    id: string;
    year: number | null;
    title: Text;
    description: Text;
    source: string;
    verification: string;
  }[];
  staff: {
    id: string;
    names: Text;
    title: Text;
    photo: string | null;
    group: string;
  }[];
  sections: string[];
  timezone: string;
};
export type List<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export type Standing = {
  rank: number;
  team: { id: number; name: string };
  points: number;
  goalsDiff: number;
  all: { played: number; win: number; draw: number; lose: number };
};
export type Standings = {
  rows: Standing[];
  source: string | null;
  updatedAt: string | null;
  stale: boolean;
  reason?: string;
};
export type RankedStatistic = Statistics & {
  playerSeason: PlayerSeason & { player: Player };
};

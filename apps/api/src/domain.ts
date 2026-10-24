import { z } from "zod";
export const localeSchema = z.enum(["kk", "ru", "en"]);
export const localized = z
  .object({
    kk: z.string().max(12000),
    ru: z.string().max(12000).optional(),
    en: z.string().max(12000).optional(),
  })
  .strict();
const shortLocalized = z
  .object({
    kk: z.string().min(1).max(200),
    ru: z.string().max(200).optional(),
    en: z.string().max(200).optional(),
  })
  .strict();
const id = z.string().min(1).max(80);
const source = z.string().min(1).max(1000);
const media = z
  .string()
  .regex(/^\/(?:media|uploads)\/[a-zA-Z0-9_./-]+$/)
  .max(240)
  .refine((value) => !value.split("/").includes("..") && !value.includes("//"))
  .nullable()
  .optional();
const publication = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const verification = z.enum(["LEGACY_UNVERIFIED", "VERIFIED"]);
const slug = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const utc = z.iso.datetime();
export const schemas = {
  players: z
    .object({
      rosterStatus: z
        .enum(["ACTIVE", "INJURED", "LOANED_OUT", "DEPARTED", "RETIRED"])
        .default("ACTIVE"),
      archivedAt: utc.nullable().optional(),
      slug,
      names: shortLocalized,
      biography: localized.default({ kk: "" }),
      position: z.enum(["goalkeeper", "defender", "midfielder", "forward"]),
      photo: media,
      citizenship: z.string().max(80).nullable().optional(),
      birthDate: utc.nullable().optional(),
      height: z.number().int().min(120).max(230).nullable().optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]),
      verification,
      source,
      sourceDate: utc,
    })
    .strict(),
  matches: z
    .object({
      seasonId: id,
      competitionId: id,
      homeTeamId: id,
      awayTeamId: id,
      kickoff: utc,
      stadium: localized.default({ kk: "" }),
      matchStatus: z.enum([
        "SCHEDULED",
        "LIVE",
        "FINISHED",
        "POSTPONED",
        "CANCELLED",
      ]),
      homeScore: z.number().int().min(0).max(99).nullable(),
      awayScore: z.number().int().min(0).max(99).nullable(),
      status: publication,
      verification,
      source,
      sourceDate: utc,
    })
    .strict()
    .superRefine((m, c) => {
      if (m.homeTeamId === m.awayTeamId)
        c.addIssue({ code: "custom", message: "Different teams required" });
      if ((m.homeScore === null) !== (m.awayScore === null))
        c.addIssue({
          code: "custom",
          path: ["homeScore"],
          message: "Both scores must be entered together",
        });
      if (
        ["LIVE", "FINISHED"].includes(m.matchStatus) &&
        new Date(m.kickoff) > new Date()
      )
        c.addIssue({
          code: "custom",
          path: ["kickoff"],
          message: "A played match cannot start in the future",
        });
      if (
        ["LIVE", "FINISHED"].includes(m.matchStatus) &&
        (m.homeScore === null || m.awayScore === null)
      )
        c.addIssue({
          code: "custom",
          message: "Finished match requires scores",
        });
    }),
  news: z
    .object({
      slug,
      status: publication,
      cover: media,
      images: z.array(media.unwrap().unwrap()).max(20).default([]),
      categoryId: id.nullable().optional(),
      publishedAt: utc.nullable(),
      source,
      sourceDate: utc,
      verification,
      translations: z
        .array(
          z
            .object({
              locale: localeSchema,
              title: z.string().min(1).max(200),
              excerpt: z.string().min(1).max(500),
              body: z.string().min(1).max(50000),
            })
            .strict(),
        )
        .min(1)
        .max(3),
    })
    .strict()
    .superRefine((n, c) => {
      if (
        new Set(n.translations.map((t) => t.locale)).size !==
        n.translations.length
      )
        c.addIssue({ code: "custom", message: "Duplicate locale" });
      if (!n.translations.some((t) => t.locale === "kk"))
        c.addIssue({ code: "custom", message: "Kazakh content required" });
      if (
        n.status === "PUBLISHED" &&
        (!n.publishedAt || new Date(n.publishedAt) > new Date())
      )
        c.addIssue({
          code: "custom",
          message: "Publication date required and must not be future",
        });
    }),
  gallery: z
    .object({
      title: shortLocalized,
      url: z
        .string()
        .regex(/^\/(media|uploads)\/[a-zA-Z0-9_./-]+$/)
        .max(240)
        .refine(
          (value) => !value.split("/").includes("..") && !value.includes("//"),
        ),
      poster: media,
      kind: z.enum(["image", "video"]),
      sortOrder: z.number().int().min(0).max(1000),
      status: publication,
      source,
    })
    .strict(),
  club: z
    .object({
      id: z
        .string()
        .max(80)
        .regex(/^[a-zA-Z0-9_-]+$/),
      content: z.record(z.string().max(100), localized),
      source,
      verification,
    })
    .strict(),
  staff: z
    .object({
      names: shortLocalized,
      title: shortLocalized,
      photo: media,
      group: z.enum(["management", "coaching"]),
      status: publication,
      source,
      verification,
    })
    .strict(),
  achievements: z
    .object({
      playerId: id.nullable().optional(),
      seasonId: id.nullable().optional(),
      year: z.number().int().min(1900).max(2100).nullable(),
      title: shortLocalized,
      description: localized,
      source,
      verification,
    })
    .strict(),
  seasons: z
    .object({
      id,
      name: z.string().min(1).max(100),
      current: z.boolean(),
      year: z.number().int().min(1900).max(2200).nullable().optional(),
      startsAt: utc.nullable().optional(),
      endsAt: utc.nullable().optional(),
      state: z
        .enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"])
        .default("PLANNED"),
    })
    .strict()
    .refine(
      (v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt,
      "Invalid season dates",
    )
    .refine(
      (v) => !v.current || v.state !== "ARCHIVED",
      "An archived season cannot be current",
    ),
  teams: z
    .object({
      slug,
      names: shortLocalized,
      logo: media,
      managed: z.boolean().default(false),
    })
    .strict(),
  competitions: z.object({ id, names: shortLocalized }).strict(),
  categories: z.object({ slug, names: shortLocalized }).strict(),
  "player-seasons": z
    .object({
      playerId: id,
      seasonId: id,
      teamId: id,
      number: z.number().int().min(1).max(99).nullable(),
    })
    .strict(),
  statistics: z
    .object({
      mode: z.enum(["CONFIRMED", "MATCHES"]).default("CONFIRMED"),
      verified: z.boolean().default(true),
      yellowCards: z.number().int().min(0).max(1000).nullable().optional(),
      redCards: z.number().int().min(0).max(1000).nullable().optional(),
      cleanSheets: z.number().int().min(0).max(1000).nullable().optional(),
      playerSeasonId: id,
      appearances: z.number().int().min(0).max(1000),
      goals: z.number().int().min(0).max(1000),
      assists: z.number().int().min(0).max(1000),
      minutes: z.number().int().min(0).max(100000),
      source,
    })
    .strict()
    .superRefine((v, c) => {
      if (v.mode !== "CONFIRMED") return;
      if (
        v.minutes > v.appearances * 150 ||
        (v.appearances === 0 && (v.goals > 0 || v.assists > 0)) ||
        (v.cleanSheets ?? 0) > v.appearances
      )
        c.addIssue({
          code: "custom",
          message: "Season totals are inconsistent",
        });
    }),
};
export const membershipSchema = z
  .object({
    datesVerified: z.boolean().default(true),
    cancelled: z.boolean().default(false),
    playerId: id,
    teamId: id,
    seasonId: id,
    number: z.number().int().min(1).max(99).nullable(),
    startsAt: utc,
    endsAt: utc.nullable(),
    departureReason: z.string().max(500).nullable().optional(),
    nextClub: z.string().max(200).nullable().optional(),
  })
  .strict()
  .refine(
    (v) => !v.endsAt || v.endsAt > v.startsAt,
    "Invalid membership interval",
  );
export const eventSchema = z
  .object({
    matchId: id,
    playerId: id,
    teamId: id,
    eventKey: z.string().min(8).max(100),
    minute: z.number().int().min(0).max(150),
    type: z.enum(["GOAL", "ASSIST", "YELLOW", "RED"]),
    description: localized,
    cancelled: z.boolean().default(false),
    source,
  })
  .strict();
export const matchStatisticsSchema = z
  .object({
    teamId: id.nullable().optional(),
    matchId: id,
    playerId: id,
    appearances: z.number().int().min(0).max(1),
    minutes: z.number().int().min(0).max(150),
    cleanSheets: z.number().int().min(0).max(1).nullable(),
    verified: z.boolean(),
    source,
  })
  .strict()
  .refine(
    (v) =>
      !(v.appearances === 0 && v.minutes > 0) &&
      (!v.cleanSheets || (v.appearances === 1 && v.minutes > 0)),
    "Match totals are inconsistent",
  );
export const cmsSchemas = {
  ...schemas,
  memberships: membershipSchema,
  "match-events": eventSchema,
  "match-statistics": matchStatisticsSchema,
};
export type Entity = keyof typeof cmsSchemas;
export function rankStatistics<
  T extends {
    goals: number;
    assists: number;
    appearances: number;
    minutes: number;
  },
>(rows: T[], sort: string) {
  const value = (r: T) =>
    sort === "efficiency"
      ? r.minutes > 0
        ? ((r.goals + r.assists) * 90) / r.minutes
        : 0
      : sort === "assists"
        ? r.assists
        : sort === "appearances"
          ? r.appearances
          : r.goals;
  return [...rows].sort((a, b) => value(b) - value(a) || a.minutes - b.minutes);
}
export const settingsSchema = z
  .object({
    sections: z
      .array(
        z.enum([
          "hero",
          "club-stats",
          "about",
          "matches",
          "team",
          "achievements",
          "news",
          "gallery",
          "contact",
        ]),
      )
      .max(9)
      .refine((a) => new Set(a).size === a.length),
    leagueId: z.string().regex(/^\d*$/).max(10).nullable(),
    externalSeason: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
  })
  .strict();

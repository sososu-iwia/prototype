import type { UiKey } from "../../lib/i18n/config";
export type Field = {
  key: UiKey;
  type:
    | "text"
    | "textarea"
    | "localized"
    | "number"
    | "datetime"
    | "boolean"
    | "select"
    | "relation"
    | "content"
    | "images"
    | "password";
  required?: boolean;
  values?: string[];
  entity?: string;
  nullable?: boolean;
};
const text = (key: UiKey, required = true): Field => ({
  key,
  type: "text",
  required,
});
const localized = (key: UiKey, required = true): Field => ({
  key,
  type: "localized",
  required,
});
const number = (key: UiKey, nullable = false): Field => ({
  key,
  type: "number",
  nullable,
  required: !nullable,
});
const relation = (key: UiKey, entity: string, nullable = false): Field => ({
  key,
  type: "relation",
  entity,
  nullable,
  required: !nullable,
});
const date = (key: UiKey, nullable = false): Field => ({
  key,
  type: "datetime",
  nullable,
  required: !nullable,
});
const select = (key: UiKey, values: string[]): Field => ({
  key,
  type: "select",
  values,
  required: true,
});
const publication = select("status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
const verification = select("verification", ["LEGACY_UNVERIFIED", "VERIFIED"]);
const source = [text("source"), date("sourceDate")];
export const entityFields: Record<string, Field[]> = {
  players: [
    select("rosterStatus", [
      "ACTIVE",
      "INJURED",
      "LOANED_OUT",
      "DEPARTED",
      "RETIRED",
    ]),
    date("archivedAt", true),
    text("slug"),
    localized("names"),
    localized("biography", false),
    select("position", ["goalkeeper", "defender", "midfielder", "forward"]),
    text("photo", false),
    text("citizenship", false),
    date("birthDate", true),
    number("height", true),
    select("status", ["DRAFT", "PUBLISHED"]),
    verification,
    ...source,
  ],
  matches: [
    relation("seasonId", "seasons"),
    relation("competitionId", "competitions"),
    relation("homeTeamId", "teams"),
    relation("awayTeamId", "teams"),
    date("kickoff"),
    localized("stadium", false),
    select("matchStatus", [
      "SCHEDULED",
      "LIVE",
      "FINISHED",
      "POSTPONED",
      "CANCELLED",
    ]),
    number("homeScore", true),
    number("awayScore", true),
    publication,
    verification,
    ...source,
  ],
  news: [
    text("slug"),
    text("cover", false),
    { key: "images", type: "images" },
    relation("categoryId", "categories", true),
    publication,
    date("publishedAt", true),
    verification,
    ...source,
  ],
  gallery: [
    localized("title"),
    text("url"),
    text("poster", false),
    select("kind", ["image", "video"]),
    number("sortOrder"),
    publication,
    text("source"),
  ],
  club: [
    text("id"),
    { key: "content", type: "content" },
    text("source"),
    verification,
  ],
  staff: [
    localized("names"),
    localized("title"),
    text("photo", false),
    select("group", ["management", "coaching"]),
    publication,
    text("source"),
    verification,
  ],
  achievements: [
    relation("playerId", "players", true),
    relation("seasonId", "seasons", true),
    number("year", true),
    localized("title"),
    localized("description", false),
    text("source"),
    verification,
  ],
  seasons: [
    text("id"),
    text("name"),
    number("year", true),
    date("startsAt", true),
    date("endsAt", true),
    select("state", ["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]),
    { key: "current", type: "boolean" },
  ],
  teams: [
    text("slug"),
    localized("names"),
    text("logo", false),
    { key: "managed", type: "boolean" },
  ],
  competitions: [text("id"), localized("names")],
  categories: [text("slug"), localized("names")],
  "player-seasons": [
    relation("playerId", "players"),
    relation("seasonId", "seasons"),
    relation("teamId", "teams"),
    number("number", true),
  ],
  statistics: [
    select("mode", ["CONFIRMED", "MATCHES"]),
    { key: "verified", type: "boolean" },
    number("yellowCards", true),
    number("redCards", true),
    number("cleanSheets", true),
    relation("playerSeasonId", "player-seasons"),
    number("appearances"),
    number("goals"),
    number("assists"),
    number("minutes"),
    text("source"),
  ],
  memberships: [
    { key: "cancelled", type: "boolean" },
    { key: "datesVerified", type: "boolean" },
    relation("playerId", "players"),
    relation("teamId", "teams"),
    relation("seasonId", "seasons"),
    number("number", true),
    date("startsAt"),
    date("endsAt", true),
    text("departureReason", false),
    text("nextClub", false),
  ],
  "match-events": [
    relation("matchId", "matches"),
    relation("playerId", "players"),
    relation("teamId", "teams"),
    text("eventKey"),
    number("minute"),
    select("type", ["GOAL", "ASSIST", "YELLOW", "RED"]),
    localized("description", false),
    { key: "cancelled", type: "boolean" },
    text("source"),
  ],
  "match-statistics": [
    relation("teamId", "teams", true),
    relation("matchId", "matches"),
    relation("playerId", "players"),
    number("appearances"),
    number("minutes"),
    number("cleanSheets", true),
    { key: "verified", type: "boolean" },
    text("source"),
  ],
  users: [
    text("email"),
    select("role", ["EDITOR", "ADMIN", "SUPER_ADMIN"]),
    { key: "active", type: "boolean" },
    { key: "password", type: "password" },
  ],
  media: [localized("alt", false)],
};
export function blank(entity: string) {
  const value: Record<string, unknown> = {};
  for (const field of entityFields[entity] || [])
    value[field.key] =
      field.type === "images"
        ? []
        : field.type === "localized"
          ? { kk: "", ru: "", en: "" }
          : field.type === "content"
            ? {}
            : field.type === "boolean"
              ? false
              : field.type === "number"
                ? field.nullable
                  ? null
                  : 0
                : field.type === "select"
                  ? field.values?.[0]
                  : field.type === "datetime"
                    ? field.nullable
                      ? null
                      : new Date().toISOString()
                    : field.nullable
                      ? null
                      : "";
  if (entity === "seasons" || entity === "competitions")
    value.id = crypto.randomUUID();
  if (entity === "match-events") value.eventKey = crypto.randomUUID();
  if (entity === "users") value.active = true;
  if (entity === "statistics") value.verified = true;
  if (entity === "memberships") value.datesVerified = true;
  if (entity === "news") {
    value.images = [];
  }
  if (entity === "news")
    value.translations = ["kk", "ru", "en"].map((locale) => ({
      locale,
      title: "",
      excerpt: "",
      body: "",
    }));
  return value;
}
export function editable(entity: string, row: Record<string, unknown>) {
  const draft = blank(entity);
  for (const field of entityFields[entity] || [])
    if (row[field.key] !== undefined) draft[field.key] = row[field.key];
  if (entity === "news")
    draft.translations = (
      (row.translations as Record<string, string>[]) || []
    ).map(({ locale, title, excerpt, body }) => ({
      locale,
      title,
      excerpt,
      body,
    }));
  return draft;
}

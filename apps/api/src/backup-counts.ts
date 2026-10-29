/** Only this closed table map may supply SQL identifiers; backup files cannot inject SQL. */
const tables: Record<string, string> = {
  players: "Player",
  memberships: "RosterMembership",
  articles: "NewsPost",
  matches: "Match",
  seasons: "Season",
  teams: "Team",
  achievements: "ClubAchievement",
  sponsors: "Sponsor",
  academy: "AcademyPage",
  academyInquiries: "AcademyInquiry",
  media: "MediaAsset",
  gallery: "GalleryItem",
  playerSeasons: "PlayerSeason",
  playerStatistics: "PlayerStatistics",
  matchStatistics: "PlayerMatchStatistics",
  matchEvents: "MatchEvent",
  staff: "StaffMember",
  club: "ClubInfo",
  categories: "Category",
  competitions: "Competition",
  users: "User",
  translations: "NewsTranslation",
  audit: "AuditLog",
  settings: "ClubSettings",
  standings: "LeagueStandingSnapshot",
  mutationKeys: "MutationKey",
};
export function backupCountSql(keys: readonly string[] = Object.keys(tables)) {
  if (!keys.length || keys.some((key) => !Object.hasOwn(tables, key)))
    throw new Error("Invalid backup count key");
  return (
    "SELECT " +
    keys
      .map((key) => `(SELECT count(*)::int FROM "${tables[key]}") AS "${key}"`)
      .join(",")
  );
}

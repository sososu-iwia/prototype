import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
import vm from "node:vm";
const read = (p) => readFile(p, "utf8");
// Balanced extraction is limited to object/array literals from these versioned local sources.
function literal(s, name) {
  const start = s.indexOf(`const ${name} = `);
  const from = s.indexOf("=", start) + 1;
  const to = s.indexOf(";", from);
  return vm.runInNewContext(
    "(" + s.slice(from, to) + ")",
    Object.create(null),
    { timeout: 1000 },
  );
}
const script = await read("js/script.js"),
  matchHtml = await read("matches.html");
const translations = literal(script, "translations"),
  teams = literal(matchHtml, "teams"),
  oldMatches = literal(matchHtml, "matches"),
  matchTexts = literal(matchHtml, "pageTexts");
const $ = load(await read("team.html"));
const sourceDate = "2026-09-27T00:00:00.000Z";
const players = $(".team-player-card")
  .toArray()
  .map((el) => {
    const card = $(el),
      photo = card.find("img").attr("src"),
      slug = photo
        .split("/")
        .at(-1)
        .replace(/\.[^.]+$/, "");
    const name = card.find("h3").text().replace(/\s+/g, " ").trim();
    return {
      id: `legacy-${slug}`,
      slug,
      names: {
        kk: name,
        ru: name,
        en: slug
          .split("-")
          .map((x) => x[0].toUpperCase() + x.slice(1))
          .join(" "),
      },
      biography: { kk: "", ru: "", en: "" },
      position: card.attr("data-position"),
      photo,
      number: Number(card.find(".team-player-number").text().trim()),
      status: "PUBLISHED",
      verification: "LEGACY_UNVERIFIED",
      source:
        "Legacy team.html; roster and shirt number require editorial verification",
      sourceDate,
    };
  });
// The source schedule spells Elimai as yelimai; preserve the original record and normalize its foreign key.
for (const m of oldMatches)
  if (m.opponent === "yelimai") m.opponent = "yelimay";
const matches = oldMatches.map((m, i) => ({
  id: `legacy-match-${String(i + 1).padStart(2, "0")}`,
  seasonId: "2026",
  competitionId: m.competition,
  homeTeamId: m.venue === "home" ? "ordabasy" : m.opponent,
  awayTeamId: m.venue === "home" ? m.opponent : "ordabasy",
  kickoff: new Date(`${m.date}T${m.time || "12:00"}:00+05:00`).toISOString(),
  stadium: { kk: "", ru: "", en: "" },
  matchStatus: m.status === "finished" ? "FINISHED" : "SCHEDULED",
  homeScore: m.homeScore ?? null,
  awayScore: m.awayScore ?? null,
  status: "DRAFT",
  verification: "LEGACY_UNVERIFIED",
  source: "Legacy matches.html; unverified manual schedule",
  sourceDate,
  original: m,
}));
const $$ = load(await read("index.html"));
const oldNews = $$(".main-news-card, .small-news-card")
  .toArray()
  .map((el, i) => {
    const c = $$(el);
    const titleKey = c.find("h3[data-i18n]").attr("data-i18n");
    if (!titleKey) return null;
    return {
      id: `legacy-news-${i}`,
      slug: `legacy-news-${i}`,
      status: "DRAFT",
      cover: c.find("img").attr("src"),
      publishedAt: null,
      source: "Legacy index.html; promotional copy, not verified reporting",
      sourceDate,
      verification: "LEGACY_UNVERIFIED",
      translations: ["kk", "ru", "en"].map((locale) => ({
        locale,
        title: translations[locale][titleKey],
        excerpt:
          translations[locale][`news${["One", "Two", "Three"][i]}Text`] ||
          translations[locale][titleKey],
        body:
          translations[locale][`news${["One", "Two", "Three"][i]}Text`] ||
          translations[locale][titleKey],
      })),
    };
  })
  .filter(Boolean);
const gallery = $$(".gallery-item")
  .toArray()
  .map((el, i) => {
    const c = $$(el),
      key = c.find("h3").attr("data-i18n");
    return {
      id: `legacy-gallery-${i + 1}`,
      title: Object.fromEntries(
        ["kk", "ru", "en"].map((l) => [l, translations[l][key] || key]),
      ),
      url:
        c.find("source").attr("src")?.replace(".mp4", ".MP4") ||
        c.find("img").attr("src"),
      kind: c.find("video").length ? "video" : "image",
      sortOrder: i,
      status: "PUBLISHED",
      source: "Legacy index.html; original media",
    };
  });
await mkdir("packages/content", { recursive: true });
await mkdir("apps/web/messages", { recursive: true });
for (const locale of ["kk", "ru", "en"]) {
  const site = Object.fromEntries(
    Object.entries(translations[locale]).map(([k, v]) => [
      k,
      String(v)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, ""),
    ]),
  );
  await writeFile(
    `packages/content/legacy-${locale}.json`,
    JSON.stringify(site, null, 2),
  );
  await writeFile(
    `packages/content/matches-${locale}.json`,
    JSON.stringify(matchTexts[locale], null, 2),
  );
}
const content = {
  sourceDate,
  players,
  matches,
  teams: Object.entries(teams).map(([slug, names]) => ({
    id: slug,
    slug,
    names,
  })),
  news: oldNews,
  gallery,
};
await writeFile(
  "packages/content/legacy-import.json",
  JSON.stringify(content, null, 2),
);
console.log(
  JSON.stringify({
    players: players.length,
    matches: matches.length,
    news: oldNews.length,
    gallery: gallery.length,
  }),
);

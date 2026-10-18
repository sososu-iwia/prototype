import subsetFont from "subset-font";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
const legacy = JSON.parse(
  await readFile("packages/content/legacy-import.json", "utf8"),
);
const manifest = JSON.parse(
  await readFile("packages/content/media-manifest.json", "utf8"),
);
const image = (path, width = 640) =>
  manifest[path]?.variants.find((v) => v.width === width)?.url ||
  manifest[path]?.variants.at(-1)?.url ||
  null;
const season = { id: "2026", name: "2026", current: true };
const players = legacy.players.map((p) => ({
  ...p,
  photo: image(p.photo),
  citizenship: null,
  birthDate: null,
  height: null,
  updatedAt: legacy.sourceDate,
  seasons: [
    {
      id: `season-${p.slug}`,
      seasonId: season.id,
      season,
      number: p.number,
      statistics: null,
    },
  ],
}));
const gallery = legacy.gallery.map((p) => ({
  ...p,
  url: p.kind === "video" ? "/media/gallery1.mp4" : image(p.url, 960),
  poster: p.kind === "video" ? "/media/gallery1-poster.webp" : null,
}));
const title = {
  kk: "Сайттың мұрағаттық деректері туралы",
  ru: "Об архивных данных сайта",
  en: "About the website archive",
};
const body = {
  kk: "Бұл сайттың бастапқы нұсқасындағы құрам, матчтар және тарихи мәтіндер мұрағат ретінде сақталған. Олардың бір бөлігі редакциялық тексеруді қажет етеді. Расталмаған матчтар мен бұрынғы жаңалық жобалары жаңа жаңалық ретінде жарияланбайды. Көрсетілмеген ойыншы көрсеткіштері белгісіз болып қалады.",
  ru: "Состав, матчи и исторические тексты из первоначальной версии сайта сохранены в архиве. Часть этих материалов требует редакционной проверки. Неподтверждённые матчи и старые черновики новостей не публикуются как новые сообщения. Отсутствующие показатели игроков остаются неизвестными.",
  en: "The squad, fixtures and historical copy from the original website are retained in an archive. Some of this material requires editorial review. Unverified fixtures and old news drafts are not published as new reporting. Missing player statistics remain unknown.",
};
const news = [
  {
    id: "archive-notice",
    slug: "website-archive",
    status: "PUBLISHED",
    cover: image("images/news1.jpg", 960),
    publishedAt: "2026-10-18T19:00:00.000Z",
    verification: "VERIFIED",
    source: "Original repository: team.html, matches.html, index.html",
    sourceDate: legacy.sourceDate,
    translations: ["kk", "ru", "en"].map((locale) => ({
      locale,
      title: title[locale],
      excerpt: body[locale].split(". ")[0] + ".",
      body: body[locale],
    })),
  },
];
const dictionaries = Object.fromEntries(
  await Promise.all(
    ["kk", "ru", "en"].map(async (l) => [
      l,
      JSON.parse(await readFile(`packages/content/legacy-${l}.json`, "utf8")),
    ]),
  ),
);
const content = Object.fromEntries(
  Object.keys(dictionaries.kk).map((k) => [
    k,
    Object.fromEntries(
      ["kk", "ru", "en"].map((l) => [
        l,
        dictionaries[l][k] || dictionaries.kk[k],
      ]),
    ),
  ]),
);
const achievements = [
  ["championTitle", "championText", 2023],
  ["cupTitle", "cupText", 2011],
  ["leagueTitle", "leagueText", null],
  ["historyTitle", "historyText", 2000],
].map(([k, d, year], i) => ({
  id: `legacy-achievement-${i}`,
  title: content[k],
  description: content[d],
  year,
  source: "Legacy index.html; pending verification",
  verification: "LEGACY_UNVERIFIED",
}));
const club = {
  info: [
    {
      id: "main",
      content,
      source:
        "Legacy index.html / about.html; historical claims pending verification",
      verification: "LEGACY_UNVERIFIED",
    },
  ],
  achievements,
  staff: [],
  sections: [
    "hero",
    "club-stats",
    "about",
    "matches",
    "team",
    "achievements",
    "news",
    "gallery",
    "contact",
  ],
  timezone: "Asia/Almaty",
};
const snapshot = {
  players,
  news,
  gallery,
  club,
  seasons: [season],
  competitions: [
    {
      id: "league",
      names: {
        kk: "Қазақстан Премьер-Лигасы",
        ru: "Премьер-лига Казахстана",
        en: "Kazakhstan Premier League",
      },
    },
    {
      id: "cup",
      names: {
        kk: "Қазақстан Кубогы",
        ru: "Кубок Казахстана",
        en: "Kazakhstan Cup",
      },
    },
  ],
};
await writeFile(
  "packages/content/public-snapshot.json",
  JSON.stringify(snapshot, null, 2),
);
await mkdir("apps/web/public/fonts", { recursive: true });
const css = await readFile(
  "node_modules/@fontsource-variable/noto-sans/index.css",
  "utf8",
);
const blocks = css
  .split(/(?=\/\* noto-sans-)/)
  .filter((b) => /noto-sans-(cyrillic-ext|cyrillic|latin)-wght-normal/.test(b));
await writeFile(
  "apps/web/styles/fonts.css",
  blocks.join("\n").replaceAll("./files/", "/fonts/"),
);
for (const subset of ["cyrillic-ext", "cyrillic", "latin"]) {
  const name = `noto-sans-${subset}-wght-normal.woff2`;
  await copyFile(
    `node_modules/@fontsource-variable/noto-sans/files/${name}`,
    `apps/web/public/fonts/${name}`,
  );
}
const kazakh = "ӘәҒғҚқҢңӨөҰұҮүҺһІі";
const extPath =
  "apps/web/public/fonts/noto-sans-cyrillic-ext-wght-normal.woff2";
const originalExt = await readFile(extPath);
const compactExt = await subsetFont(originalExt, kazakh, {
  targetFormat: "woff2",
  preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14],
});
await writeFile(extPath, compactExt);
await writeFile(
  "docs/FONT_REPORT.json",
  JSON.stringify(
    {
      cyrillicExtBefore: originalExt.length,
      cyrillicExtAfter: compactExt.length,
      characters: kazakh,
    },
    null,
    2,
  ),
);
await copyFile(
  "node_modules/@fontsource-variable/noto-sans/LICENSE",
  "apps/web/public/fonts/OFL.txt",
);
console.log("Public outage snapshot and licensed local fonts prepared");

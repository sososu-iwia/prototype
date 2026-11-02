import { db } from "./db";
import { mutationLock } from "./cms";
const titleSource =
  "https://eurasia.football/en/news-en/ordabasy-kazakhstan-premier-league-champions-2026/";
const text = (kk: string, ru: string, en: string) => ({ kk, ru, en });
/** Safe on existing installations: never overwrite editor content or create duplicate honours. */
export async function seedPremium() {
  await db.$transaction(
    async (tx) => {
      await mutationLock(tx);
      for (const year of [2026, 2023]) {
        const existing = await tx.clubAchievement.findFirst({
          where: {
            playerId: null,
            year,
            OR: [
              { competitionKey: "kazakhstan-premier-league" },
              {
                title: {
                  path: ["en"],
                  string_contains: "Champion",
                  mode: "insensitive",
                },
              },
              {
                title: {
                  path: ["kk"],
                  string_contains: "чемпион",
                  mode: "insensitive",
                },
              },
              {
                title: {
                  path: ["ru"],
                  string_contains: "чемпион",
                  mode: "insensitive",
                },
              },
            ],
          },
          orderBy: { id: "asc" },
        });
        if (existing) {
          // The untouched imported 2023 row can now be verified against the supplied report.
          if (
            existing.id === "legacy-achievement-0" &&
            existing.source === "Legacy index.html; pending verification" &&
            year === 2023
          ) {
            await tx.clubAchievement.update({
              where: { id: existing.id },
              data: {
                competitionKey: "kazakhstan-premier-league",
                achievementType: "LEAGUE",
                verification: "VERIFIED",
                status: "PUBLISHED",
                source: titleSource,
                version: { increment: 1 },
              },
            });
            continue;
          }
          // Classify an existing historical record without changing its editorial text or publication choice.
          if (!existing.competitionKey)
            await tx.clubAchievement.update({
              where: { id: existing.id },
              data: {
                competitionKey: "kazakhstan-premier-league",
                achievementType: "LEAGUE",
                version: { increment: 1 },
              },
            });
        } else
          await tx.clubAchievement.create({
            data: {
              id: `ordabasy-kpl-${year}`,
              clubKey: "ordabasy",
              competitionKey: "kazakhstan-premier-league",
              achievementType: "LEAGUE",
              year,
              title: text(
                "Қазақстан чемпионы",
                "Чемпион Казахстана",
                "Kazakhstan champions",
              ),
              description:
                year === 2026
                  ? text(
                      "Клуб тарихындағы екінші Премьер-лига чемпиондығы. 26 қазан 2026.",
                      "Второй титул Премьер-лиги в истории клуба. 26 октября 2026.",
                      "The club’s second Premier League title. 26 October 2026.",
                    )
                  : text(
                      "Клубтың алғашқы Премьер-лига чемпиондығы.",
                      "Первое чемпионство клуба в Премьер-лиге.",
                      "The club’s first Premier League title.",
                    ),
              source: titleSource,
              verification: "VERIFIED",
              status: "PUBLISHED",
            },
          });
      }
      const cup = await tx.clubAchievement.findUnique({
        where: { id: "legacy-achievement-1" },
      });
      if (
        cup?.year === 2011 &&
        cup.source === "Legacy index.html; pending verification" &&
        !(await tx.clubAchievement.findFirst({
          where: {
            playerId: null,
            clubKey: "ordabasy",
            competitionKey: "kazakhstan-cup",
            year: 2011,
          },
        }))
      )
        await tx.clubAchievement.update({
          where: { id: cup.id },
          data: {
            competitionKey: "kazakhstan-cup",
            achievementType: "CUP",
            status: "PUBLISHED",
            verification: "VERIFIED",
            source: "https://pfl.kz/kaz/cup_kaz_2011/",
            version: { increment: 1 },
          },
        });
      const first = await tx.team.findUnique({ where: { slug: "ordabasy" } });
      if (
        first &&
        !first.category &&
        !(await tx.team.findUnique({ where: { category: "first-team" } }))
      )
        await tx.team.update({
          where: { id: first.id },
          data: {
            category: "first-team",
            status: "PUBLISHED",
            verification: "VERIFIED",
            source: titleSource,
            version: { increment: 1 },
          },
        });
      for (const [category, slug, names, published] of [
        [
          "first-league",
          "ordabasy-first-league",
          text("Бірінші лига", "Первая лига", "First League"),
          false,
        ],
        [
          "second-league",
          "ordabasy-m",
          text("Ордабасы М", "Ордабасы М", "Ordabasy M"),
          true,
        ],
      ] as const) {
        if (await tx.team.findUnique({ where: { category } })) continue;
        const old = await tx.team.findUnique({ where: { slug } });
        if (old) {
          if (!old.category)
            await tx.team.update({
              where: { id: old.id },
              data: { category, version: { increment: 1 } },
            });
          continue;
        }
        await tx.team.create({
          data: {
            slug,
            names,
            managed: true,
            category,
            status: published ? "PUBLISHED" : "DRAFT",
            verification: published ? "VERIFIED" : "LEGACY_UNVERIFIED",
            source: published
              ? "https://kffleague.kz/ru/matches/1536"
              : "Pending club approval",
            overview: published
              ? text(
                  "2026 жылы Екінші лигаға қатысқан жастар командасы.",
                  "Молодёжная команда — участник Второй лиги 2026 года.",
                  "The youth team participated in the 2026 Second League.",
                )
              : text(
                  "Клубтың растауын күтуде.",
                  "Ожидает подтверждения клуба.",
                  "Awaiting club confirmation.",
                ),
          },
        });
      }
      await tx.academyPage.upsert({
        where: { id: "main" },
        update: {},
        create: {
          id: "main",
          source: "Pending club editorial approval",
          content: Object.fromEntries(
            [
              "introduction",
              "philosophy",
              "ageGroups",
              "coaches",
              "facilities",
              "programs",
              "requirements",
              "trials",
              "schedule",
              "nextSteps",
              "faq",
              "privacyNotice",
            ].map((k) => [k, text("", "", "")]),
          ),
        },
      });
      const sponsors = [
        ["Bank RBK", "bank-rbk", true],
        ["Eurasia", "eurasia", false],
        ["Integra Construction", "integra", false],
        ["ERG", "erg", false],
        ["SCAT Airlines", "scat", false],
        ["Global Coffee", "global-coffee", false],
        ["City Hotel", "city-hotel", false],
        ["World Class Shymkent", null, false],
        ["ESEN", null, false],
        ["OLIMPBET", null, false],
      ] as const;
      for (const [index, [name, asset, verified]] of sponsors.entries())
        await tx.sponsor.upsert({
          where: { name },
          update: {},
          create: {
            name,
            logo: asset ? `/media/sponsors/${asset}.webp` : null,
            description: { kk: "" },
            status: verified ? "PUBLISHED" : "DRAFT",
            sortOrder: index,
            logoApproved: verified,
            youthSafe: false,
            ...(verified
              ? {
                  validFrom: null,
                  validUntil: new Date("2027-01-01T00:00:00Z"),
                  verificationSource:
                    "https://tengrinews.kz/kazakhstan_news/pervoy-raketki-mira-7-500-begunov-kakie-sportivnyie-608459/amp/",
                  verifiedAt: new Date(),
                }
              : {}),
          },
        });
    },
    { maxWait: 15000, timeout: 120000 },
  );
}

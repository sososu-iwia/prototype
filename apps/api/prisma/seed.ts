import "../src/config";
import { Prisma } from "@prisma/client";
import { db } from "../src/db";
import snapshot from "../../../packages/content/public-snapshot.json";
import legacy from "../../../packages/content/legacy-import.json";
const image = (file: string | undefined) =>
  file
    ? `/media/${file
        .replace(/^images\//, "")
        .replace(/\.[^.]+$/, "")
        .replaceAll("/", "-")
        .toLowerCase()}-640.webp`
    : null;
async function main() {
  await db.$transaction(
    async (tx) => {
      if (await tx.clubSettings.findUnique({ where: { id: "main" } })) return;
      for (const season of snapshot.seasons)
        await tx.season.upsert({
          where: { id: season.id },
          create: {
            ...season,
            year: Number(season.id),
            state: season.current ? "ACTIVE" : "COMPLETED",
          },
          update: {},
        });
      for (const team of legacy.teams)
        await tx.team.upsert({
          where: { id: team.id },
          create: { ...team, managed: team.slug === "ordabasy" },
          update: {},
        });
      for (const competition of snapshot.competitions)
        await tx.competition.upsert({
          where: { id: competition.id },
          create: competition,
          update: {},
        });
      for (const p of snapshot.players) {
        const data = {
          id: p.id,
          slug: p.slug,
          names: p.names,
          biography: p.biography,
          position: p.position,
          photo: p.photo,
          status: "PUBLISHED" as const,
          verification: "LEGACY_UNVERIFIED" as const,
          source: p.source,
          sourceDate: new Date(p.sourceDate),
        };
        await tx.player.upsert({
          where: { id: p.id },
          create: data,
          update: {},
        });
        await tx.playerSeason.upsert({
          where: { playerId_seasonId: { playerId: p.id, seasonId: "2026" } },
          create: {
            id: p.seasons[0].id,
            playerId: p.id,
            seasonId: "2026",
            teamId: "ordabasy",
            number: p.number,
          },
          update: {},
        });
        await tx.rosterMembership.create({
          data: {
            playerId: p.id,
            teamId: "ordabasy",
            seasonId: "2026",
            number: p.number,
            startsAt: new Date(p.sourceDate),
            datesVerified: false,
            departureReason: "Legacy snapshot; exact joining date unverified",
          },
        });
      }
      for (const m of legacy.matches) {
        const { original: _original, ...data } = m;
        await tx.match.upsert({
          where: { id: m.id },
          create: {
            ...data,
            matchStatus: m.matchStatus,
            status: "DRAFT",
            verification: "LEGACY_UNVERIFIED",
          },
          update: {},
        });
      }
      for (const post of [...legacy.news, ...snapshot.news]) {
        const { translations, ...data } = post;
        await tx.newsPost.upsert({
          where: { id: post.id },
          create: {
            ...data,
            cover:
              "cover" in post && post.cover?.startsWith("images/")
                ? image(post.cover)
                : post.cover,
            status: post.status as "DRAFT" | "PUBLISHED",
            verification: post.verification as "LEGACY_UNVERIFIED" | "VERIFIED",
            translations: { create: translations },
          },
          update: {},
        });
      }
      for (const item of snapshot.gallery)
        await tx.galleryItem.upsert({
          where: { id: item.id },
          create: { ...item, status: "PUBLISHED" },
          update: {},
        });
      for (const info of snapshot.club.info)
        await tx.clubInfo.upsert({
          where: { id: info.id },
          create: {
            ...info,
            content: info.content as Prisma.InputJsonValue,
            verification: "LEGACY_UNVERIFIED",
          },
          update: {},
        });
      for (const a of snapshot.club.achievements)
        await tx.clubAchievement.upsert({
          where: { id: a.id },
          create: { ...a, verification: "LEGACY_UNVERIFIED" },
          update: {},
        });
      await tx.clubSettings.upsert({
        where: { id: "main" },
        create: {
          id: "main",
          sections: snapshot.club.sections,
          timezone: snapshot.club.timezone,
        },
        update: {},
      });
    },
    // The one-off Render Free release connects over external TLS. Its initial
    // transaction acquisition and seed round trips need a bounded WAN budget.
    { maxWait: 15000, timeout: 120000 },
  );
  console.log(
    "Imported 20 archive players, 36 draft matches, 3 draft articles, 6 gallery items. No fabricated statistics. Existing editorial changes retained.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

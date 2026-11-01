import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Player, RosterImportRecord } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { audit, expectedVersion, mutationLock } from "./cms";
import type { AuthRequest } from "./auth";
import {
  referenceMapping,
  sourcePosition,
  normalizeName,
  kffUrl,
  kffSeason,
  type KffSnapshot,
  positionCodes,
} from "./kff-reference";
import { recordStaffRevision } from "./staff-history";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const text = (kk: string, ru = kk, en = ru) => ({ kk, ru, en });
const namesOf = (player: Player) =>
  Object.values(player.names as Record<string, string>);
export function requireTestImport(connection = process.env.DATABASE_URL) {
  let name = "";
  try {
    name = new URL(connection || "").pathname.slice(1);
  } catch {
    /* rejected */
  }
  if (!/(?:^|[_-])test(?:[_-]|$)/i.test(name) || !/^[a-z0-9_-]+$/i.test(name))
    throw new Error(
      "KFF apply requires an isolated database with a distinct test marker; production apply is not enabled",
    );
}
export async function planKffImport(
  tx: Prisma.TransactionClient,
  snapshot: KffSnapshot,
) {
  const [players, teams, existing] = await Promise.all([
    tx.player.findMany(),
    tx.team.findMany({
      where: { category: { in: ["first-team", "second-league"] } },
    }),
    tx.rosterImportRecord.findMany({ where: { seasonId: kffSeason } }),
  ]);
  return snapshot.roster.map((source) => {
    const referenceKey = `kff-2026-${source.number}`;
    const old = existing.find((r) => r.referenceKey === referenceKey);
    const mapping = referenceMapping.find((m) => m.sourceName === source.name)!;
    const player = old?.playerId
      ? players.find((p) => p.id === old.playerId)
      : mapping.localSlug
        ? players.find(
            (p) =>
              p.slug === mapping.localSlug &&
              p.id === mapping.expectedLegacyId &&
              namesOf(p).some((n) => mapping.expectedLegacyNames.includes(n)),
          )
        : undefined;
    const profile = source.profile;
    const available = profile.retrieval === "page_metadata";
    const position =
      sourcePosition(source.positionLabel) ||
      (available ? sourcePosition(profile.positionLabel) : null);
    const profilePosition = available
      ? sourcePosition(profile.positionLabel)
      : null;
    const category =
      profile.teamLabel === "Ордабасы"
        ? "first-team"
        : profile.teamLabel === "Ордабасы М"
          ? "second-league"
          : null;
    const team = teams.find((t) => t.category === category);
    const conflicts: string[] = [];
    if (!available) conflicts.push("PROFILE_UNAVAILABLE");
    if (category === "second-league") conflicts.push("AFFILIATION_CONFLICT");
    if (!category) conflicts.push("AFFILIATION_UNCONFIRMED");
    if (mapping.identityRequiresReview) conflicts.push("IDENTITY_ALIAS_REVIEW");
    if (mapping.localSlug && !player) conflicts.push("LOCAL_IDENTITY_CHANGED");
    if (!position) conflicts.push("POSITION_UNKNOWN");
    if (
      profilePosition &&
      sourcePosition(source.positionLabel) &&
      position !== profilePosition
    )
      conflicts.push("POSITION_SOURCE_CONFLICT");
    if (player && position && player.position !== position)
      conflicts.push("CANONICAL_POSITION_CONFLICT");
    const duplicateCandidates = !player
      ? players.filter((p) =>
          namesOf(p).some(
            (name) => normalizeName(name) === normalizeName(source.name),
          ),
        )
      : [];
    if (duplicateCandidates.length) conflicts.push("POSSIBLE_DUPLICATE");
    return {
      referenceKey,
      source,
      player,
      newSlug: mapping.newSlug,
      team,
      position,
      positionSource: sourcePosition(source.positionLabel)
        ? snapshot.sourceUrl
        : profile.url,
      conflicts: old ? (old.conflicts as string[]) : conflicts,
      existing: old,
      matchKind: player
        ? mapping.identityRequiresReview
          ? "ALIAS_REVIEW"
          : "REFERENCE_MATCH"
        : mapping.newSlug && !duplicateCandidates.length
          ? "NEW"
          : "UNRESOLVED",
    };
  });
}

export const reviewSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "DEFER", "EDIT"]),
    notes: z.string().max(2000).default(""),
    playerId: z.string().min(1).max(100).optional(),
    teamId: z.string().min(1).max(100).optional(),
    position: z.enum(positionCodes).optional(),
    positionSource: z.enum(["TEAM", "PROFILE", "LOCAL"]).optional(),
    publishPlayer: z.boolean().default(false),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;

export async function reviewKffRecord(
  tx: Prisma.TransactionClient,
  id: string,
  input: Review,
  req: AuthRequest,
) {
  const before = await tx.rosterImportRecord.findUnique({ where: { id } });
  if (!before) throw new NotFoundException({ code: "NOT_FOUND" });
  expectedVersion(req, before);
  if (
    input.action === "APPROVE" &&
    (before.conflicts as string[]).length &&
    input.notes.trim().length < 10
  )
    throw new BadRequestException({ code: "REVIEW_NOTE_REQUIRED" });
  const playerId = input.playerId || before.playerId,
    teamId = input.teamId || before.teamId;
  const player = playerId
    ? await tx.player.findUnique({ where: { id: playerId } })
    : null;
  const team = teamId
    ? await tx.team.findUnique({ where: { id: teamId } })
    : null;
  if (
    input.playerId &&
    input.playerId !== before.playerId &&
    (!player ||
      !namesOf(player).some(
        (name) => normalizeName(name) === normalizeName(before.sourceName),
      ))
  )
    throw new ConflictException({ code: "IDENTITY_REVIEW_REQUIRED" });
  if (before.profileTeam === "Ордабасы М" && team?.category === "first-team")
    throw new ConflictException({ code: "KFF_TEAM_CONFLICT" });
  const position = input.position || before.position;
  const positionSource =
    input.positionSource === "PROFILE"
      ? before.profileUrl
      : input.positionSource === "LOCAL"
        ? player?.source
        : input.positionSource === "TEAM"
          ? before.sourceUrl
          : before.positionSource;
  if (
    ["APPROVE", "EDIT"].includes(input.action) &&
    input.teamId &&
    (!team || !["first-team", "second-league"].includes(team.category || ""))
  )
    throw new BadRequestException({ code: "INVALID_RELATION" });
  if (input.action === "APPROVE") {
    if (
      !player ||
      !team ||
      !position ||
      !positionSource ||
      (before.conflicts as string[]).includes("PROFILE_UNAVAILABLE")
    )
      throw new ConflictException({ code: "SOURCE_REVIEW_REQUIRED" });
    if (player.archivedAt || player.status === "ARCHIVED")
      throw new ConflictException({ code: "HISTORY_PROTECTED" });
    if (input.publishPlayer) {
      if (
        before.matchKind !== "NEW" ||
        player.source !== kffUrl ||
        player.birthDate ||
        player.height ||
        Object.values(player.biography as Record<string, string>).some(Boolean)
      )
        throw new ForbiddenException({
          code: "EDITORIAL_PUBLICATION_REQUIRED",
        });
      await tx.player.update({
        where: { id: player.id },
        data: {
          status: "PUBLISHED",
          verification: "VERIFIED",
          version: { increment: 1 },
        },
      });
    }
    const period = await tx.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId: player.id, seasonId: before.seasonId },
      },
    });
    if (period && period.teamId !== team.id)
      throw new ConflictException({ code: "HISTORY_PROTECTED" });
    if (!period)
      await tx.playerSeason.create({
        data: {
          playerId: player.id,
          seasonId: before.seasonId,
          teamId: team.id,
          number: before.shirtNumber,
        },
      });
    // No RosterMembership is created: the snapshot does not establish contract dates.
    const aliases = Array.isArray(player.aliases)
      ? player.aliases.filter((v): v is string => typeof v === "string")
      : [];
    if (
      !namesOf(player).includes(before.sourceName) &&
      !aliases.includes(before.sourceName)
    ) {
      await tx.player.update({
        where: { id: player.id },
        data: {
          aliases: [...aliases, before.sourceName],
          version: { increment: 1 },
        },
      });
      await audit(
        tx,
        req,
        "players",
        player.id,
        "ADD_SOURCE_ALIAS",
        { aliases },
        { aliases: [...aliases, before.sourceName] },
      );
    }
  }
  const saved = await tx.rosterImportRecord.update({
    where: { id, version: before.version },
    data: {
      playerId,
      teamId,
      position,
      positionSource,
      reviewStatus:
        input.action === "APPROVE"
          ? "APPROVED"
          : input.action === "REJECT"
            ? "REJECTED"
            : input.action === "DEFER"
              ? "DEFERRED"
              : "PENDING",
      reviewNotes: input.notes,
      reviewedBy: req.auth.userId,
      reviewedAt: new Date(),
      version: { increment: 1 },
    },
  });
  await audit(tx, req, "kff-review", id, input.action, before, saved);
  return saved;
}

const importRequest = (version: number): AuthRequest =>
  ({
    auth: {
      userId: "kff-2026-test-import",
      role: "ADMIN",
      sessionId: "test-import",
    },
    header: (name: string) =>
      name === "if-match" ? String(version) : undefined,
  }) as AuthRequest;
export async function applyKffToTest(
  snapshot: KffSnapshot,
  publishConfirmedToTest = false,
) {
  requireTestImport();
  const version = await db.$queryRaw<
    { version: string }[]
  >`SELECT current_setting('server_version_num') AS version`;
  if (Number(version[0].version) < 170000)
    throw new Error("Use PostgreSQL 17+ for the isolated KFF staging import");
  return db.$transaction(
    async (tx) => {
      await mutationLock(tx);
      const plan = await planKffImport(tx, snapshot);
      let playersAdded = 0,
        recordsAdded = 0,
        coachesAdded = 0,
        staffDraftsAdded = 0,
        approved = 0;
      for (const item of plan) {
        if (item.existing) continue; // Never overwrite source decisions or editor fields on replay.
        let player = item.player;
        if (!player && item.matchKind === "NEW" && item.newSlug) {
          if (await tx.player.findUnique({ where: { slug: item.newSlug } }))
            throw new ConflictException({ code: "IMPORT_SLUG_CONFLICT" });
          player = await tx.player.create({
            data: {
              slug: item.newSlug,
              names: text(item.source.name),
              position: item.position || "unknown",
              citizenship: item.source.country,
              rosterStatus: "UNCONFIRMED",
              status: "DRAFT",
              verification: "LEGACY_UNVERIFIED",
              source: kffUrl,
              sourceDate: new Date(snapshot.sourceCapturedAt),
            },
          });
          playersAdded++;
        }
        const profile = item.source.profile;
        const record = await tx.rosterImportRecord.create({
          data: {
            referenceKey: item.referenceKey,
            profileExternalId: "id" in profile ? profile.id : null,
            seasonId: kffSeason,
            playerId: player?.id,
            teamId: item.team?.id,
            sourceUrl: kffUrl,
            profileUrl: profile.url,
            sourceCapturedAt: new Date(snapshot.sourceCapturedAt),
            sourceName: item.source.name,
            sourcePosition: item.source.positionLabel,
            sourceNationality: item.source.country,
            shirtNumber: item.source.number,
            profileTeam: profile.teamLabel,
            profilePosition: profile.positionLabel,
            position: item.position,
            positionSource: item.positionSource,
            evidence: json({
              source: item.source,
              captureMethod: snapshot.captureMethod,
              contractDatesConfirmed: false,
              referenceMapping: referenceMapping.find(
                (m) => m.sourceName === item.source.name,
              ),
            }),
            conflicts: item.conflicts,
            proposedAliases:
              player && !namesOf(player).includes(item.source.name)
                ? [item.source.name]
                : [],
            matchKind: item.matchKind,
          },
        });
        recordsAdded++;
        await audit(
          tx,
          importRequest(1),
          "kff-review",
          record.id,
          "IMPORT",
          null,
          record,
        );
        if (
          publishConfirmedToTest &&
          !item.conflicts.length &&
          item.team?.category === "first-team" &&
          player &&
          (player.status === "PUBLISHED" || item.matchKind === "NEW")
        ) {
          await reviewKffRecord(
            tx,
            record.id,
            {
              action: "APPROVE",
              notes:
                "Verified source-only season snapshot in isolated QA; no active contract inferred.",
              publishPlayer: item.matchKind === "NEW",
            },
            importRequest(record.version),
          );
          approved++;
        }
      }
      const first = await tx.team.findUniqueOrThrow({
        where: { category: "first-team" },
      });
      for (const coach of snapshot.coaches) {
        const key = "kff-2026-coach-" + coach.key;
        const aliases = [
          coach.name,
          ...coach.aliases,
          ...(coach.nameKk ? [coach.nameKk] : []),
        ];
        const existing = await tx.staffMember.findMany();
        if (
          existing.some(
            (s) =>
              s.externalKey === key ||
              Object.values(s.names as Record<string, string>).some((n) =>
                aliases.some((a) => normalizeName(a) === normalizeName(n)),
              ),
          )
        )
          continue;
        const head = coach.roleCode === "HEAD_COACH";
        const member = await tx.staffMember.create({
          data: {
            externalKey: key,
            names: text(coach.nameKk || coach.name, coach.name),
            title: head
              ? text("Бас бапкер", "Главный тренер", "Head coach")
              : text(
                  "Бас бапкердің көмекшісі",
                  "Помощник тренера",
                  "Assistant coach",
                ),
            group: "coaching",
            teamId: first.id,
            sourceSeasonId: kffSeason,
            roleCode: coach.roleCode,
            nationality: coach.country,
            aliases: coach.aliases,
            sortOrder: coach.sortOrder,
            source: kffUrl,
            sourceUrl: kffUrl,
            sourceCapturedAt: new Date(snapshot.sourceCapturedAt),
            status: publishConfirmedToTest ? "PUBLISHED" : "DRAFT",
            verification: "VERIFIED",
          },
        });
        await recordStaffRevision(tx, member.id);
        await audit(
          tx,
          importRequest(1),
          "staff",
          member.id,
          "IMPORT_VERIFIED_SOURCE",
          null,
          member,
        );
        coachesAdded++;
      }
      for (const candidate of snapshot.clubStaffCandidates) {
        const key = "club-2026-review-" + candidate.key;
        const existing = await tx.staffMember.findMany();
        if (
          existing.some(
            (s) =>
              s.externalKey === key ||
              Object.values(s.names as Record<string, string>).some(
                (n) => normalizeName(n) === normalizeName(candidate.name),
              ),
          )
        )
          continue;
        const member = await tx.staffMember.create({
          data: {
            externalKey: key,
            names: text(candidate.name),
            title: text(
              "Рөлді клуб растауы керек",
              "Роль требует подтверждения клуба",
              "Role awaiting club approval",
            ),
            group: "coaching",
            teamId: first.id,
            sourceSeasonId: kffSeason,
            source: snapshot.clubSourceUrl + " — " + candidate.role,
            sourceUrl: snapshot.clubSourceUrl,
            sourceCapturedAt: new Date(snapshot.sourceCapturedAt),
            status: "DRAFT",
            verification: "LEGACY_UNVERIFIED",
            sortOrder: 100,
          },
        });
        await recordStaffRevision(tx, member.id);
        staffDraftsAdded++;
      }
      return {
        playersAdded,
        recordsAdded,
        coachesAdded,
        staffDraftsAdded,
        approved,
        membershipsAdded: 0,
      };
    },
    { timeout: 30000 },
  );
}

export function publicRegistration(
  record: Pick<
    RosterImportRecord,
    | "id"
    | "seasonId"
    | "shirtNumber"
    | "sourceName"
    | "position"
    | "sourceUrl"
    | "profileUrl"
    | "sourceCapturedAt"
  >,
) {
  return {
    id: record.id,
    seasonId: record.seasonId,
    number: record.shirtNumber,
    sourceName: record.sourceName,
    position: record.position,
    sourceUrl: record.sourceUrl,
    profileUrl: record.profileUrl,
    sourceCapturedAt: record.sourceCapturedAt,
    contractDatesConfirmed: false,
  };
}

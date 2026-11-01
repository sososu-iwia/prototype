import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { db } from "../apps/api/src/db";
import { applyKffToTest, planKffImport } from "../apps/api/src/kff-import";
import {
  checkLiveKff,
  compareReferenceCsv,
  loadKffSnapshot,
} from "../apps/api/src/kff-reference";

const args = process.argv.slice(2);
const value = (key: string) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
async function main() {
  try {
    if (args.includes("--apply"))
      throw new Error(
        "Production apply is disabled. Use a reviewed release procedure; --apply-to-test only accepts an isolated test database.",
      );
    const snapshot = await loadKffSnapshot(value("--source-snapshot"));
    await compareReferenceCsv(snapshot);
    if (args.includes("--refresh")) await checkLiveKff(snapshot);
    const before = await planKffImport(db, snapshot);
    const changes = args.includes("--apply-to-test")
      ? await applyKffToTest(
          snapshot,
          args.includes("--publish-confirmed-to-test"),
        )
      : null;
    const report = {
      capturedAt: snapshot.sourceCapturedAt,
      source: snapshot.sourceUrl,
      sourceMethod: snapshot.captureMethod,
      dryRun: !changes,
      changes,
      referencePlayers: before.length,
      proposedMatches: before.filter((r) => r.player).length,
      proposedNew: before.filter((r) => r.matchKind === "NEW").length,
      rows: before.map((r) => ({
        referenceKey: r.referenceKey,
        number: r.source.number,
        sourceName: r.source.name,
        localId: r.player?.id || null,
        localNames: r.player?.names || null,
        profileUrl: r.source.profile.url,
        profileTeam: r.source.profile.teamLabel,
        proposedTeam: r.team?.category || null,
        position: r.position,
        positionSource: r.positionSource,
        matchKind: r.matchKind,
        conflicts: r.conflicts,
      })),
    };
    const path = value("--report");
    if (path) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(report, null, 2) + "\n");
    }
    console.log(
      JSON.stringify({
        referencePlayers: report.referencePlayers,
        proposedMatches: report.proposedMatches,
        proposedNew: report.proposedNew,
        changes,
        report: path || null,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "KFF import failed; inspect the source snapshot and isolated database configuration. No production apply is enabled.",
  );
  process.exitCode = 1;
});

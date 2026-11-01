import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv,
  loadKffSnapshot,
  validateSnapshot,
  sourcePosition,
  compareReferenceCsv,
} from "../apps/api/src/kff-reference";
import { requireTestImport } from "../apps/api/src/kff-import";

test("KFF reference parses BOM, quoted commas, escaped quotes and rejects damaged CSV", () => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\n"A, B","a ""quote"""\r\n'), [
    { name: "A, B", note: 'a "quote"' },
  ]);
  assert.throws(() => parseCsv('a,b\n"unterminated'));
  assert.throws(() => parseCsv("a,b\n1,2,3"));
});
test("KFF apply cannot use production, old codex databases or an ambiguous test substring", () => {
  for (const name of [
    "ordabasy",
    "ordabasy_codex_20261019",
    "contest",
    "testproduction",
  ])
    assert.throws(() => requireTestImport(`postgresql://localhost/${name}`));
  assert.doesNotThrow(() =>
    requireTestImport("postgresql://localhost/ordabasy_kff_test_20261101"),
  );
});
test("reviewed KFF reference matches all 30 CSV rows, 3 coaches and 8 reserve profiles", async () => {
  const source = await loadKffSnapshot();
  await compareReferenceCsv(source);
  assert.equal(
    source.roster.filter((p) => p.profile.teamLabel === "Ордабасы М").length,
    8,
  );
  assert.equal(
    source.roster.filter((p) => p.profile.retrieval === "unavailable").length,
    2,
  );
  assert.equal(new Set(source.coaches.map((c) => c.key)).size, 3);
  const invalid = structuredClone(source);
  invalid.roster[1].number = invalid.roster[0].number;
  assert.throws(() => validateSnapshot(invalid));
  assert.equal(sourcePosition("Игрок"), null);
  assert.equal(sourcePosition("ОП"), "midfielder");
});

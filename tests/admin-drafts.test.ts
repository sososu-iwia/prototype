import test from "node:test";
import assert from "node:assert/strict";
import { rebaseDraft } from "../apps/web/features/admin/drafts";

test("refreshing a stale form preserves local edits and newer untouched fields", () => {
  const base = { names: { kk: "Бұрынғы" }, citizenship: "KZ", height: 180 };
  const local = { ...base, citizenship: "Local" };
  const remote = { ...base, height: 190 };
  assert.deepEqual(rebaseDraft(base, local, remote), {
    merged: { ...remote, citizenship: "Local" },
    conflicts: [],
  });
  assert.deepEqual(
    rebaseDraft(base, local, { ...remote, citizenship: "Remote" }),
    {
      merged: { ...remote, citizenship: "Local" },
      conflicts: ["citizenship"],
    },
  );
  assert.equal(local.height, 180, "The original form is not mutated");
  assert.deepEqual(
    rebaseDraft(base, local, { ...remote, citizenship: "Local" }).conflicts,
    [],
  );
});

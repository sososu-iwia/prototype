import test from "node:test";
import assert from "node:assert/strict";
import {
  schemas,
  rankStatistics,
  settingsSchema,
} from "../apps/api/src/domain";
import { localized, date } from "../apps/web/lib/i18n/config";
import kk from "../apps/web/messages/kk.json";
import ru from "../apps/web/messages/ru.json";
import en from "../apps/web/messages/en.json";
import legacy from "../packages/content/legacy-import.json";
import snapshot from "../packages/content/public-snapshot.json";
import * as fontkit from "fontkit";
import { readFileSync, existsSync } from "node:fs";
import { load } from "cheerio";
test("statistics sort goals, assists, appearances and per-90 without dividing by zero", () => {
  const rows = [
    { id: "a", goals: 3, assists: 0, appearances: 10, minutes: 900 },
    { id: "b", goals: 1, assists: 4, appearances: 5, minutes: 180 },
    { id: "c", goals: 10, assists: 0, appearances: 0, minutes: 0 },
  ];
  assert.equal(rankStatistics(rows, "efficiency")[0].id, "b");
  assert.equal(rankStatistics(rows, "goals")[0].id, "c");
  assert.equal(rankStatistics(rows, "assists")[0].id, "b");
  assert.equal(rankStatistics(rows, "appearances")[0].id, "a");
  assert.equal(rows[0].id, "a");
});
test("match validation requires different teams and real final scores", () => {
  const match = { ...legacy.matches[0] };
  const { original: _original, id: _id, ...data } = match;
  assert.ok(schemas.matches.safeParse(data).success);
  assert.ok(
    !schemas.matches.safeParse({ ...data, awayTeamId: data.homeTeamId })
      .success,
  );
  assert.ok(!schemas.matches.safeParse({ ...data, homeScore: null }).success);
});
test("mass assignment, SVG paths and invalid locales are rejected", () => {
  const p = legacy.players[0];
  const { number: _number, id: _id, ...data } = p;
  assert.ok(!schemas.players.safeParse({ ...data, role: "ADMIN" }).success);
  assert.ok(
    !schemas.players.safeParse({
      ...data,
      photo: "https://attacker.test/x.svg",
    }).success,
  );
  assert.ok(
    !schemas.players.safeParse({ ...data, names: { kk: "name", xx: "bad" } })
      .success,
  );
});
test("translations have equal namespaces and safe fallback", () => {
  for (const locale of [ru, en]) {
    for (const namespace of ["ui", "site", "match"] as const)
      assert.deepEqual(
        Object.keys(locale[namespace]).sort(),
        Object.keys(kk[namespace]).sort(),
      );
  }
  assert.equal(localized({ kk: "Қазақша" }, "en"), "Қазақша");
  assert.match(
    date("2026-10-19T14:00:00Z", "en", "Asia/Almaty", true),
    /19:00/,
  );
});
test("all roster records and 36 original fixtures are imported with provenance; none has invented stats", () => {
  const $ = load(readFileSync("team.html", "utf8"));
  assert.equal(legacy.players.length, $(".team-player-card").length);
  assert.equal(legacy.matches.length, 36);
  const teams = new Set(legacy.teams.map((t) => t.id));
  for (const m of legacy.matches) {
    assert.equal(m.status, "DRAFT");
    assert.ok(teams.has(m.homeTeamId) && teams.has(m.awayTeamId));
  }
  assert.equal(legacy.news.length, 3);
  for (const p of snapshot.players) {
    assert.equal(p.verification, "LEGACY_UNVERIFIED");
    assert.equal(p.seasons[0].statistics, null);
    assert.ok(existsSync("apps/web/public" + p.photo));
  }
  assert.equal(snapshot.news.length, 1);
});
test("local Noto font files cover every Kazakh, Russian and English sample glyph", () => {
  const fonts = [
    fontkit.openSync(
      "apps/web/public/fonts/noto-sans-2.015-primary-wght-normal.woff2",
    ),
  ];
  const sample =
    "ӘәҒғҚқҢңӨөҰұҮүҺһІіАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:;—–«»";
  for (const char of sample)
    assert.ok(
      fonts.some((font) => font.hasGlyphForCodePoint(char.codePointAt(0)!)),
      `Missing ${char}`,
    );
});
test("settings reject unsafe timezones and duplicated sections", () => {
  assert.ok(
    !settingsSchema.safeParse({
      sections: ["hero", "hero"],
      leagueId: null,
      externalSeason: null,
      timezone: "Bad/Zone",
    }).success,
  );
});

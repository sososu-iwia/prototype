import { readFile } from "node:fs/promises";
import { z } from "zod";
import source from "../../../packages/content/kff-2026-source.json";
import mapping from "../../../packages/content/kff-2026-mapping.json";

export const kffUrl = "https://kffleague.kz/ru/team/81";
export const kffSeason = "2026";
export const referenceMapping = mapping;
export const positionCodes = [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward",
] as const;
export function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(
      /[әғқңөұүһі]/g,
      (c) =>
        ({
          ә: "а",
          ғ: "г",
          қ: "к",
          ң: "н",
          ө: "о",
          ұ: "у",
          ү: "у",
          һ: "х",
          і: "и",
        })[c]!,
    )
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function sourcePosition(label: string | null | undefined) {
  if (["Вратарь", "ВР"].includes(label || "")) return "goalkeeper";
  if (["Защитник", "ЛЗ", "ПЗ", "ЦЗ"].includes(label || "")) return "defender";
  if (["Полузащитник", "ОП", "ЦП", "АП", "ЛП", "ПП"].includes(label || ""))
    return "midfielder";
  if (["Нападающий", "ЦН", "ЛН", "ПН"].includes(label || "")) return "forward";
  return null;
}
/** Small RFC 4180 reader: BOM, quoted commas, escaped quotes and CRLF. */
export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const header = rows.shift();
  if (!header) throw new Error("Empty CSV");
  return rows.map((cells) => {
    if (cells.length !== header.length)
      throw new Error("CSV column count mismatch");
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
export type KffSnapshot = typeof source;
export function validateSnapshot(value: unknown): KffSnapshot {
  const data = value as KffSnapshot;
  if (
    !data ||
    data.sourceUrl !== kffUrl ||
    data.sourceSeason !== kffSeason ||
    !Array.isArray(data.roster) ||
    data.roster.length !== 30 ||
    data.coaches?.length !== 3
  )
    throw new Error(
      "Expected the reviewed KFF team/81 2026 reference (30 players / 3 coaches)",
    );
  z.iso.datetime().parse(data.sourceCapturedAt);
  const names = new Set<string>(),
    numbers = new Set<number>(),
    ids = new Set<string>();
  for (const row of data.roster) {
    z.string().min(3).max(200).parse(row.name);
    z.number().int().min(1).max(99).parse(row.number);
    z.string()
      .regex(/^[A-Z]{2}$/)
      .parse(row.country);
    if (names.has(normalizeName(row.name)) || numbers.has(row.number))
      throw new Error("Duplicate reference identity or number");
    names.add(normalizeName(row.name));
    numbers.add(row.number);
    if (
      row.profile.url &&
      !/^https:\/\/kffleague\.kz\/ru\/player\/\d+$/.test(row.profile.url)
    )
      throw new Error("Unapproved profile URL");
    if ("id" in row.profile && row.profile.id) {
      if (ids.has(row.profile.id)) throw new Error("Duplicate KFF profile ID");
      ids.add(row.profile.id);
    }
    if (!mapping.some((m) => m.sourceName === row.name))
      throw new Error("Source changed; editorial reconciliation required");
  }
  for (const coach of data.coaches) {
    if (
      !source.coaches.some(
        (c) =>
          c.key === coach.key &&
          c.name === coach.name &&
          c.roleCode === coach.roleCode &&
          c.country === coach.country,
      )
    )
      throw new Error("Coach facts changed; source review required");
  }
  if (new Set(data.coaches.map((coach) => coach.key)).size !== 3)
    throw new Error("Duplicate coach identity");
  return data;
}
export async function loadKffSnapshot(path?: string) {
  return validateSnapshot(
    path ? JSON.parse(await readFile(path, "utf8")) : source,
  );
}
export async function compareReferenceCsv(snapshot: KffSnapshot) {
  const csv = parseCsv(
    await readFile(
      "docs/reference/kff-20261101/KFF_Ordabasy_2026_roster_reference.csv",
      "utf8",
    ),
  );
  if (csv.length !== 30) throw new Error("Expected 30 CSV reference rows");
  for (const row of csv) {
    const actual = snapshot.roster.find(
      (r) => r.number === Number(row.shirt_number),
    );
    const expectedPosition =
      row.source_position_ru === "Позиция не указана"
        ? "Игрок"
        : row.source_position_ru;
    if (
      !actual ||
      actual.name !== row.source_name_ru ||
      actual.positionLabel !== expectedPosition ||
      actual.country !== row.source_nationality_iso
    )
      throw new Error(
        "Fresh source and CSV differ; review before applying: " +
          row.source_name_ru,
      );
  }
}
/** Optional one-shot refresh, never a cron or undocumented API. Fail closed on HTTP denial. */
export async function checkLiveKff(snapshot: KffSnapshot) {
  const response = await fetch(kffUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok)
    throw new Error(
      `KFF returned HTTP ${response.status}; no writes. Use a freshly reviewed --source-snapshot captured through the public web reader.`,
    );
  const html = await response.text();
  if (
    !snapshot.roster.every((r) => html.includes(r.name)) ||
    !snapshot.coaches.every((c) => html.includes(c.name))
  )
    throw new Error("Live source changed or its HTML is incomplete; no writes");
  return true;
}

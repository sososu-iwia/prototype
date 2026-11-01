import { test, expect } from "@playwright/test";
import { db } from "../../apps/api/src/db";
import { assertTestDatabase } from "../helpers/test-database";
import en from "../../apps/web/messages/en.json";

test.setTimeout(90000);

test("KFF cards expose evidence, search, safe approval/rejection and reject stale decisions", async ({
  page,
  browser,
}, info) => {
  assertTestDatabase();
  const prefix = `${process.env.E2E_PREFIX}-review-${info.project.name}`;
  const names = { kk: prefix, ru: prefix, en: prefix };
  const team = await db.team.findUniqueOrThrow({
    where: { category: "first-team" },
  });
  const player = await db.player.create({
    data: {
      slug: prefix,
      names,
      biography: { kk: "", ru: "", en: "" },
      position: "goalkeeper",
      rosterStatus: "UNCONFIRMED",
      source: "QA fixture only",
      sourceDate: new Date(),
    },
  });
  const record = await db.rosterImportRecord.create({
    data: {
      referenceKey: prefix,
      seasonId: "2026",
      playerId: player.id,
      teamId: team.id,
      sourceUrl: "https://kffleague.kz/ru/team/81",
      sourceCapturedAt: new Date(),
      sourceName: prefix,
      sourcePosition: "Вратарь",
      shirtNumber: 98,
      profileTeam: "Ордабасы",
      position: "goalkeeper",
      positionSource: "https://kffleague.kz/ru/team/81",
      evidence: { qaFixture: true },
      matchKind: "NEW",
    },
  });
  const otherContext = await browser.newContext({
    viewport: page.viewportSize(),
  });
  const other = await otherContext.newPage();
  async function open(tab: typeof page) {
    await tab.goto(new URL("/en/admin", page.url()).href);
    await tab
      .getByLabel(en.ui.email, { exact: true })
      .fill(process.env.E2E_EMAIL!);
    await tab
      .getByLabel(en.ui.password, { exact: true })
      .fill(process.env.E2E_PASSWORD!);
    await tab.getByRole("button", { name: en.ui.login, exact: true }).click();
    await tab
      .locator(".admin-nav")
      .getByRole("button", { name: en.ui["kff-review"], exact: true })
      .click();
    await tab.getByLabel(en.kff.search, { exact: true }).fill(prefix);
    const row = tab.locator(".kff-review-list article");
    await expect(row).toHaveCount(1);
    for (const text of [
      en.kff.sourceTeam,
      en.kff.seasonLabel,
      "2026",
      en.kff.position,
      en.kff.decisionStatus,
    ])
      await expect(row).toContainText(text);
    await row
      .getByRole("button", { name: new RegExp(`^${en.kff.openReview}:`) })
      .click();
  }
  try {
    await page.goto("/en/admin");
    await open(page);
    await open(other);
    await page
      .getByLabel(en.kff.notes, { exact: true })
      .fill("QA: isolated fixture approval, no real identity modified");
    await page
      .getByRole("button", { name: en.kff.APPROVE, exact: true })
      .click();
    await expect(page.getByText(en.kff.saved, { exact: true })).toBeVisible();
    expect(
      (
        await db.rosterImportRecord.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).reviewStatus,
    ).toBe("APPROVED");
    expect(
      await db.rosterMembership.count({ where: { playerId: player.id } }),
    ).toBe(0);
    expect(
      (await db.player.findUniqueOrThrow({ where: { id: player.id } })).status,
    ).toBe("DRAFT");
    await other
      .getByLabel(en.kff.notes, { exact: true })
      .fill("QA: stale decision must not overwrite the approved version");
    await other
      .getByRole("button", { name: en.kff.REJECT, exact: true })
      .click();
    await expect(other.locator(".kff-review [role=status]").first()).toHaveText(
      en.ui.editConflict,
    );
    await expect(other.getByLabel(en.kff.notes, { exact: true })).toHaveValue(
      /stale decision/,
    );
    await page.reload();
    await page
      .locator(".admin-nav")
      .getByRole("button", { name: en.ui["kff-review"], exact: true })
      .click();
    await page.getByLabel(en.kff.search, { exact: true }).fill(prefix);
    const row = page.locator(".kff-review-list article");
    await expect(row).toContainText(en.kff.APPROVED);
    await row
      .getByRole("button", { name: new RegExp(`^${en.kff.openReview}:`) })
      .click();
    await page
      .getByLabel(en.kff.notes, { exact: true })
      .fill("QA: fixture rejection exercises the editorial decision form");
    await page
      .getByRole("button", { name: en.kff.REJECT, exact: true })
      .click();
    await expect(page.getByText(en.kff.saved, { exact: true })).toBeVisible();
    expect(
      (
        await db.rosterImportRecord.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).reviewStatus,
    ).toBe("REJECTED");
    expect(await db.player.count({ where: { slug: prefix } })).toBe(1);
  } finally {
    await otherContext.close();
    await db.rosterImportRecord.delete({ where: { id: record.id } });
    await db.playerSeason.deleteMany({ where: { playerId: player.id } });
    await db.player.delete({ where: { id: player.id } });
    await db.$disconnect();
  }
});

test("staff forms create, edit, archive and expose persistent revision history", async ({
  page,
}, info) => {
  assertTestDatabase();
  const prefix = `${process.env.E2E_PREFIX}-staff-${info.project.name}`;
  let id: string | undefined;
  const nav = page.locator(".admin-nav");
  const save = async () => {
    await page.getByRole("button", { name: en.ui.save, exact: true }).click();
    await expect(page.locator(".admin-form")).toHaveCount(0);
    await expect(page.locator(".admin-message")).toHaveText(en.ui.saved);
  };
  const find = async () => {
    await page
      .getByRole("textbox", { name: en.ui.search, exact: true })
      .fill(prefix);
    await page.getByRole("button", { name: en.ui.search, exact: true }).click();
    await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  };
  try {
    await page.goto("/en/admin");
    await page
      .getByLabel(en.ui.email, { exact: true })
      .fill(process.env.E2E_EMAIL!);
    await page
      .getByLabel(en.ui.password, { exact: true })
      .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: en.ui.login, exact: true }).click();
    await nav.getByRole("button", { name: en.ui.staff, exact: true }).click();
    await page.getByRole("button", { name: en.ui.create, exact: true }).click();
    for (const locale of ["kk", "ru", "en"]) {
      await page
        .locator(".admin-form .language-switcher")
        .getByRole("button", { name: locale.toUpperCase(), exact: true })
        .click();
      await page
        .getByLabel(`${en.ui.names} (${locale.toUpperCase()})`, { exact: true })
        .fill(prefix);
      await page
        .getByLabel(`${en.ui.title} (${locale.toUpperCase()})`, { exact: true })
        .fill("QA role awaiting approval");
    }
    await page
      .getByRole("combobox", { name: en.ui.group, exact: true })
      .selectOption("coaching");
    await page
      .getByRole("combobox", { name: en.ui.sourceSeasonId, exact: true })
      .selectOption("2026");
    await page.getByLabel(en.ui.source, { exact: true }).fill(prefix);
    await save();
    const member = await db.staffMember.findFirstOrThrow({
      where: { source: prefix },
    });
    id = member.id;
    expect(member.status).toBe("DRAFT");
    await find();
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: en.ui.edit, exact: true })
      .click();
    await page
      .getByLabel(`${en.ui.title} (EN)`, { exact: true })
      .fill("QA revised role awaiting approval");
    await save();
    await page.reload();
    await nav.getByRole("button", { name: en.ui.staff, exact: true }).click();
    await find();
    const row = page.locator(".admin-table tbody tr");
    await row.locator(".staff-history summary").click();
    await expect(row.locator(".staff-history li")).toHaveCount(2);
    await expect(row.locator(".staff-history")).toContainText(
      "QA revised role awaiting approval",
    );
    await expect(row.locator(".staff-history")).toContainText(
      en.staffHistory.notice,
    );
    await row
      .getByRole("button", { name: en.ui.archiveAction, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: en.ui.confirm, exact: true })
      .click();
    await expect(row).toContainText(en.ui.ARCHIVED);
    await row.locator(".staff-history summary").click();
    await expect(row.locator(".staff-history li")).toHaveCount(3);
    expect(
      (await db.staffMember.findUniqueOrThrow({ where: { id } })).status,
    ).toBe("ARCHIVED");
    expect(await db.staffRevision.count({ where: { staffId: id } })).toBe(3);
  } finally {
    if (id) {
      await db.staffRevision.deleteMany({ where: { staffId: id } });
      await db.staffMember.delete({ where: { id } });
    }
    await db.$disconnect();
  }
});

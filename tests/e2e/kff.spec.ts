import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import kk from "../../apps/web/messages/kk.json";
import ru from "../../apps/web/messages/ru.json";
import en from "../../apps/web/messages/en.json";

for (const locale of ["kk", "ru", "en"] as const) {
  test(`${locale}: reviewed season squad and three source-backed coaches`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/teams/first-team?season=2026`);
    const coaches = page.locator("#coaches");
    await expect(coaches.locator(".coach-card")).toHaveCount(3);
    await expect(coaches.locator(".coach-card").first()).toHaveAttribute(
      "data-role",
      "HEAD_COACH",
    );
    await expect(coaches).toContainText("Андрей Мартин");
    await expect(coaches).not.toContainText("Игорь Зайцев");
    await expect(coaches.locator(".portrait-placeholder")).toHaveCount(3);
    // Other CMS suites deliberately retain valid contract fixtures until global
    // teardown. Verify each KFF identity exactly once without hiding those players.
    for (const slug of [
      "bekhan-shaizada",
      "kazhymukan-tolepbergen",
      "sergey-keyler",
      "nikola-antic",
      "ali-turganov",
      "sergey-maly",
      "elkhan-astanov",
      "yuriy-vakulko",
      "cristian-capatina",
      "abinur-nurymbet",
      "tidiane-keita",
      "magzhan-toktibai",
    ])
      await expect(
        page.locator(`#squad a[href="/${locale}/players/${slug}"]`),
      ).toHaveCount(1);
    await expect(page.locator("#squad")).not.toContainText("Нурби Маратулы");
    await expect(page.locator("#squad")).not.toContainText("Аян Абдухалық");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).include("#coaches").analyze();
    expect(result.violations).toEqual([]);
    await page.goto(`/${locale}/teams/first-team`);
    for (const slug of ["sergey-keyler", "abinur-nurymbet", "tidiane-keita"])
      await expect(
        page.locator(`#squad a[href="/${locale}/players/${slug}"]`),
      ).toHaveCount(0);
    await page.goto(`/${locale}/players/sergey-keyler`);
    await expect(page.locator("h1")).toHaveText("Сергей Кейлер");
    await expect(
      page.locator(".profile-image .portrait-placeholder"),
    ).toBeVisible();
    await expect(
      page.getByText({ kk, ru, en }[locale].kff.seasonNotice, { exact: true }),
    ).toBeVisible();
  });
}
test("KFF editorial decisions survive reload and cannot publish reserve as first team", async ({
  page,
}) => {
  await page.goto("/ru/admin");
  await page
    .getByLabel(ru.ui.email, { exact: true })
    .fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel(ru.ui.password, { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: ru.ui.login, exact: true }).click();
  await page
    .getByRole("button", { name: ru.ui["kff-review"], exact: true })
    .click();
  const row = page
    .locator(".kff-review-list article")
    .filter({ hasText: /#6 · Нурби/ });
  await row
    .getByRole("button", { name: new RegExp(`^${ru.kff.openReview}:`) })
    .click();
  const note = "QA: reserve source remains pending club approval";
  await page.getByLabel(ru.kff.notes, { exact: true }).fill(note);
  await page.getByRole("button", { name: ru.kff.EDIT, exact: true }).click();
  await expect(page.getByText(ru.kff.saved, { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: ru.ui["kff-review"], exact: true })
    .click();
  await row
    .getByRole("button", { name: new RegExp(`^${ru.kff.openReview}:`) })
    .click();
  await expect(page.getByLabel(ru.kff.notes, { exact: true })).toHaveValue(
    note,
  );
  const team = page.getByLabel(ru.kff.team, { exact: true });
  const first = await team
    .locator("option")
    .filter({ hasText: /^Ордабасы$/ })
    .getAttribute("value");
  await team.selectOption(first!);
  await page.getByRole("button", { name: ru.kff.APPROVE, exact: true }).click();
  await expect(
    page.getByText(ru.kff.teamConflict, { exact: true }),
  ).toBeVisible();
});

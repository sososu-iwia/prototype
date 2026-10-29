import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const locale of ["kk", "ru", "en"] as const) {
  test(`${locale}: honours, approved logo and unpublished team shell`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const honours = page.locator("#honours");
    await expect(
      honours.locator(".honour-year").filter({ hasText: /^2026$/ }),
    ).toHaveCount(1);
    expect(await honours.innerText()).not.toMatch(/[🏆⚽🎯]/u);
    await expect(
      honours.locator('article[data-achievement-type="LEAGUE"] .honour-icon'),
    ).toHaveCount(2);
    const bank = page.locator('.sponsor-grid img[alt="Bank RBK"]');
    await bank.scrollIntoViewIfNeeded();
    await expect(bank).toBeVisible();
    await expect
      .poll(() => bank.evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    expect(await bank.evaluate((i) => getComputedStyle(i).objectFit)).toBe(
      "contain",
    );
    for (const name of [
      "Eurasia",
      "SCAT Airlines",
      "Integra Construction",
      "Global Coffee",
      "City Hotel",
    ])
      await expect(
        page.locator(`.sponsor-grid img[alt="${name}"]`),
      ).toHaveCount(0);
    for (const category of ["first-team", "first-league", "second-league"]) {
      await page.goto(`/${locale}/teams/${category}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      if (category === "first-league") {
        await expect(page.locator(".team-player-card")).toHaveCount(0);
        await expect(page.locator("#squad")).toHaveCount(0);
      }
    }
  });
  test(`${locale}: academy admission and language persistence`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/academy`);
    await expect(page.locator("#age-groups")).toBeVisible();
    await page.locator(".academy-page-hero .editorial-button").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/academy/admission$`));
    await expect(page.locator(".academy-state")).toBeVisible();
    await expect(page.locator("form.inquiry-form")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goto("/academy");
    await expect(page).toHaveURL(new RegExp(`/${locale}/academy$`));
  });
}
test("responsive navigation traps mobile focus and closes with Escape", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en");
  if (isMobile) {
    const toggle = page.getByRole("button", { name: "Menu", exact: true });
    await toggle.click();
    const drawer = page.locator("#site-drawer");
    await expect(drawer).toBeVisible();
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest("#site-drawer"),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await drawer.getByRole("button", { name: "Teams", exact: true }).click();
    await drawer
      .getByRole("link", { name: "Second League", exact: true })
      .click();
    await expect(page).toHaveURL("/en/teams/second-league");
    await expect(drawer).not.toBeVisible();
  } else {
    const group = page
      .locator("#navbar")
      .getByRole("button", { name: "Teams", exact: true });
    await group.focus();
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(
      page
        .locator("#desktop-teams")
        .getByRole("link", { name: "First team", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(group).toBeFocused();
    await expect(group).toHaveAttribute("aria-expanded", "false");
  }
});
test("new public pages meet automated accessibility checks", async ({
  page,
}) => {
  for (const route of [
    "/en/academy",
    "/en/academy/admission",
    "/en/teams/first-team",
    "/en/teams/first-league",
    "/en/teams/second-league",
    "/en/partners",
    "/en/privacy",
  ]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
});

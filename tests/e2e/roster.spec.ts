import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { db } from "../../apps/api/src/db";
test.setTimeout(60000);
test("roster departure, return, unsaved changes and admin accessibility", async ({
  page,
}, info) => {
  const prefix = `${process.env.E2E_PREFIX}-roster-${info.project.name}`;
  await page.goto("/en/admin");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const nav = page.locator(".admin-nav");
  await expect(page.locator(".admin-shell")).toBeVisible();
  const analysis = await new AxeBuilder({ page })
    .include(".admin-shell")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(analysis.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${process.env.VERIFICATION_DIR || "docs/verification"}/admin-${info.project.name}.png`,
    fullPage: true,
  });
  await nav.getByRole("button", { name: "Players", exact: true }).click();
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page.getByLabel("URL slug", { exact: true }).fill(prefix);
  await nav.getByRole("button", { name: "News", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("URL slug", { exact: true })).toHaveValue(
    prefix,
  );
  await page.getByLabel("Name (EN)", { exact: true }).fill(prefix);
  await page
    .locator(".admin-form .language-switcher")
    .getByRole("button", { name: "KK", exact: true })
    .click();
  await page.getByLabel("Name (KK)", { exact: true }).fill("Ә Ғ Қ Ң Ө Ұ Ү Һ І");
  await page
    .getByRole("combobox", { name: "Position", exact: true })
    .selectOption("forward");
  await page.getByLabel("Source", { exact: true }).fill(prefix);
  await page
    .getByRole("combobox", { name: "Publication status", exact: true })
    .selectOption("PUBLISHED");
  await page
    .getByRole("combobox", { name: "Verification", exact: true })
    .selectOption("VERIFIED");
  const image = await sharp({
    create: { width: 80, height: 120, channels: 3, background: "#047ca6" },
  })
    .png()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-player.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(page.getByLabel("Photo path", { exact: true })).toHaveValue(
    /^\/uploads\//,
  );
  let releaseSave!: () => void;
  const pendingSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/api/v1/admin/players", async (route) => {
    if (route.request().method() === "POST") await pendingSave;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      nav.getByRole("button", { name: "News", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("URL slug", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("URL slug", { exact: true })).toHaveValue(
      prefix,
    );
  } finally {
    releaseSave();
  }
  await expect(page.locator(".admin-table")).toBeVisible();
  await page.unroute("**/api/v1/admin/players");
  await page.getByRole("textbox", { name: "Search", exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const player = page
    .locator(".admin-table tbody tr")
    .filter({ hasText: prefix });
  await expect(player).toHaveCount(1);
  await player
    .getByRole("button", { name: "Career history", exact: true })
    .click();
  async function assign(start: string, number: string) {
    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Team", exact: true })
      .selectOption("ordabasy");
    await page
      .getByRole("combobox", { name: "Season", exact: true })
      .selectOption("2026");
    await page.getByLabel("Shirt number", { exact: true }).fill(number);
    await page.getByLabel("Starts at", { exact: true }).fill(start);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".admin-table")).toBeVisible();
  }
  await assign("2026-01-01T10:00", "19");
  const publicPage = await page.context().newPage();
  const publicCard = publicPage
    .locator(".team-player-card")
    .filter({ hasText: prefix });
  await publicPage.goto("/en/teams/first-team");
  await expect(publicCard).toContainText("19");
  await page
    .locator(".admin-table tbody tr")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Shirt number", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await publicPage.reload();
  await expect(publicCard).toContainText("20");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  await page
    .locator(".admin-table tbody tr")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Ends at", { exact: true }).fill("2026-06-01T10:00");
  await page.getByLabel("Departure reason", { exact: true }).fill("Transfer");
  await page.getByLabel("Next club", { exact: true }).fill("Example club");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await publicPage.reload();
  await expect(publicCard).toHaveCount(0);
  await assign("2026-07-01T10:00", "27");
  await publicPage.reload();
  await expect(publicCard).toContainText("27");
  const stored = await db.player.findUniqueOrThrow({
    where: { slug: prefix },
    include: { memberships: { orderBy: { startsAt: "asc" } } },
  });
  expect(stored.photo).toMatch(/^\/uploads\//);
  expect(stored.memberships.map((m) => m.number)).toEqual([20, 27]);
  expect(stored.memberships[0].endsAt).toBeTruthy();
  expect(stored.memberships[1].endsAt).toBeNull();
  await publicPage.close();
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${process.env.VERIFICATION_DIR || "docs/verification"}/admin-roster-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto(`/en/players/${prefix}`);
  await expect(page.locator("h1")).toHaveText(prefix);
  await expect(
    page.getByRole("heading", { name: "Career history", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".profile-facts")).toContainText("#27");
  await page.reload();
  await expect(page.locator(".profile-facts")).toContainText("#27");
  await page.goto("/en/admin");
  await nav.getByRole("button", { name: "Activity logs", exact: true }).click();
  await expect(page.locator(".admin-table tbody tr").first()).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${process.env.VERIFICATION_DIR || "docs/verification"}/admin-audit-${info.project.name}.png`,
    fullPage: true,
  });
});

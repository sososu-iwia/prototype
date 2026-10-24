import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
test.setTimeout(60000);
async function login(page: Page) {
  await page.goto("/en/admin");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".admin-shell")).toBeVisible();
  return page.locator(".admin-nav");
}
async function archive(page: Page, entity: string, prefix: string) {
  await page
    .locator(".admin-nav")
    .getByRole("button", { name: entity, exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search", exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const row = page.locator(".admin-table tbody tr");
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(row).toContainText("Archived");
}
test("localized news, safe upload, unsafe rejection and publication", async ({
  page,
}, info) => {
  const prefix = `${process.env.E2E_PREFIX}-news-${info.project.name}`;
  const nav = await login(page);
  await nav.getByRole("button", { name: "News", exact: true }).click();
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page.getByLabel("URL slug", { exact: true }).fill(`${prefix}-article`);
  await page.getByLabel("Source", { exact: true }).fill(prefix);
  await page
    .locator(".admin-form .language-switcher")
    .getByRole("button", { name: "KK", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("E2E тексеру");
  await page.getByLabel("Excerpt", { exact: true }).fill("Тест мәтіні");
  await page
    .getByLabel("Body (plain text)", { exact: true })
    .fill("E2E test article <script>alert(1)</script>");
  const file = await sharp({
    create: { width: 30, height: 30, channels: 3, background: "#38bdf8" },
  })
    .png()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "safe.png", mimeType: "image/png", buffer: file });
  await expect(page.getByLabel("Cover path", { exact: true })).toHaveValue(
    /^\/uploads\//,
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "unsafe.png",
    mimeType: "image/png",
    buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
  });
  await expect(page.locator(".admin-message")).toContainText("Choose a JPEG");
  await page
    .getByRole("combobox", { name: "Publication status", exact: true })
    .selectOption("PUBLISHED");
  await page
    .getByLabel("Publication time", { exact: true })
    .fill("2026-10-18T10:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await page.goto(`/en/news/${prefix}-article`);
  await expect(page.locator("h1")).toHaveText("E2E тексеру");
  await expect(page.locator(".article-body")).toContainText(
    "<script>alert(1)</script>",
  );
  await page.goto("/en/admin");
  await archive(page, "News", prefix);
});

test("player create, reload, publication, profile and archive", async ({
  page,
}, info) => {
  const prefix = `${process.env.E2E_PREFIX}-player-${info.project.name}`;
  const nav = await login(page);
  await nav.getByRole("button", { name: "Players", exact: true }).click();
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page.getByLabel("URL slug", { exact: true }).fill(`${prefix}-player`);
  await page.getByLabel("Name (EN)", { exact: true }).fill("E2E Player");
  await page
    .locator(".admin-form .language-switcher")
    .getByRole("button", { name: "KK", exact: true })
    .click();
  await page.getByLabel("Name (KK)", { exact: true }).fill("E2E ойыншы");
  await page
    .getByRole("combobox", { name: "Position", exact: true })
    .selectOption("forward");
  await page.getByLabel("Source", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill(`${prefix}-player`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const row = page
    .locator(".admin-table tbody tr")
    .filter({ hasText: "E2E Player" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Publication status", exact: true })
    .selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await page.goto(`/en/players/${prefix}-player`);
  await expect(page.locator("h1")).toHaveText("E2E Player");
  await page.goto("/en/admin");
  await archive(page, "Players", prefix);
});

test("match CRUD, disabled reload actions, archive and logout", async ({
  page,
}, info) => {
  const prefix = `${process.env.E2E_PREFIX}-match-${info.project.name}`;
  const nav = await login(page);
  await nav.getByRole("button", { name: "Matches", exact: true }).click();
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Season", exact: true })
    .selectOption("2026");
  await page
    .getByRole("combobox", { name: "Competition", exact: true })
    .selectOption("league");
  await page
    .getByRole("combobox", { name: "Home team", exact: true })
    .selectOption("irtysh");
  await page
    .getByRole("combobox", { name: "Away team", exact: true })
    .selectOption("ordabasy");
  const teamNames = await Promise.all(
    ["Home team", "Away team"].map((name) =>
      page
        .getByRole("combobox", { name, exact: true })
        .locator("option:checked")
        .innerText(),
    ),
  );
  await page.getByLabel("Source", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  // Exercise match update and deletion through the UI.
  await page.getByRole("textbox", { name: "Search", exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const matchRow = page.locator(".admin-table tbody tr");
  await expect(matchRow).toHaveCount(1);
  await matchRow.getByRole("button", { name: "Edit", exact: true }).click();
  const futureLocal =
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + "T17:30";
  await page
    .getByLabel("Kickoff (local time)", { exact: true })
    .fill(futureLocal);
  await page
    .getByRole("combobox", { name: "Publication status", exact: true })
    .selectOption("PUBLISHED");
  await page
    .getByRole("combobox", { name: "Verification", exact: true })
    .selectOption("VERIFIED");
  let releaseReload!: () => void;
  const pendingReload = new Promise<void>((resolve) => {
    releaseReload = resolve;
  });
  const reloadRoute = /\/api\/v1\/admin\/matches\?/;
  await page.route(reloadRoute, async (route) => {
    await pendingReload;
    await route.continue();
  });
  try {
    const requested = page.waitForRequest(
      (request) =>
        request.method() === "GET" && reloadRoute.test(request.url()),
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await requested;
    await expect(page.locator(".admin-table")).toBeVisible();
    await expect(
      matchRow.getByRole("button", { name: "Archive", exact: true }),
    ).toBeDisabled();
    await expect(
      matchRow.getByRole("button", { name: "Edit", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseReload();
  }
  await expect(
    matchRow.getByRole("button", { name: "Archive", exact: true }),
  ).toBeEnabled();
  await page.unroute(reloadRoute);
  await page.goto("/en/matches");
  const featured = page.locator(".featured-match-card");
  await expect(featured.locator(".featured-club h3")).toHaveText(teamNames);
  await expect(
    featured.locator(".featured-match-center strong"),
  ).not.toHaveText("—");
  const logo = featured.locator(".featured-club").last().locator("img");
  await logo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.goto("/en/admin");
  await nav.getByRole("button", { name: "Matches", exact: true }).click();
  await page.getByRole("textbox", { name: "Search", exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(matchRow).toHaveCount(1);
  await matchRow.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Match status", exact: true })
    .selectOption("POSTPONED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  await archive(page, "Matches", prefix);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const r = await page.request.get("/api/v1/admin/players");
  expect(r.status()).toBe(401);
});

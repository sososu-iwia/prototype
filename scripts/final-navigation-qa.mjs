import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const origin = process.env.VERIFY_ORIGIN || "http://localhost:3000";
const output = `${process.env.VERIFICATION_DIR || "docs/verification"}/navigation`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [],
  errors = [];
try {
  for (const width of [390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const locale of ["kk", "ru", "en"]) {
      await page.goto(`${origin}/${locale}`, { waitUntil: "networkidle" });
      for (const [group, route] of [
        [null, ""],
        ["club", "/#honours"],
        ["teams", "/teams/first-team"],
        ["teams", "/teams/first-league"],
        ["teams", "/teams/second-league"],
        ["teams", "/players"],
        ["teams", "/teams/first-team#coaches"],
        ["academy", "/academy"],
        ["academy", "/academy/admission"],
        ["academy", "/academy#age-groups"],
        ["academy", "/academy#coaches"],
        ["academy", "/academy#faq"],
        ["academy", "/academy#contact"],
        ["club", "/partners"],
        [null, "/news"],
        [null, "/matches"],
        [null, "/gallery"],
        ["club", "/about"],
        ["club", "/about#stadium"],
        ["club", "/about#management"],
      ]) {
        const mobile = await page.locator(".site-menu-toggle").isVisible();
        if (mobile) await page.locator(".site-menu-toggle").click();
        const nav = page.locator(mobile ? "#mobile-navbar" : "#navbar");
        if (group)
          await nav
            .locator(
              `button[aria-controls="${mobile ? "mobile" : "desktop"}-${group}"]`,
            )
            .click();
        const link = nav.locator(
          `a[href="/${locale}${route.replace("/#", "#")}"]`,
        );
        await expect(link).toBeVisible();
        await link.click();
        await expect
          .poll(() => page.url().replace("/#", "#"))
          .toBe(`${origin}/${locale}${route.replace("/#", "#")}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        if (mobile)
          await expect(page.locator("#site-drawer")).not.toBeVisible();
        await expect(page.locator("h1")).toBeVisible();
        if (route.includes("#"))
          await expect(page.locator(`#${route.split("#")[1]}`)).toBeVisible();
        else
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  document.querySelector("h1").getBoundingClientRect().top >=
                  document.querySelector("#header").getBoundingClientRect()
                    .bottom -
                    1,
              ),
            )
            .toBe(true);
        await page.locator(".site-footer").scrollIntoViewIfNeeded();
        await expect(page.locator(".site-footer")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        results.push({
          width,
          locale,
          route,
          menu: mobile ? "drawer" : "desktop",
        });
      }
    }
    await context.close();
  }
  if (process.env.QA_CREDENTIALS_PATH) {
    const credentials = JSON.parse(
      await readFile(process.env.QA_CREDENTIALS_PATH, "utf8"),
    );
    for (const locale of ["kk", "ru", "en"]) {
      const { ui: u } = JSON.parse(
        await readFile(`apps/web/messages/${locale}.json`, "utf8"),
      );
      const context = await browser.newContext({
        viewport: { width: locale === "kk" ? 390 : 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`${origin}/${locale}/admin`);
      await page
        .getByLabel(u.email, { exact: true })
        .fill(credentials.ADMIN.email);
      await page
        .getByLabel(u.password, { exact: true })
        .fill(credentials.ADMIN.password);
      await page.getByRole("button", { name: u.login, exact: true }).click();
      await expect(page.locator(".admin-shell")).toBeVisible();
      const nav = page.locator(".admin-nav");
      for (const name of await nav.getByRole("button").allTextContents()) {
        await nav.getByRole("button", { name, exact: true }).click();
        await expect(page.locator(".admin-workspace")).toHaveAttribute(
          "aria-busy",
          "false",
        );
        await expect(page.locator(".admin-message")).toHaveText("");
        await page.locator(".site-footer").scrollIntoViewIfNeeded();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await nav.getByRole("button", { name: u.sponsors, exact: true }).click();
      await page.getByRole("button", { name: u.create, exact: true }).click();
      const name = `final-qa-demo-${locale}-${Date.now()}`;
      await page.getByLabel(u.name, { exact: true }).fill(name);
      await page
        .getByLabel(u.logo, { exact: true })
        .fill("/media/sponsors/bank-rbk.webp");
      await page.getByLabel(u.sortOrder, { exact: true }).fill("99");
      await page.getByRole("button", { name: u.save, exact: true }).click();
      await expect(page.locator(".admin-form")).toHaveCount(0);
      await expect(page.locator(".admin-message")).toHaveText(u.saved);
      await page.reload();
      await nav.getByRole("button", { name: u.sponsors, exact: true }).click();
      await page
        .getByRole("textbox", { name: u.search, exact: true })
        .fill(name);
      await page.getByRole("button", { name: u.search, exact: true }).click();
      const row = page.locator(".admin-table tbody tr");
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: u.edit, exact: true }).click();
      await expect(page.getByLabel(u.name, { exact: true })).toHaveValue(name);
      const persisted = await (
        await page.request.get(
          `${origin}/api/v1/admin/sponsors?q=${encodeURIComponent(name)}`,
        )
      ).json();
      expect(persisted.items[0].status).toBe("DRAFT");
      expect(persisted.items[0].logo).toBe("/media/sponsors/bank-rbk.webp");
      await page
        .locator(".admin-form")
        .screenshot({ path: `${output}/admin-saved-${locale}.png` });
      results.push({
        locale,
        adminSave: true,
        sponsorId: persisted.items[0].id,
        status: "DRAFT",
      });
      await page.getByRole("button", { name: u.cancel, exact: true }).click();
      await page.getByRole("button", { name: u.logout, exact: true }).click();
      await expect(
        page.getByRole("button", { name: u.login, exact: true }),
      ).toBeVisible();
      expect(
        (await page.request.get(`${origin}/api/v1/admin/sponsors`)).status(),
      ).toBe(401);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
console.log(JSON.stringify({ checks: results.length, errors }));
if (errors.length) process.exitCode = 1;

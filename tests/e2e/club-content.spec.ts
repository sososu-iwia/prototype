import { test, expect } from "@playwright/test";
import { db } from "../../apps/api/src/db";
import { assertTestDatabase } from "../helpers/test-database";
import sharp from "sharp";

test.setTimeout(90000);
test("sponsor, achievement and academy forms persist to PostgreSQL; guardian inquiry remains private", async ({
  page,
  context,
}, info) => {
  assertTestDatabase();
  const prefix = `${process.env.E2E_PREFIX}-club-${info.project.name}`;
  const oldAcademy = await db.academyPage.findUniqueOrThrow({
    where: { id: "main" },
  });
  const nav = page.locator(".admin-nav");
  const save = async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".admin-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.locator(".admin-form")).toHaveCount(0);
    await expect(page.locator(".admin-message")).toHaveText("Saved");
  };
  const search = async (text: string) => {
    await page.getByRole("textbox", { name: "Search", exact: true }).fill(text);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  };
  try {
    await page.goto("/en/admin");
    await page
      .getByLabel("Email", { exact: true })
      .fill(process.env.E2E_EMAIL!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".admin-shell")).toBeVisible();
    await nav.getByRole("button", { name: "Sponsors", exact: true }).click();
    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(prefix);
    const image = await sharp({
      create: { width: 160, height: 40, channels: 4, background: "#047ca6" },
    })
      .png()
      .toBuffer();
    await page.locator("input[type=file]").setInputFiles({
      name: "qa-logo.png",
      mimeType: "image/png",
      buffer: image,
    });
    await expect(page.getByLabel("Logo path", { exact: true })).toHaveValue(
      /^\/uploads\//,
    );
    await page.getByLabel("Sort order", { exact: true }).fill("99");
    await save();
    let sponsor = await db.sponsor.findFirstOrThrow({
      where: { name: prefix },
    });
    expect(sponsor.status).toBe("DRAFT");
    await search(prefix);
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(page.locator(".admin-photo-preview")).toHaveCSS(
      "object-fit",
      "contain",
    );
    await page
      .getByLabel("Verification source", { exact: true })
      .fill("https://example.invalid/qa-only");
    await page
      .getByLabel("Verified at", { exact: true })
      .fill("2026-01-01T12:00");
    await page.getByLabel("Logo approved", { exact: true }).check();
    await page
      .getByRole("combobox", { name: "Publication status", exact: true })
      .selectOption("PUBLISHED");
    await save();
    await page.goto("/en/partners");
    // Inspect the animated ribbon through its keyboard/touch pause control.
    const pauseSponsors = page.getByRole("button", {
      name: "Pause logo animation",
      exact: true,
    });
    await pauseSponsors.click();
    const logo = page.getByRole("img", { name: prefix, exact: true });
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toHaveCSS("object-fit", "contain");
    await expect
      .poll(() => logo.evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBe(160);
    await page.reload();
    await pauseSponsors.click();
    await expect(logo).toBeVisible();
    sponsor = await db.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(sponsor.status).toBe("PUBLISHED");
    expect(
      (await (await page.request.get("/api/v1/sponsors")).json()).items.some(
        (s: { id: string }) => s.id === sponsor.id,
      ),
    ).toBe(true);
    await page.goto("/en/admin");
    await nav.getByRole("button", { name: "Sponsors", exact: true }).click();
    await search(prefix);
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.locator(".admin-table tbody tr")).toContainText(
      "Archived",
    );
    expect(
      (await db.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } }))
        .status,
    ).toBe("ARCHIVED");

    await nav
      .getByRole("button", { name: "Achievements", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await page.getByLabel("Year", { exact: true }).fill("2099");
    await page.getByLabel("Title (EN)", { exact: true }).fill(prefix);
    await page
      .locator(".admin-form .language-switcher")
      .getByRole("button", { name: "KK", exact: true })
      .click();
    await page.getByLabel("Title (KK)", { exact: true }).fill(prefix);
    await page.getByLabel("Source", { exact: true }).fill(prefix);
    await save();
    await search(prefix);
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("Year", { exact: true }).fill("2098");
    await save();
    expect(
      (await db.clubAchievement.findFirstOrThrow({ where: { source: prefix } }))
        .year,
    ).toBe(2098);
    expect(
      JSON.stringify(await (await page.request.get("/api/v1/club")).json()),
    ).not.toContain(prefix);

    await nav.getByRole("button", { name: "Academy", exact: true }).click();
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Publication status", exact: true })
      .selectOption("PUBLISHED");
    await page
      .getByLabel("Contact email", { exact: true })
      .fill("qa-academy@example.invalid");
    await page.getByLabel("Source", { exact: true }).fill(prefix);
    await page
      .locator(".admin-form .language-switcher")
      .getByRole("button", { name: "KK", exact: true })
      .click();
    await page
      .getByLabel("Approved privacy notice (KK)", { exact: true })
      .fill("Тек синтетикалық сынақ. Ә ә Ғ ғ Қ қ Ң ң Ө ө Ұ ұ Ү ү Һ һ І і");
    await page.getByLabel("Enable inquiries", { exact: true }).check();
    await save();
    expect(
      (await db.academyPage.findUniqueOrThrow({ where: { id: "main" } }))
        .inquiriesEnabled,
    ).toBe(true);
    await page.goto("/en/academy/admission");
    const form = page.locator("form.inquiry-form");
    await expect(form).toBeVisible();
    await form.locator('[name="guardianName"]').fill("Synthetic QA guardian");
    await form.locator('[name="contact"]').fill(`${prefix}@example.invalid`);
    await form
      .locator('[name="message"]')
      .fill("Synthetic QA inquiry. No child information provided.");
    await form.locator('[name="consent"]').check();
    await expect(form.locator("button")).toBeEnabled();
    // The server deliberately refuses tokens younger than two seconds.
    await page.waitForTimeout(2100);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/academy/inquiries") &&
        r.request().method() === "POST",
    );
    await form.locator("button").click();
    expect((await response).status()).toBe(201);
    await expect(form).toHaveCount(0);
    const inquiry = await db.academyInquiry.findFirstOrThrow({
      where: { contact: `${prefix}@example.invalid` },
    });
    expect(inquiry.consentAt).toBeTruthy();
    await page.goto("/en/admin");
    await nav
      .getByRole("button", { name: "Academy inquiries", exact: true })
      .click();
    await search(prefix);
    await page
      .locator(".admin-table tbody tr")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "State", exact: true })
      .selectOption("CONTACTED");
    await save();
    expect(
      (await db.academyInquiry.findUniqueOrThrow({ where: { id: inquiry.id } }))
        .state,
    ).toBe("CONTACTED");
    const audit = await db.auditLog.findMany({
      where: { entityId: inquiry.id },
    });
    expect(JSON.stringify(audit)).not.toContain(inquiry.contact);
    await page.screenshot({
      path: `${process.env.VERIFICATION_DIR || "docs/verification"}/admin-club-${info.project.name}.png`,
      fullPage: true,
    });
    const anonymous = await context.request.get("/api/v1/academy");
    expect(JSON.stringify(await anonymous.json())).not.toContain(
      inquiry.contact,
    );
  } finally {
    const { id, ...restore } = oldAcademy;
    await db.academyPage.update({ where: { id }, data: restore });
    await db.sponsor.deleteMany({ where: { name: prefix } });
    await db.clubAchievement.deleteMany({ where: { source: prefix } });
    await db.academyInquiry.deleteMany({
      where: { contact: `${prefix}@example.invalid` },
    });
    await db.$disconnect();
  }
});

test("gallery video stays unloaded above the fold, plays on screen and pauses off screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  const tiles = page.locator("#gallery .gallery-grid > .gallery-item");
  await expect(tiles).toHaveCount(4);
  // Streamed HTML can be attached inside a hidden Suspense segment before React reveals it.
  await expect(tiles.first()).toBeVisible();
  if (page.viewportSize()!.width > 600) {
    const tops = await tiles.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).offsetTop),
    );
    expect(tops[0]).toBe(tops[1]);
    expect(tops[2]).toBe(tops[3]);
    expect(tops[2]).toBeGreaterThan(tops[0]);
  }
  const video = page.locator("video").first();
  await expect(video).not.toHaveAttribute("src");
  await expect(video).not.toHaveAttribute("poster");
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute("src", /.+/);
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  await page.evaluate(() => scrollTo(0, 0));
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await video.scrollIntoViewIfNeeded();
  expect(await video.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
    true,
  );
});

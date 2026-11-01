import { test, expect } from "@playwright/test";
import { db } from "../../apps/api/src/db";
import { assertTestDatabase } from "../helpers/test-database";
import { readFile } from "node:fs/promises";
import messages from "../../apps/web/messages/en.json";

test("sponsor 0/1/2/many states, publication gates, measured seamless boundary and reduced motion", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  assertTestDatabase();
  const prefix = `${process.env.E2E_PREFIX}-marquee-${info.project.name}`;
  const published = await db.sponsor.findMany({
    where: { status: "PUBLISHED" },
  });
  try {
    await db.sponsor.updateMany({
      where: { id: { in: published.map((x) => x.id) } },
      data: { status: "DRAFT" },
    });
    await page.goto("/en/partners");
    await expect(page.locator(".sponsor-logo")).toHaveCount(0);
    for (let count = 1; count <= 12; count++) {
      await db.sponsor.create({
        data: {
          name: `${prefix}-${count}`,
          logo:
            count % 2
              ? "/media/sponsors/bank-rbk.webp"
              : "/media/sponsors/erg.webp",
          description: { kk: "Synthetic QA fixture" },
          status: "PUBLISHED",
          logoApproved: true,
          youthSafe: true,
          verifiedAt: new Date("2026-01-01T00:00:00Z"),
          verificationSource: "https://example.invalid/test-fixture",
          sortOrder: count,
        },
      });
      if (![1, 2, 12].includes(count)) continue;
      await page.reload();
      if (count === 1) {
        await expect(page.locator(".sponsor-static > li")).toHaveCount(1);
        await expect(page.locator(".sponsor-marquee")).toHaveCount(0);
      } else {
        const marquee = page.locator(".sponsor-marquee");
        await marquee.scrollIntoViewIfNeeded();
        await expect(marquee).toHaveAttribute("data-ready", "true");
        const canonical = marquee.locator("ul:not([aria-hidden]) > li");
        await expect(canonical).toHaveCount(count);
        const seam = await marquee.evaluate((root) => {
          const track = root.querySelector(".sponsor-marquee-track")!;
          const animation = track.getAnimations()[0];
          animation.pause();
          const duration = Number(animation.effect!.getTiming().duration);
          const viewport = root
            .querySelector(".sponsor-marquee-viewport")!
            .getBoundingClientRect();
          const visible = () =>
            [...root.querySelectorAll("li")]
              .map((li) => ({
                src: li.querySelector("img")!.getAttribute("src"),
                x: li.getBoundingClientRect().left,
                right: li.getBoundingClientRect().right,
              }))
              .filter(
                (li) => li.right > viewport.left && li.x < viewport.right,
              );
          const nodes = root.querySelectorAll("li").length;
          animation.currentTime = duration - 1;
          const before = visible();
          animation.currentTime = duration + 1;
          const after = visible();
          const halves = [
            ...root.querySelectorAll(".sponsor-marquee-segment"),
          ].map((x) => x.getBoundingClientRect().width);
          return {
            before,
            after,
            halves,
            duration,
            nodes,
            nodesAfter: root.querySelectorAll("li").length,
            viewport: { left: viewport.left, right: viewport.right },
          };
        });
        expect(seam.halves[0]).toBeCloseTo(seam.halves[1], 3);
        expect(seam.before[0].src).toBe(seam.after[0].src);
        expect(Math.abs(seam.before[0].x - seam.after[0].x)).toBeLessThan(0.5);
        expect(seam.before[0].x).toBeLessThanOrEqual(seam.viewport.left + 1);
        expect(seam.before.at(-1)!.right).toBeGreaterThanOrEqual(
          seam.viewport.right - 24,
        );
        expect(seam.nodes).toBe(seam.nodesAfter);
        expect(seam.duration).toBeGreaterThanOrEqual(25000);
        expect(await marquee.locator('[aria-hidden="true"] a').count()).toBe(0);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(marquee.locator(".sponsor-marquee-track")).toHaveCSS(
          "animation-name",
          "none",
        );
        await expect(marquee.locator(".sponsor-marquee-viewport")).toHaveCSS(
          "overflow-x",
          "auto",
        );
        await expect(
          marquee.locator('[aria-hidden="true"]').first(),
        ).toBeHidden();
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page
          .getByRole("button", { name: "Pause logo animation", exact: true })
          .click();
        await expect(marquee).toHaveAttribute("data-static", "true");
        await page
          .getByRole("button", { name: "Resume logo animation", exact: true })
          .click();
        await expect(marquee).toHaveAttribute("data-static", "false");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    for (const extra of [
      { name: "draft", status: "DRAFT" as const },
      { name: "unapproved", logoApproved: false, status: "DRAFT" as const },
      { name: "future", validFrom: new Date("2099-01-01T00:00:00Z") },
      { name: "expired", validUntil: new Date("2020-01-01T00:00:00Z") },
      { name: "unverified", verifiedAt: null, status: "DRAFT" as const },
    ])
      await db.sponsor.create({
        data: {
          name: `${prefix}-${extra.name}`,
          logo: "/media/sponsors/scat.webp",
          description: { kk: "" },
          status: "PUBLISHED",
          logoApproved: true,
          youthSafe: false,
          verificationSource: "https://example.invalid/test-fixture",
          verifiedAt: new Date("2026-01-01T00:00:00Z"),
          sortOrder: 99,
          ...extra,
          ...{ name: `${prefix}-${extra.name}` },
        },
      });
    const publicItems = (
      await (await page.request.get("/api/v1/sponsors")).json()
    ).items;
    expect(publicItems).toHaveLength(12);
    await page.reload();
    await expect(
      page.locator("ul:not([aria-hidden]).sponsor-marquee-set > li"),
    ).toHaveCount(12);
  } finally {
    await db.sponsor.deleteMany({ where: { name: { startsWith: prefix } } });
    await db.sponsor.updateMany({
      where: { id: { in: published.map((x) => x.id) } },
      data: { status: "PUBLISHED" },
    });
    await db.$disconnect();
  }
});

test("private sponsor preview includes drafts on all locales without publishing them", async ({
  page,
}) => {
  test.setTimeout(60000);
  assertTestDatabase();
  const before = await db.sponsor.findMany({
    select: { id: true, status: true, version: true },
    orderBy: { id: "asc" },
  });
  for (const locale of ["kk", "ru", "en"]) {
    const copy = JSON.parse(
      await readFile(`apps/web/messages/${locale}.json`, "utf8"),
    );
    await page.goto(`/${locale}/admin`);
    await page
      .getByLabel(copy.ui.email, { exact: true })
      .fill(process.env.E2E_EMAIL!);
    await page
      .getByLabel(copy.ui.password, { exact: true })
      .fill(process.env.E2E_PASSWORD!);
    await page
      .getByRole("button", { name: copy.ui.login, exact: true })
      .click();
    await page
      .locator(".admin-nav")
      .getByRole("button", { name: copy.ui.sponsors, exact: true })
      .click();
    await page
      .getByRole("button", { name: copy.premium.sponsorPreview, exact: true })
      .click();
    await expect(page.locator(".sponsor-preview-panel")).toContainText(
      copy.premium.sponsorPreviewNotice,
    );
    for (const brand of [
      "Eurasia",
      "ERG",
      "SCAT Airlines",
      "Global Coffee",
      "City Hotel",
      "Integra Construction",
    ])
      await expect(
        page.locator(
          `.sponsor-preview-panel ul:not([aria-hidden]) img[alt="${brand}"]`,
        ),
      ).toHaveCount(1);
    await expect(
      page.locator(".sponsor-preview-panel .sponsor-marquee"),
    ).toHaveAttribute("data-ready", "true");
    await page
      .getByRole("button", { name: copy.ui.logout, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: copy.ui.login, exact: true }),
    ).toBeVisible();
    expect((await page.request.get("/api/v1/admin/sponsors")).status()).toBe(
      401,
    );
  }
  expect(
    await db.sponsor.findMany({
      select: { id: true, status: true, version: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(before);
  await db.$disconnect();
});

for (const locale of ["kk", "ru", "en"])
  test(`${locale}: responsive hero is loaded once, cropped without enlargement and has no overflow`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/media/hero-")) requests.push(r.url());
    });
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    const hero = page.locator(".editorial-hero-image");
    await expect
      .poll(() => hero.evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const image = await hero.evaluate((i) => ({
      src: (i as HTMLImageElement).currentSrc,
      width: (i as HTMLImageElement).naturalWidth,
      fit: getComputedStyle(i).objectFit,
      position: getComputedStyle(i).objectPosition,
    }));
    expect(image.src).toContain(
      page.viewportSize()!.width <= 480 ? "mobile-" : "desktop-",
    );
    expect(image.width).toBeLessThanOrEqual(1600);
    expect(image.fit).toBe("cover");
    expect([...new Set(requests)]).toHaveLength(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("video autoplay, mute, viewport/tab resume, native loop and intentional pause", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/gallery");
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  const toggle = await page.locator(".gallery-video-toggle").boundingBox();
  const frame = await video.boundingBox();
  expect(toggle!.height).toBeGreaterThanOrEqual(44);
  expect(toggle!.width).toBeLessThan(frame!.width * 0.65);
  await expect
    .poll(() =>
      video.evaluate(
        (v) =>
          !(v as HTMLVideoElement).paused &&
          (v as HTMLVideoElement).currentTime > 0,
      ),
    )
    .toBe(true);
  expect(
    await video.evaluate((v) => ({
      muted: (v as HTMLVideoElement).muted,
      loop: (v as HTMLVideoElement).loop,
      inline: (v as HTMLVideoElement).playsInline,
      autoplay: (v as HTMLVideoElement).autoplay,
    })),
  ).toEqual({ muted: true, loop: true, inline: true, autoplay: true });
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(true);
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  await video.evaluate((v) => {
    const x = v as HTMLVideoElement;
    x.currentTime = x.duration - 0.2;
  });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime < 1))
    .toBe(true);
  await page.getByRole("button", { name: /^Pause video:/ }).click();
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await video.scrollIntoViewIfNeeded();
  expect(await video.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
    true,
  );
  await page.getByRole("button", { name: /^Play video:/ }).click();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
});

test("reduced motion permits manual video play and autoplay denial has a visible retry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/gallery");
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await expect(video).not.toHaveAttribute("autoplay");
  expect(await video.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
    true,
  );
  await page.getByRole("button", { name: /^Play video:/ }).click();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let blocked = true;
    HTMLMediaElement.prototype.play = function () {
      return blocked
        ? Promise.reject(
            new DOMException("Browser autoplay policy", "NotAllowedError"),
          )
        : original.call(this);
    };
    Object.assign(window, {
      allowVideoPlayback: () => {
        blocked = false;
      },
    });
  });
  await page.reload();
  await video.scrollIntoViewIfNeeded();
  await expect(page.locator(".gallery-video-feedback")).toContainText(
    messages.premium.videoBlocked,
  );
  await page.evaluate(() => {
    (
      window as unknown as { allowVideoPlayback: () => void }
    ).allowVideoPlayback();
  });
  await page.getByRole("button", { name: /^Play video:/ }).click();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  await expect(page.locator(".gallery-video-feedback")).toHaveCount(0);
});

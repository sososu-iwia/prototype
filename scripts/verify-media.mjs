import { chromium, webkit, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const output =
  process.env.MEDIA_VERIFY_DIR || "docs/verification/media-20261101";
const origin = process.env.VERIFY_ORIGIN || "http://localhost:3000";
await mkdir(`${output}/screenshots`, { recursive: true });
const results = {
  capturedAt: new Date().toISOString(),
  origin,
  pages: [],
  errors: [],
  publicPartners: [],
  video: null,
  marquee: null,
  webkit: null,
};
const save = () =>
  writeFile(`${output}/live-review.json`, JSON.stringify(results, null, 2));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const partners = await (await fetch(`${origin}/api/v1/sponsors`)).json();
  results.publicPartners = partners.items.map((item) => item.name);
  for (const width of [390, 768, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: width === 390 ? 2 : 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.mediaCLS = 0;
      window.mediaCSP = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.mediaCSP.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          source: event.sourceFile,
        });
      });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.mediaCLS += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    page.on("pageerror", (e) => results.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") results.errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) results.errors.push(`${r.status()} ${r.url()}`);
    });
    for (const locale of ["kk", "ru", "en"]) {
      const heroRequests = new Set();
      const collect = (r) => {
        if (r.url().includes("/media/hero-")) heroRequests.add(r.url());
      };
      page.on("request", collect);
      await page.goto(`${origin}/${locale}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const hero = page.locator(".editorial-hero-image");
      await expect
        .poll(() => hero.evaluate((i) => i.naturalWidth))
        .toBeGreaterThan(0);
      const heroCLS = await page.evaluate(() => window.mediaCLS);
      const cspViolations = await page.evaluate(() => window.mediaCSP);
      expect(cspViolations).toEqual([]);
      expect(heroCLS).toBeLessThanOrEqual(0.1);
      const image = await hero.evaluate((i) => ({
        src: i.currentSrc,
        naturalWidth: i.naturalWidth,
        fit: getComputedStyle(i).objectFit,
        focus: getComputedStyle(i).objectPosition,
      }));
      expect(heroRequests.size).toBe(1);
      await page.locator(".editorial-hero").screenshot({
        path: `${output}/screenshots/${locale}-hero-${width}.png`,
      });
      await page.locator("#partners").scrollIntoViewIfNeeded();
      await page.locator("#partners").screenshot({
        path: `${output}/screenshots/${locale}-partners-${width}.png`,
      });
      page.off("request", collect);
      await page.goto(`${origin}/${locale}/gallery`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
        scrollTo(0, 0);
      });
      await page.screenshot({
        path: `${output}/screenshots/${locale}-gallery-${width}.png`,
        fullPage: true,
      });
      const state = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenImages: [...document.images].filter((i) => !i.naturalWidth)
          .length,
      }));
      expect(state).toEqual({ lang: locale, overflow: false, brokenImages: 0 });
      results.pages.push({
        locale,
        width,
        deviceScaleFactor: width === 390 ? 2 : 1,
        heroRequests: [...heroRequests],
        heroCLS,
        cspViolations,
        image,
        ...state,
      });
    }
    await context.close();
  }
  await save();
  console.log(
    JSON.stringify({
      phase: "responsive-pages",
      views: results.pages.length,
      errors: results.errors,
    }),
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
    recordVideo: {
      dir: `${output}/recordings`,
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto(`${origin}/en/gallery`);
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  const videoResponse = await page.request.get(
    new URL(await video.getAttribute("src"), origin).href,
    { headers: { Range: "bytes=0-1023" } },
  );
  expect(videoResponse.headers()["content-type"]).toContain("video/mp4");
  const videoState = await video.evaluate((v) => {
    v.currentTime = 0;
    const evidence = {
      width: v.videoWidth,
      height: v.videoHeight,
      duration: v.duration,
      muted: v.muted,
      loop: v.loop,
      frames: 0,
      cycles: [],
      boundaryLuma: [],
      lastTime: 0,
      error: null,
    };
    window.mediaLoopEvidence = evidence;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const pixels = canvas.getContext("2d", { willReadFrequently: true });
    const frame = (_now, metadata) => {
      evidence.frames++;
      if (metadata.mediaTime < 0.15 || metadata.mediaTime > v.duration - 0.15) {
        pixels.drawImage(v, 0, 0, 32, 24);
        const data = pixels.getImageData(0, 0, 32, 24).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4)
          total += data[i] + data[i + 1] + data[i + 2];
        evidence.boundaryLuma.push({
          time: metadata.mediaTime,
          meanRgb: total / (32 * 24 * 3),
        });
      }
      if (evidence.lastTime > v.duration - 1 && metadata.mediaTime < 1)
        evidence.cycles.push({
          observedAt: performance.now(),
          from: evidence.lastTime,
          to: metadata.mediaTime,
        });
      evidence.lastTime = metadata.mediaTime;
      evidence.error = v.error?.code || null;
      if (evidence.cycles.length < 2) v.requestVideoFrameCallback(frame);
    };
    v.requestVideoFrameCallback(frame);
    return evidence;
  });
  await video.screenshot({
    path: `${output}/screenshots/video-cycle-start.png`,
  });
  for (let cycle = 1; cycle <= 2; cycle++) {
    await expect
      .poll(() => page.evaluate(() => window.mediaLoopEvidence.cycles.length), {
        timeout: 70000,
        intervals: [150],
      })
      .toBeGreaterThanOrEqual(cycle);
    await video.screenshot({
      path: `${output}/screenshots/video-cycle-${cycle}.png`,
    });
    console.log(JSON.stringify({ phase: "video", fullCycles: cycle }));
  }
  results.video = {
    ...videoState,
    ...(await page.evaluate(() => window.mediaLoopEvidence)),
    rangeStatus: videoResponse.status(),
    mimeType: videoResponse.headers()["content-type"],
    realFullCycles: 2,
  };
  expect(results.video.error).toBe(null);
  expect(results.video.frames).toBeGreaterThan(900);
  await save();
  await page.evaluate(() => {
    document
      .querySelector(".gallery-video-toggle")
      .addEventListener(
        "click",
        () => void document.querySelector("video").requestFullscreen(),
        { once: true },
      );
  });
  await page.getByRole("button", { name: /^Pause video:/ }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
    .toBe("VIDEO");
  results.video.fullscreen = true;
  await page.evaluate(() => document.exitFullscreen());
  await context.close();
  if (process.env.QA_CREDENTIALS_PATH) {
    const credentials = JSON.parse(
      await readFile(process.env.QA_CREDENTIALS_PATH, "utf8"),
    );
    const previewContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "no-preference",
      recordVideo: {
        dir: `${output}/recordings`,
        size: { width: 1440, height: 1000 },
      },
    });
    const preview = await previewContext.newPage();
    await preview.goto(`${origin}/en/admin`);
    await preview
      .getByLabel("Email", { exact: true })
      .fill(credentials.ADMIN.email);
    await preview
      .getByLabel("Password", { exact: true })
      .fill(credentials.ADMIN.password);
    await preview.getByRole("button", { name: "Sign in", exact: true }).click();
    await preview
      .locator(".admin-nav")
      .getByRole("button", { name: "Sponsors", exact: true })
      .click();
    await preview
      .getByRole("button", { name: "Partner ribbon preview", exact: true })
      .click();
    const panel = preview.locator(".sponsor-preview-panel");
    const marquee = panel.locator(".sponsor-marquee");
    await expect(marquee).toHaveAttribute("data-ready", "true");
    await panel.scrollIntoViewIfNeeded();
    await preview.mouse.move(0, 0);
    const initial = await marquee.evaluate((root) => {
      const animation = root
        .querySelector(".sponsor-marquee-track")
        .getAnimations()[0];
      return {
        duration: Number(animation.effect.getTiming().duration),
        startTime: animation.currentTime,
        playState: animation.playState,
        names: [...root.querySelectorAll("ul:not([aria-hidden]) img")].map(
          (i) => i.alt,
        ),
        nodes: root.querySelectorAll("li").length,
      };
    });
    expect(initial.playState).toBe("running");
    await panel.screenshot({
      path: `${output}/screenshots/sponsor-preview-cycle-start.png`,
    });
    const cycles = [];
    for (let cycle = 1; cycle <= 3; cycle++) {
      await expect
        .poll(
          () =>
            marquee.evaluate(
              (root) =>
                root.querySelector(".sponsor-marquee-track").getAnimations()[0]
                  .currentTime,
            ),
          { timeout: initial.duration + 10000, intervals: [100] },
        )
        .toBeGreaterThanOrEqual(initial.startTime + cycle * initial.duration);
      await panel.screenshot({
        path: `${output}/screenshots/sponsor-preview-cycle-${cycle}.png`,
      });
      cycles.push(
        await marquee.evaluate((root) => ({
          currentTime: root
            .querySelector(".sponsor-marquee-track")
            .getAnimations()[0].currentTime,
          nodes: root.querySelectorAll("li").length,
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
        })),
      );
      console.log(JSON.stringify({ phase: "marquee", fullCycles: cycle }));
    }
    for (const state of cycles) {
      expect(state.nodes).toBe(initial.nodes);
      expect(state.documentOverflow).toBe(false);
    }
    results.marquee = {
      ...initial,
      realFullCycles: 3,
      cycles,
      privatePreview: true,
    };
    await save();
    for (const width of [390, 768, 1920]) {
      await preview.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      await panel.screenshot({
        path: `${output}/screenshots/sponsor-preview-${width}.png`,
      });
      if (width === 390) {
        await preview.mouse.move(0, 0);
        const mobileStart = await marquee.evaluate((root) => {
          const animation = root
            .querySelector(".sponsor-marquee-track")
            .getAnimations()[0];
          return {
            time: animation.currentTime,
            duration: Number(animation.effect.getTiming().duration),
          };
        });
        await expect
          .poll(
            () =>
              marquee.evaluate(
                (root) =>
                  root
                    .querySelector(".sponsor-marquee-track")
                    .getAnimations()[0].currentTime,
              ),
            { timeout: mobileStart.duration + 10000, intervals: [100] },
          )
          .toBeGreaterThanOrEqual(mobileStart.time + mobileStart.duration);
        results.marquee.mobileFullCycles = 1;
        results.marquee.mobileDuration = mobileStart.duration;
        await panel.screenshot({
          path: `${output}/screenshots/sponsor-preview-390-cycle-1.png`,
        });
        console.log(JSON.stringify({ phase: "mobile-marquee", fullCycles: 1 }));
        await save();
      }
    }
    await preview
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(
      preview.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await previewContext.close();
  }
} finally {
  await browser.close();
}
const safari = await webkit.launch({ headless: true });
try {
  const page = await safari.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  await page.goto(`${origin}/en/gallery`);
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  results.webkit = await video.evaluate((v) => ({
    muted: v.muted,
    inline: v.playsInline,
    loop: v.loop,
    width: v.videoWidth,
    height: v.videoHeight,
    error: v.error?.code || null,
  }));
  await video.evaluate((v) => {
    v.currentTime = v.duration - 0.2;
  });
  await expect
    .poll(() => video.evaluate((v) => v.currentTime < 1 && !v.paused))
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
  await page.getByRole("button", { name: /^Play video:/ }).click();
  await expect.poll(() => video.evaluate((v) => v.paused)).toBe(false);
  await page.screenshot({
    path: `${output}/screenshots/webkit-gallery-390.png`,
  });
} finally {
  await safari.close();
}
expect(results.errors).toEqual([]);
await writeFile(`${output}/live-review.json`, JSON.stringify(results, null, 2));
console.log(
  JSON.stringify({
    views: results.pages.length,
    publicPartners: results.publicPartners,
    videoCycles: results.video.realFullCycles,
    marqueeCycles: results.marquee?.realFullCycles,
    webkit: results.webkit,
    errors: results.errors,
  }),
);

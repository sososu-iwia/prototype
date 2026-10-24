import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = process.env.VERIFICATION_DIR || "docs/verification";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [];
for (const width of [1440, 768, 390]) {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => issues.push({ width, error: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error") issues.push({ width, console: m.text() });
  });
  page.on("response", (r) => {
    if (r.status() >= 400)
      issues.push({ width, status: r.status(), url: r.url() });
  });
  for (const route of ["", "/about", "/team", "/matches"]) {
    await page.goto(`http://localhost:3000/kk${route}`, {
      waitUntil: "networkidle",
    });
    // Full-page screenshots alone do not trigger images below the viewport.
    await page.evaluate(async () => {
      for (
        let y = 0;
        y < document.documentElement.scrollHeight;
        y += innerHeight
      ) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      scrollTo(0, 0);
    });
    for (const image of await page.locator("img").all()) {
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      const handle = await image.elementHandle();
      await page.waitForFunction((element) => element.complete, handle);
      await handle.dispose();
    }
    await page.evaluate(async () => {
      scrollTo(0, 0);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    const missingImages = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((image) => !image.naturalWidth)
          .map((image) => image.currentSrc || image.src),
      );
    for (const url of missingImages)
      issues.push({ width, route, missingImage: url });
    await page.screenshot({
      path: `${output}/${route.slice(1) || "index"}-${width}.png`,
      fullPage: true,
    });
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      lang: document.documentElement.lang,
    }));
    if (dimensions.width > width)
      issues.push({ width, route, overflow: dimensions.width });
  }
  await page.close();
}
await browser.close();
await writeFile(
  `${output}/browser-issues.json`,
  JSON.stringify(issues, null, 2),
);
console.log(JSON.stringify(issues));
if (issues.length) process.exitCode = 1;

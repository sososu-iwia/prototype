import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output =
  process.env.VERIFICATION_DIR || "docs/verification/redesign/after";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [];
for (const width of [390, 768, 1024, 1440, 1920]) {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => issues.push({ width, error: e.message }));
  page.on("response", (r) => {
    if (r.status() >= 400)
      issues.push({ width, status: r.status(), url: r.url() });
  });
  for (const route of [
    "/kk",
    "/kk/academy",
    "/kk/academy/admission",
    "/kk/teams/first-team",
    "/kk/teams/first-league",
    "/kk/teams/second-league",
    "/kk/partners",
  ]) {
    await page.goto(`http://localhost:3000${route}`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(async () => {
      for (
        let y = 0;
        y < document.documentElement.scrollHeight;
        y += innerHeight
      ) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      scrollTo(0, 0);
      await document.fonts.ready;
    });
    const status = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      images: [...document.images]
        .filter((i) => i.complete && !i.naturalWidth)
        .map((i) => i.src),
    }));
    if (status.overflow || status.images.length)
      issues.push({ width, route, ...status });
    await page.screenshot({
      path: `${output}/${route.replaceAll("/", "-").slice(1)}-${width}.png`,
      fullPage: true,
    });
  }
  for (const locale of ["ru", "en"]) {
    for (const path of [
      "",
      "/academy",
      "/academy/admission",
      "/teams/first-team",
      "/teams/first-league",
      "/teams/second-league",
      "/partners",
    ]) {
      const route = `/${locale}${path}`;
      await page.goto(`http://localhost:3000${route}`, {
        waitUntil: "networkidle",
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        issues.push({ width, route, overflow: true });
    }
  }
  await page.close();
}
await browser.close();
await writeFile(`${output}/issues.json`, JSON.stringify(issues, null, 2));
console.log(JSON.stringify({ screenshots: 35, issues }, null, 2));
if (issues.length) process.exitCode = 1;

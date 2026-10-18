import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("docs/baseline", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
for (const width of [1440, 768, 390]) {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push({ width, error: e.message }));
  page.on("response", (r) => {
    if (r.status() >= 400)
      errors.push({ width, url: r.url(), status: r.status() });
  });
  for (const route of ["index", "about", "team", "matches"]) {
    await page.goto(`http://127.0.0.1:4170/${route}.html`, {
      waitUntil: "networkidle",
    });
    for (
      let y = 0;
      y < (await page.evaluate(() => document.body.scrollHeight));
      y += 700
    ) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `docs/baseline/${route}-${width}.png`,
      fullPage: true,
    });
  }
  await page.close();
}
await writeFile("docs/baseline/errors.json", JSON.stringify(errors, null, 2));
await browser.close();
console.log("12 baseline screenshots saved");

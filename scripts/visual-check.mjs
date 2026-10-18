import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("docs/verification", { recursive: true });
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
    await page.screenshot({
      path: `docs/verification/${route.slice(1) || "index"}-${width}.png`,
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
  "docs/verification/browser-issues.json",
  JSON.stringify(issues, null, 2),
);
console.log(JSON.stringify(issues));

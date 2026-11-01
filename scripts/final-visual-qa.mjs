import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const origin = process.env.VERIFY_ORIGIN || "http://localhost:3000";
const output =
  process.env.VISUAL_QA_DIR || "docs/verification/final-qa-20261030/inspection";
const widths = (process.env.VISUAL_WIDTHS || "390,768,1024,1440,1920")
  .split(",")
  .map(Number);
const locales = (process.env.VISUAL_LOCALES || "kk,ru,en").split(",");
const paths = process.env.VISUAL_PATHS
  ? JSON.parse(process.env.VISUAL_PATHS)
  : [
      "",
      "/about",
      "/#honours",
      "/team",
      "/teams/first-team",
      "/teams/first-league",
      "/teams/second-league",
      "/players",
      "/players/bekhan-shaizada",
      "/matches",
      "/statistics",
      "/standings",
      "/news",
      "/news/website-archive",
      "/gallery",
      "/academy",
      "/academy/admission",
      "/partners",
      "/privacy",
    ];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [],
  pages = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    let route = "";
    page.on("pageerror", (e) =>
      issues.push({ width, route, type: "pageerror", message: e.message }),
    );
    page.on("console", (m) => {
      if (m.type() === "error")
        issues.push({ width, route, type: "console", message: m.text() });
    });
    page.on("response", (r) => {
      if (r.status() >= 400)
        issues.push({ width, route, status: r.status(), url: r.url() });
    });
    for (const locale of locales)
      for (const path of paths) {
        route = `/${locale}${path}`;
        const response = await page.goto(origin + route, {
          waitUntil: "networkidle",
        });
        await page.evaluate(async () => {
          await document.fonts.ready;
          for (let y = 0; y < document.documentElement.scrollHeight; y += 800) {
            scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 50));
          }
          await Promise.all(
            [...document.images].map((i) =>
              i.complete
                ? Promise.resolve()
                : new Promise((r) => {
                    i.onload = r;
                    i.onerror = r;
                  }),
            ),
          );
          scrollTo(0, 0);
        });
        const result = await page.evaluate(() => ({
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          lang: document.documentElement.lang,
          h1: document.querySelector("h1")?.textContent,
          brokenImages: [...document.images]
            .filter((i) => !i.naturalWidth)
            .map((i) => i.currentSrc),
          clippedHeadings: [...document.querySelectorAll("h1,h2,h3")]
            .filter(
              (h) =>
                h.getBoundingClientRect().width > 0 &&
                (h.scrollWidth > h.clientWidth + 2 ||
                  h.getBoundingClientRect().right > innerWidth + 1),
            )
            .map((h) => h.textContent),
          smallButtons: [...document.querySelectorAll("button")]
            .filter(
              (b) =>
                b.getBoundingClientRect().width > 0 &&
                b.getBoundingClientRect().height < 40,
            )
            .map((b) => ({
              label: b.getAttribute("aria-label") || b.textContent,
              height: b.getBoundingClientRect().height,
            })),
        }));
        if (
          result.documentWidth > width ||
          result.brokenImages.length ||
          result.clippedHeadings.length
        )
          issues.push({ width, route, ...result });
        const name = `${locale}-${
          path
            .replaceAll("/", "-")
            .replace(/[?#=&]/g, "-")
            .replace(/^-+/, "") || "home"
        }-${width}`;
        if (locale === "kk" || width === 390 || width === 1440) {
          if (path.includes("#")) {
            // Crop the document capture: a tall locator screenshot scrolls its
            // heading under the sticky header on mobile.
            const bounds = await page
              .locator("#honours")
              .evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return {
                  left: Math.round(rect.left + scrollX),
                  top: Math.round(rect.top + scrollY),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                };
              });
            const documentImage = await page.screenshot({ fullPage: true });
            await sharp(documentImage)
              .extract(bounds)
              .toFile(`${output}/${name}.png`);
          } else
            await page.screenshot({
              path: `${output}/${name}.png`,
              fullPage: true,
            });
        }
        pages.push({
          route,
          status: response.status(),
          viewport: width,
          ...result,
        });
      }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/pages.json`, JSON.stringify(pages, null, 2));
await writeFile(`${output}/issues.json`, JSON.stringify(issues, null, 2));
console.log(JSON.stringify({ pages: pages.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;

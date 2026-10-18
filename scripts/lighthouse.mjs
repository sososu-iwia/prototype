import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("docs/verification/lighthouse", { recursive: true });
const chrome = await launch({
  ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
  chromeFlags: ["--headless", "--no-sandbox"],
});
const rows = [];
try {
  for (const route of ["", "/team", "/matches", "/news"]) {
    const name = route.slice(1) || "home";
    const result = await lighthouse(`http://localhost:3000/kk${route}`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    await writeFile(`docs/verification/lighthouse/${name}.json`, result.report);
    rows.push({
      route,
      scores: Object.fromEntries(
        Object.entries(result.lhr.categories).map(([k, v]) => [k, v.score]),
      ),
      LCP: result.lhr.audits["largest-contentful-paint"].numericValue,
      CLS: result.lhr.audits["cumulative-layout-shift"].numericValue,
      failed: Object.entries(result.lhr.audits)
        .filter(
          ([, a]) =>
            a.score !== null &&
            a.score < 0.9 &&
            a.details?.type !== "opportunity",
        )
        .map(([id, a]) => ({ id, title: a.title, score: a.score })),
    });
  }
} finally {
  await chrome.kill();
}
await writeFile(
  "docs/verification/lighthouse/summary.json",
  JSON.stringify(rows, null, 2),
);
console.log(JSON.stringify(rows, null, 2));

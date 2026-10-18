import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome", headless: true });
const context = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const rows = [];
for (const route of ["", "/team", "/matches", "/news", "/gallery", "/about"]) {
  await page.goto("http://localhost:3000/kk" + route);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  rows.push({
    route,
    violations: r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
}
await b.close();
await writeFile(
  "docs/verification/accessibility.json",
  JSON.stringify(rows, null, 2),
);
console.log(JSON.stringify(rows, null, 2));

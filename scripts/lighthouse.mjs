import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const output = join(
  process.env.VERIFICATION_DIR || "docs/verification",
  "lighthouse",
);
const origin = process.env.VERIFY_ORIGIN || "http://localhost:3000";
const runs = Number(process.env.LIGHTHOUSE_RUNS || 3);
if (!Number.isInteger(runs) || runs < 3 || runs > 10)
  throw new Error("Use at least three cold runs (LIGHTHOUSE_RUNS=3..10)");
const samples = new Map(
  (process.env.LIGHTHOUSE_PATHS
    ? JSON.parse(process.env.LIGHTHOUSE_PATHS)
    : ["", "/team", "/matches", "/news"]
  ).map((route) => [route, []]),
);
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (let run = 1; run <= runs; run++) {
  const directory = join(output, `run-${run}`);
  await mkdir(directory, { recursive: true });
  for (const [route, rows] of samples) {
    if (typeof route !== "string" || !/^(\/[a-z0-9/-]+)?$/.test(route))
      throw new Error("Expected relative public route paths");
    const filename = route.slice(1).replaceAll("/", "-") || "home";
    // New Chrome profile for EVERY measurement, default mobile preset/throttling.
    const chrome = await launch({
      ...(process.env.CHROME_PATH
        ? { chromePath: process.env.CHROME_PATH }
        : {}),
      chromeFlags: ["--headless", "--no-sandbox"],
    });
    try {
      const result = await lighthouse(`${origin}/kk${route}`, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
      });
      if (result.lhr.runtimeError)
        throw new Error(JSON.stringify(result.lhr.runtimeError));
      await writeFile(join(directory, `${filename}.json`), result.report);
      if (run === 1) {
        await writeFile(
          join(directory, `${filename}.trace.json`),
          JSON.stringify(result.artifacts.Trace),
        );
        await writeFile(
          join(directory, `${filename}.network.json`),
          JSON.stringify(result.artifacts.DevtoolsLog),
        );
      }
      const sample = {
        run,
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([key, value]) => [
            key,
            value.score,
          ]),
        ),
        LCP: result.lhr.audits["largest-contentful-paint"].numericValue,
        CLS: result.lhr.audits["cumulative-layout-shift"].numericValue,
        lcpElement: result.lhr.audits["lcp-breakdown-insight"]?.details,
      };
      rows.push(sample);
      console.log(JSON.stringify({ route: route || "/", ...sample }));
    } finally {
      await chrome.kill();
    }
  }
}
const summary = [...samples].map(([route, rows]) => ({
  route: route || "/",
  samples: rows.length,
  scores: Object.fromEntries(
    Object.keys(rows[0].scores).map((key) => [
      key,
      median(rows.map((row) => row.scores[key])),
    ]),
  ),
  LCP: median(rows.map((row) => row.LCP)),
  LCPRange: [
    Math.min(...rows.map((row) => row.LCP)),
    Math.max(...rows.map((row) => row.LCP)),
  ],
  CLS: Math.max(...rows.map((row) => row.CLS)),
  performanceRange: [
    Math.min(...rows.map((row) => row.scores.performance)),
    Math.max(...rows.map((row) => row.scores.performance)),
  ],
}));
await writeFile(
  join(output, "aggregate.json"),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
if (
  summary.some(
    (row) =>
      row.LCP >= 2500 ||
      row.CLS > 0.1 ||
      row.scores.performance < 0.9 ||
      row.scores.accessibility < 0.95 ||
      row.scores.seo < 0.95,
  )
) {
  console.error(
    "Performance/accessibility release target unmet; see aggregate.json and individual reports.",
  );
  process.exitCode = 1;
}

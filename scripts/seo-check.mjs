import { load } from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";
const output = process.env.VERIFICATION_DIR || "docs/verification";
await mkdir(output, { recursive: true });
const checks = [];
for (const locale of ["kk", "ru", "en"])
  for (const route of [
    "",
    "/about",
    "/team",
    "/players",
    "/statistics",
    "/standings",
    "/team/bekhan-shaizada",
    "/matches",
    "/news",
    "/news/website-archive",
    "/gallery",
  ]) {
    const path = `/${locale}${route}`,
      res = await fetch("http://localhost:3000" + path);
    const $ = load(await res.text());
    const scripts = $("script:not([src])")
      .toArray()
      .filter((el) => !$(el).attr("nonce"));
    checks.push({
      path,
      status: res.status,
      finalPath: new URL(res.url).pathname,
      lang: $("html").attr("lang"),
      title: $("title").text(),
      openGraph: $("meta[property='og:image']").attr("content"),
      canonical: $("link[rel=canonical]").attr("href"),
      hreflang: $("link[hreflang]").length,
      cspNonce: res.headers.get("content-security-policy")?.includes("'nonce-"),
      inlineScriptsWithoutNonce: scripts.length,
    });
  }
await writeFile(`${output}/seo.json`, JSON.stringify(checks, null, 2));
const bad = checks.filter(
  (c) =>
    c.status !== 200 ||
    c.lang !== c.path.split("/")[1] ||
    !c.title ||
    !c.openGraph ||
    !c.canonical?.endsWith(c.finalPath) ||
    c.hreflang < 4 ||
    !c.cspNonce ||
    c.inlineScriptsWithoutNonce,
);
console.log({ pages: checks.length, failures: bad });
if (bad.length) process.exitCode = 1;

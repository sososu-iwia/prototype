import { readdir, readFile } from "node:fs/promises";
const issues = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (["node_modules", ".next", "dist", "generated"].includes(entry.name))
      continue;
    if (entry.isDirectory()) await walk(path);
    else if (/\.(tsx?|m?js|json|ya?ml)$/.test(path)) {
      const s = await readFile(path, "utf8");
      for (const pattern of [
        /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
        /(?:API_FOOTBALL_KEY|ADMIN_PASSWORD)\s*[:=]\s*["'][^"']{8,}["']/g,
      ])
        if (pattern.test(s)) issues.push(path);
      if (
        dir.startsWith("apps/web") &&
        /localStorage\.(?:setItem|getItem)\(['"](?:token|password|access|refresh)/i.test(
          s,
        )
      )
        issues.push(path);
    }
  }
}
await walk("apps");
await walk("scripts");
if (issues.length) {
  console.error([...new Set(issues)]);
  process.exitCode = 1;
} else
  console.log(
    "Source scan passed: no matching secrets or browser-stored auth tokens. This is a pattern scan, not a penetration test.",
  );

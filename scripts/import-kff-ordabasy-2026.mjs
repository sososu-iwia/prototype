import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "scripts/import-kff-ordabasy-2026.ts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: process.env },
);
process.exitCode = result.status ?? 1;

// Run from the build/development image; the production API deliberately omits tsx.
import { spawnSync } from "node:child_process";
const r = spawnSync("npm", ["run", "db:seed"], {
  stdio: "inherit",
  env: process.env,
});
process.exitCode = r.status || 0;

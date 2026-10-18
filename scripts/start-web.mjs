import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
const web = join(root, "apps/web"),
  standalone = join(web, ".next/standalone");
await cp(join(web, "public"), join(standalone, "apps/web/public"), {
  recursive: true,
});
await cp(join(web, ".next/static"), join(standalone, "apps/web/.next/static"), {
  recursive: true,
});
const server = spawn(
  process.execPath,
  [join(standalone, "apps/web/server.js")],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: process.env.PORT || "3000",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => {
  process.exitCode = code || 0;
});

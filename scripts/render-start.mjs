import { spawn } from "node:child_process";
import { apiDirectory, verifyRuntimeDatabase } from "./render-check.mjs";

try {
  await verifyRuntimeDatabase();
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDirectory,
    env: process.env,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("API process failed to start.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "API release blocked: check the runtime role and apply reviewed migrations separately. No migration was attempted.",
  );
  process.exitCode = 1;
}

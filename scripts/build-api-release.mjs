import { writeFile } from "node:fs/promises";
import { expectedMigrations, apiDirectory } from "./render-check.mjs";
await writeFile(
  `${apiDirectory}/src/release-manifest.json`,
  JSON.stringify(await expectedMigrations()),
);

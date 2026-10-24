import { build } from "esbuild";
import { resolve, relative, sep } from "node:path";

// Exercise the actual compiled production API, without bundling its executable entry point.
const sourceRoot = resolve("apps/api/src");
await build({
  entryPoints: [
    "tests/integration/api.test.ts",
    "tests/integration/cms.test.ts",
    "tests/integration/integrity.test.ts",
  ],
  outdir: "verification",
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  sourcemap: true,
  plugins: [
    {
      name: "production-api",
      setup(builder) {
        builder.onResolve({ filter: /apps\/api\/src\// }, (args) => {
          const source = resolve(args.resolveDir, args.path);
          if (!source.startsWith(sourceRoot + sep))
            throw new Error("Unexpected API import");
          return {
            path: resolve(
              "apps/api/dist",
              relative(sourceRoot, source).replace(/\.ts$/, "") + ".js",
            ),
            external: true,
          };
        });
      },
    },
  ],
});

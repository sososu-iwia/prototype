// Own disposable S3 fixture only; DATABASE_URL must name an isolated test DB.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const database = decodeURIComponent(
  new URL(process.env.DATABASE_URL || "").pathname.slice(1),
);
if (!/(?:^|_)test(?:_|$)/.test(database))
  throw new Error("An isolated test database is required");
const name = `ordabasy-direct-test-${randomUUID().slice(0, 8)}`;
const bucket = `ordabasy-test-${randomUUID().slice(0, 8)}`;
try {
  const created = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "--tmpfs",
      "/s3mockroot",
      "-p",
      "127.0.0.1::9090",
      "adobe/s3mock:5.1.0",
    ],
    { encoding: "utf8" },
  );
  if (created.status !== 0)
    throw new Error("Could not start disposable S3 fixture");
  const address = spawnSync("docker", ["port", name, "9090/tcp"], {
    encoding: "utf8",
  }).stdout.trim();
  const endpoint = `http://127.0.0.1:${address.split(":").at(-1)}`;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status < 500) break;
    } catch {
      if (i === 99) throw new Error("S3 fixture did not become ready");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", "verification/serverless.test.js"],
      {
        env: {
          ...process.env,
          VERIFY_DIRECT_S3: "true",
          MEDIA_STORAGE: "s3",
          S3_ENDPOINT: endpoint,
          S3_BUCKET: bucket,
          S3_REGION: "us-east-1",
          S3_FORCE_PATH_STYLE: "true",
          S3_ACCESS_KEY_ID: "isolated-test",
          S3_SECRET_ACCESS_KEY: "isolated-test",
        },
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) throw new Error("Direct S3 upload verification failed");
} finally {
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
if (existsSync(resolve(__dirname, "../../../.env")))
  config({ path: resolve(__dirname, "../../../.env"), quiet: true });
export const production = process.env.NODE_ENV === "production";
export const origins = (process.env.TRUSTED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((v) => v.trim());
export const secureCookie = process.env.COOKIE_SECURE === "true";
export const mediaDir = resolve(
  __dirname,
  "../../..",
  process.env.MEDIA_DIR || "media-data",
);
export function validateConfig() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required. Copy .env.example and configure PostgreSQL.",
    );
  const localHttp =
    process.env.ALLOW_LOCAL_HTTP === "true" &&
    origins.every((o) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  if (
    production &&
    !localHttp &&
    (!secureCookie ||
      origins.some((o) => !o.startsWith("https://") || o.includes("*")))
  )
    throw new Error(
      "Production requires HTTPS trusted origins and COOKIE_SECURE=true.",
    );
}

export function validateStorage() {
  if (process.env.MEDIA_STORAGE === "s3" && !process.env.S3_BUCKET)
    throw new Error("S3_BUCKET required");
  if (
    production &&
    process.env.ALLOW_LOCAL_HTTP !== "true" &&
    process.env.MEDIA_STORAGE !== "s3"
  )
    throw new Error("Production requires independent S3 media storage");
}

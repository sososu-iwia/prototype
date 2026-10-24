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
function localHttpPreview() {
  return (
    process.env.ALLOW_LOCAL_HTTP === "true" &&
    [...origins, process.env.PUBLIC_ORIGIN || origins[0]].every((o) =>
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o),
    )
  );
}
function validOrigin(value: string, httpsOnly = false) {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.username &&
      !url.password &&
      !url.hostname.includes("*") &&
      (httpsOnly
        ? url.protocol === "https:"
        : ["http:", "https:"].includes(url.protocol))
    );
  } catch {
    return false;
  }
}
export function validateConfig() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required. Copy .env.example and configure PostgreSQL.",
    );
  const publicOrigin = process.env.PUBLIC_ORIGIN || origins[0];
  if (![...origins, publicOrigin].every((value) => validOrigin(value)))
    throw new Error(
      "PUBLIC_ORIGIN and TRUSTED_ORIGINS must contain exact HTTP(S) origins without paths, credentials or wildcards.",
    );
  if (
    production &&
    !localHttpPreview() &&
    (!secureCookie ||
      ![...origins, publicOrigin].every((value) => validOrigin(value, true)))
  )
    throw new Error(
      "Production requires HTTPS trusted origins and COOKIE_SECURE=true.",
    );
}

export function validateStorage() {
  if (
    process.env.MEDIA_STORAGE &&
    !["local", "s3", "disabled"].includes(process.env.MEDIA_STORAGE)
  )
    throw new Error(
      "MEDIA_STORAGE must be local, s3 or explicitly disabled in demo mode",
    );
  if (process.env.MEDIA_STORAGE === "disabled") {
    if (process.env.DEMO_MODE !== "true")
      throw new Error("Disabled media storage requires DEMO_MODE=true");
    return;
  }
  if (process.env.MEDIA_STORAGE === "s3" && !process.env.S3_BUCKET)
    throw new Error("S3_BUCKET required");
  if (production && !localHttpPreview() && process.env.MEDIA_STORAGE !== "s3")
    throw new Error("Production requires independent S3 media storage");
}

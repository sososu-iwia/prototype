import sharp from "sharp";
import { writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const source = "images/hero.jpg";
const metadata = await sharp(source).metadata();
const width = metadata.width,
  height = metadata.height;
if (!width || !height) throw new Error("Hero source has no dimensions");
const mobileWidth = Math.min(width, 820);
const crop = {
  left: Math.round((width - mobileWidth) * 0.64),
  top: 0,
  width: mobileWidth,
  height,
};
const manifest = {
  source,
  width,
  height,
  sourceSha256: createHash("sha256")
    .update(await readFile(source))
    .digest("hex"),
  mobileCrop: crop,
  desktop: [],
  mobile: [],
};
for (const [group, widths] of [
  ["desktop", [640, 960, 1280, width]],
  ["mobile", [400, 640, mobileWidth]],
]) {
  for (const size of [...new Set(widths)].filter(
    (w) => w <= (group === "mobile" ? mobileWidth : width),
  )) {
    const variant = { width: size };
    for (const format of ["avif", "webp"]) {
      const url = `/media/hero-editorial-v2-${group}-${size}.${format}`;
      const image = sharp(source).rotate();
      if (group === "mobile") image.extract(crop);
      await image
        .resize({ width: size, withoutEnlargement: true })
        [format]({ quality: format === "avif" ? 64 : 90, effort: 6 })
        .toFile(`apps/web/public${url}`);
      variant[format] = url;
      variant[`${format}Bytes`] = (await stat(`apps/web/public${url}`)).size;
    }
    manifest[group].push(variant);
  }
}
await writeFile(
  "packages/content/editorial-hero.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));

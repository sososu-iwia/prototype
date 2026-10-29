import sharp from "sharp";
// Keep the packaged gallery delivery copy reproducible alongside critical images.
import "./build-gallery-video.mjs";
// New filenames keep existing immutable media and originals intact.
await sharp("images/logo.png")
  .resize({ width: 96 })
  .webp({ quality: 85, effort: 6 })
  .toFile("apps/web/public/media/logo-header-96.webp");
for (const [source, name, widths] of [
  ["images/hero.jpg", "hero", [640, 1600]],
  ["images/gallery2.jpg", "gallery2", [640, 960]],
]) {
  for (const width of widths)
    await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 40, effort: 6 })
      .toFile(`apps/web/public/media/${name}-background-${width}.avif`);
}

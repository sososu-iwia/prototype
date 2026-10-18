import { readdir, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
await mkdir("apps/web/public/media", { recursive: true });
const manifest = {};
let before = 0,
  after = 0;
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await walk(file);
    else if (/\.(jpe?g|png)$/i.test(file)) {
      const base = file
        .replace(/^images\//, "")
        .replace(/\.[^.]+$/, "")
        .replaceAll("/", "-")
        .toLowerCase();
      const metadata = await sharp(file).metadata();
      before += (await stat(file)).size;
      const widths = [320, 640, 960, ...(base === "hero" ? [1600] : [])].filter(
        (w) => w <= metadata.width,
      );
      if (!widths.length) widths.push(metadata.width);
      const variants = [];
      for (const width of widths) {
        for (const format of ["webp", "avif"]) {
          const filename = `${base}-${width}.${format}`;
          const out = `apps/web/public/media/${filename}`;
          await sharp(file)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            [format]({
              quality: format === "avif" ? 55 : 82,
              effort: format === "avif" ? 3 : 4,
            })
            .toFile(out);
          after += (await stat(out)).size;
        }
        variants.push({
          width,
          url: `/media/${base}-${width}.webp`,
          avif: `/media/${base}-${width}.avif`,
        });
      }
      manifest[file] = {
        width: metadata.width,
        height: metadata.height,
        variants,
      };
    }
  }
}
await walk("images");
const video = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    "images/gallery1.MP4",
    "-an",
    "-vf",
    "scale=960:-2",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "27",
    "-movflags",
    "+faststart",
    "apps/web/public/media/gallery1.mp4",
  ],
  { encoding: "utf8" },
);
if (video.status !== 0)
  throw Error(
    "ffmpeg is required; originals remain untouched. " +
      video.stderr?.slice(-500),
  );
const frame = spawnSync(
  "ffmpeg",
  [
    "-i",
    "images/gallery1.MP4",
    "-frames:v",
    "1",
    "-vf",
    "scale=960:-2",
    "-f",
    "image2pipe",
    "-c:v",
    "png",
    "pipe:1",
  ],
  { maxBuffer: 10 * 1024 * 1024 },
);
if (frame.status !== 0) throw Error("Could not extract video poster");
await sharp(frame.stdout)
  .webp({ quality: 82 })
  .toFile("apps/web/public/media/gallery1-poster.webp");
await writeFile(
  "packages/content/media-manifest.json",
  JSON.stringify(manifest, null, 2),
);
await writeFile(
  "docs/MEDIA_REPORT.json",
  JSON.stringify(
    {
      originalImageBytes: before,
      responsiveImageBytes: after,
      originalVideoBytes: (await stat("images/gallery1.MP4")).size,
      videoBytes: (await stat("apps/web/public/media/gallery1.mp4")).size,
    },
    null,
    2,
  ),
);
console.log({ images: Object.keys(manifest).length, before, after });

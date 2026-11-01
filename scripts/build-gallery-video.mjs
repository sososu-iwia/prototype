import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
const output = "apps/web/public/media/gallery1-web-v1-960.mp4";
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    "images/gallery1.MP4",
    "-map",
    "0:v:0",
    "-an",
    "-vf",
    "scale=960:720:force_original_aspect_ratio=decrease,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "27",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "60",
    "-movflags",
    "+faststart",
    output,
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) throw Error(`ffmpeg required: ${result.stderr}`);
console.log(
  JSON.stringify({
    output,
    bytes: (await stat(output)).size,
    fps: 30,
    originalPreserved: true,
  }),
);

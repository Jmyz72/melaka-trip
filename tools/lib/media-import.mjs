import { readdir, mkdir, copyFile, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const PHOTO_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v"]);

function pad(n) { return String(n).padStart(2, "0"); }

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", d => { out += d; });
    p.stderr.on("data", d => { err += d; });
    p.on("close", code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exit ${code}: ${err}`)));
  });
}

async function probeVideo(src) {
  const out = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    src
  ]);
  const [w, h] = out.trim().split(",").map(Number);
  return { w, h };
}

async function makePoster(videoPath, posterPath) {
  await run("ffmpeg", ["-y", "-ss", "1", "-i", videoPath, "-vframes", "1", "-q:v", "3", posterPath]);
}

// Imports all photos+videos from `sourceDir` into `media/<id>/`.
// Returns the array suitable for the `media` field of a memories.json entry.
export async function importMedia(sourceDir, id) {
  const targetDir = join("media", id);
  await mkdir(targetDir, { recursive: true });
  const entries = (await readdir(sourceDir)).sort();
  const items = [];
  let n = 0;
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const srcPath = join(sourceDir, entry);
    const isPhoto = PHOTO_EXT.has(ext);
    const isVideo = VIDEO_EXT.has(ext);
    if (!isPhoto && !isVideo) continue;
    n += 1;
    if (isPhoto) {
      const outName = `${pad(n)}.jpg`;
      const outPath = join(targetDir, outName);
      // sharp handles HEIC + reads dims + writes JPEG in one shot.
      const meta = await sharp(srcPath).rotate().jpeg({ quality: 88 }).toFile(outPath);
      items.push({
        src: `media/${id}/${outName}`,
        type: "photo",
        w: meta.width,
        h: meta.height
      });
    } else {
      const outName = `${pad(n)}${ext === ".mov" || ext === ".m4v" ? ".mp4" : ext}`;
      const outPath = join(targetDir, outName);
      await copyFile(srcPath, outPath);
      const posterName = `${pad(n)}-thumb.jpg`;
      const posterPath = join(targetDir, posterName);
      await makePoster(outPath, posterPath);
      const { w, h } = await probeVideo(outPath);
      items.push({
        src: `media/${id}/${outName}`,
        type: "video",
        poster: `media/${id}/${posterName}`,
        w, h
      });
    }
  }
  return items;
}

#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv } from "node:process";
import { spawnSync } from "node:child_process";
import { resolveCoords } from "./lib/resolve-maps.mjs";
import { importMedia } from "./lib/media-import.mjs";
import { firstPhoto, readExif } from "./lib/exif.mjs";

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith("--")) throw new Error(`expected flag, got ${args[i]}`);
    out[args[i].slice(2)] = args[i + 1];
  }
  return out;
}

async function prompt(rl, label, opts = {}) {
  while (true) {
    const v = (await rl.question(`${label}${opts.default ? ` [${opts.default}]` : ""}: `)).trim();
    const val = v || opts.default || "";
    if (!val && opts.required !== false) { console.log("(required)"); continue; }
    if (opts.validate) {
      const err = opts.validate(val);
      if (err) { console.log(err); continue; }
    }
    return val;
  }
}

async function main() {
  const flags = parseFlags(argv.slice(2));
  const rl = createInterface({ input: stdin, output: stdout });

  const id = flags.id ?? await prompt(rl, "id (kebab-case)", {
    validate: v => /^[a-z0-9-]{1,40}$/.test(v) ? null : "must match ^[a-z0-9-]{1,40}$"
  });
  const name = flags.name ?? await prompt(rl, "name (EN + 中文)");
  const mediaDir = flags.media ?? await prompt(rl, "media folder path");

  // Read EXIF from the first photo in the folder to seed prompt defaults.
  let exif = { time: null, lat: null, lng: null, day: null };
  const probe = await firstPhoto(mediaDir).catch(() => null);
  if (probe) {
    exif = await readExif(probe);
    if (exif.time || exif.day || exif.lat != null) {
      const bits = [];
      if (exif.day) bits.push(`day ${exif.day}`);
      if (exif.time) bits.push(exif.time);
      if (exif.lat != null) bits.push(`${exif.lat.toFixed(5)},${exif.lng.toFixed(5)}`);
      console.log(`📷 EXIF defaults from ${probe.split("/").pop()}: ${bits.join(" · ")}`);
    }
  }

  const day = Number(flags.day ?? await prompt(rl, "day (1/2/3)", {
    default: exif.day != null ? String(exif.day) : undefined,
    validate: v => ["1","2","3"].includes(v) ? null : "must be 1, 2, or 3"
  }));
  const time = flags.time ?? await prompt(rl, "time (HH:MM)", {
    default: exif.time ?? undefined,
    validate: v => /^[0-2]\d:[0-5]\d$/.test(v) ? null : "must be HH:MM"
  });
  const exifLatLng = exif.lat != null ? `${exif.lat},${exif.lng}` : undefined;
  const mapsInput = flags.maps ?? await prompt(rl, "maps URL or lat,lng", {
    default: exifLatLng
  });

  rl.close();

  // Resolve coords (handles short URLs, long URLs, or "lat,lng" pairs).
  const { lat, lng } = await resolveCoords(mapsInput);
  const mapsUrl = mapsInput.startsWith("https://")
    ? mapsInput
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Import media
  console.log(`Importing media from ${mediaDir}…`);
  const media = await importMedia(mediaDir, id);
  console.log(`  imported ${media.length} item(s)`);

  // Load existing memories.json
  const memories = JSON.parse(await readFile("memories.json", "utf8"));

  // Auto-assign order if not provided
  const order = flags.order != null
    ? Number(flags.order)
    : Math.max(0, ...memories.filter(m => m.day === day).map(m => m.order)) + 1;

  const entry = { id, name, day, order, time, lat, lng, mapsUrl, media };

  // Upsert
  const i = memories.findIndex(m => m.id === id);
  if (i >= 0) memories[i] = entry; else memories.push(entry);
  memories.sort((a, b) => a.day - b.day || a.order - b.order);

  // Write atomically: write to temp, then rename
  const tmp = "memories.json.tmp";
  await writeFile(tmp, JSON.stringify(memories, null, 2) + "\n");
  const { renameSync } = await import("node:fs");
  renameSync(tmp, "memories.json");

  // Run the data test as a sanity check
  console.log("Running data tests…");
  const result = spawnSync("node", ["--test", "tests/data.test.mjs"], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("\nTests failed — review memories.json. The media files in media/" + id + "/ were kept on disk.");
    process.exit(1);
  }

  console.log(`\n✓ Added/updated "${id}". Next:`);
  console.log(`  git add memories.json media/${id}/`);
  console.log(`  git commit -m "memories: ${id}"`);
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});

#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const RAW = resolve("places.raw.json");
const OUT = resolve("places.json");

async function resolveCoords(shortUrl) {
  let url = shortUrl;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    const loc = res.headers.get("location");
    if (!loc) {
      const body = await res.text();
      const m = body.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                body.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
      return null;
    }
    url = loc.startsWith("http") ? loc : new URL(loc, url).toString();
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
              url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

const raw = JSON.parse(await readFile(RAW, "utf8"));

// Preserve photo + already-resolved coords from the previous places.json.
// Photos are downloaded by tools/add-place.mjs / tools/fetch-photos.mjs into
// images/{id}.jpg and are never carried in raw. Coords are sometimes already
// in places.json (e.g. add-place.mjs writes them directly from the Places API
// for cid-style URLs the resolver below can't follow). Without this preserve
// step, every rebuild would silently drop both.
const prevById = new Map();
try {
  const prev = JSON.parse(await readFile(OUT, "utf8"));
  for (const p of prev) prevById.set(p.id, p);
} catch { /* no previous places.json — first build */ }

const out = [];
let missing = 0;
for (const p of raw) {
  process.stdout.write(`Resolving ${p.id} ... `);
  const prev = prevById.get(p.id);
  const photo = prev?.photo ?? null;
  const coords = await resolveCoords(p.mapsUrl);
  if (coords) {
    console.log(`${coords.lat}, ${coords.lng}`);
    out.push({ ...p, lat: coords.lat, lng: coords.lng, photo });
  } else if (prev && typeof prev.lat === "number" && typeof prev.lng === "number") {
    console.log(`kept ${prev.lat}, ${prev.lng} (resolver could not follow ${p.mapsUrl.slice(0, 40)}…)`);
    out.push({ ...p, lat: prev.lat, lng: prev.lng, photo });
  } else {
    console.log("MISSING");
    missing++;
    out.push({ ...p, lat: null, lng: null, photo });
  }
}

await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${out.length} places to places.json. Missing coords: ${missing}.`);
if (missing > 0) {
  console.log("Open the listed mapsUrl in a browser, copy the @lat,lng from the URL, and paste into places.json manually.");
  process.exit(1);
}

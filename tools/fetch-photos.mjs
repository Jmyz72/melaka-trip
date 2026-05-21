#!/usr/bin/env node
// One-time: download one photo per place via Google Places API (New).
// Reads .env.local for GOOGLE_PLACES_API_KEY. Writes images/{id}.jpg and updates places.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const ENV = await readFile(".env.local", "utf8").catch(() => "");
const KEY = (ENV.match(/GOOGLE_PLACES_API_KEY=(\S+)/) || [])[1] || process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in .env.local or env");
  process.exit(1);
}

const PLACES_JSON = resolve("places.json");
const IMAGES_DIR = resolve("images");
await mkdir(IMAGES_DIR, { recursive: true });

const places = JSON.parse(await readFile(PLACES_JSON, "utf8"));

async function findPhotoName(p) {
  // Text Search (New) supports CJK directly, so keep the original name and
  // only drop parenthetical asides (which often hold disambiguators like
  // "(loklok 宵夜)" that throw the match off).
  let cleanName = p.name.replace(/\(.*?\)/g, "").trim();
  if (!cleanName) cleanName = p.id.replace(/-/g, " ");
  const query = `${cleanName} Melaka`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.location"
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 }
      },
      maxResultCount: 5
    })
  });
  if (!res.ok) {
    console.log(`  search failed (${res.status}): ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  const results = json.places || [];
  // Pick the result closest to our known coords that has photos.
  const sorted = results
    .map(r => ({
      r,
      photos: r.photos || [],
      d: Math.hypot((r.location?.latitude ?? 0) - p.lat, (r.location?.longitude ?? 0) - p.lng)
    }))
    .filter(x => x.photos.length > 0)
    .sort((a, b) => a.d - b.d);
  if (sorted.length === 0) return null;
  return sorted[0].photos[0].name; // e.g. "places/XXX/photos/YYY"
}

async function downloadPhoto(photoName, outPath) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`;
  const res = await fetch(url, { headers: { "X-Goog-Api-Key": KEY } });
  if (!res.ok) {
    console.log(`  download failed (${res.status})`);
    return false;
  }
  const json = await res.json();
  const photoUri = json.photoUri;
  if (!photoUri) return false;
  const imgRes = await fetch(photoUri);
  if (!imgRes.ok) return false;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await writeFile(outPath, buf);
  return true;
}

// Optional argv filter: `node tools/fetch-photos.mjs id1 id2 ...` only
// refreshes those entries. Useful when one place's photo is wrong and
// you don't want to re-roll all 30.
const argv = process.argv.slice(2);
const onlyIds = argv.length ? new Set(argv) : null;

let ok = 0, miss = 0, skipped = 0;
for (const p of places) {
  if (onlyIds && !onlyIds.has(p.id)) { skipped++; continue; }
  const out = `images/${p.id}.jpg`;
  process.stdout.write(`${p.id} ... `);
  try {
    const photoName = await findPhotoName(p);
    if (!photoName) { console.log("no photo"); miss++; continue; }
    const got = await downloadPhoto(photoName, out);
    if (got) { console.log("ok"); ok++; p.photo = out; }
    else { console.log("download failed"); miss++; }
  } catch (e) {
    console.log("error:", e.message);
    miss++;
  }
}

await writeFile(PLACES_JSON, JSON.stringify(places, null, 2) + "\n");
console.log(`\nDone. Photos: ${ok} ok, ${miss} missing.`);
if (miss > 0) {
  console.log("Missing ones can be filled in manually by editing places.json with a photo path.");
}

#!/usr/bin/env node
// Precomputes driving times between every pair of places using the Google
// Distance Matrix API. Writes the result to lib/drives.json, which the app
// will load at startup (replacing the haversine heuristic for any pair it
// has a real number for).
//
// Setup:
//   1. In the Google Cloud Console, enable the "Distance Matrix API".
//   2. Create an API key (restrict to that API for safety).
//   3. Run:  GOOGLE_MAPS_API_KEY=AIza... node tools/precompute-drives.mjs
//
// Cost: ~840 elements (29×29 places). At $5/1000 elements that is ~$4.20,
// which is fully covered by the $200/month free credit. Re-run only when
// you add or move a place.
//
// The script is idempotent and only writes if results differ.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("error: set GOOGLE_MAPS_API_KEY in your environment.");
  console.error("       export GOOGLE_MAPS_API_KEY=AIza...");
  process.exit(1);
}

const places = JSON.parse(await readFile(resolve(root, "places.json"), "utf8"));
const located = places.filter(p => typeof p.lat === "number" && typeof p.lng === "number");
console.log(`Found ${located.length} located places out of ${places.length}.`);

// Distance Matrix limits: 25 origins × 25 destinations per request, 100
// elements total. So we batch destinations 10-at-a-time per origin, which
// keeps every request under 25 elements and well within rate limits.
const BATCH = 10;
const table = {};
let calls = 0;

for (const from of located) {
  for (let i = 0; i < located.length; i += BATCH) {
    const dests = located.slice(i, i + BATCH);
    const params = new URLSearchParams({
      origins: `${from.lat},${from.lng}`,
      destinations: dests.map(d => `${d.lat},${d.lng}`).join("|"),
      mode: "driving",
      key: API_KEY
    });
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`HTTP ${res.status} for origin ${from.id}`);
      process.exit(2);
    }
    const data = await res.json();
    calls++;
    if (data.status !== "OK") {
      console.error(`API error for origin ${from.id}: ${data.status} ${data.error_message ?? ""}`);
      process.exit(2);
    }
    const row = data.rows[0].elements;
    for (let j = 0; j < dests.length; j++) {
      const to = dests[j];
      const el = row[j];
      if (el.status !== "OK") continue;
      const minutes = Math.round(el.duration.value / 60);
      table[`${from.id}__${to.id}`] = minutes;
    }
    process.stdout.write(`. (${calls} calls, ${Object.keys(table).length} pairs)\r`);
  }
}
process.stdout.write("\n");

// Compare with existing file, skip write if unchanged.
const outPath = resolve(root, "lib/drives.json");
let prev = null;
try { prev = JSON.parse(await readFile(outPath, "utf8")); } catch { /* first run */ }
const sortedTable = Object.fromEntries(Object.entries(table).sort());
const json = JSON.stringify(sortedTable, null, 2) + "\n";
if (prev && JSON.stringify(Object.fromEntries(Object.entries(prev).sort()), null, 2) + "\n" === json) {
  console.log("No changes — drives.json is already up to date.");
} else {
  await writeFile(outPath, json);
  console.log(`Wrote ${Object.keys(sortedTable).length} pairs to lib/drives.json (${calls} API calls).`);
}

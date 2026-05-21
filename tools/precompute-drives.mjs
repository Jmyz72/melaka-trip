#!/usr/bin/env node
// Precomputes driving times between every pair of places using the Google
// Routes API (computeRouteMatrix). Writes the result to lib/drives.json,
// which the app loads at startup (replacing the haversine heuristic for any
// pair it has a real number for).
//
// Setup:
//   1. In the Google Cloud Console, enable the "Routes API".
//   2. Create an API key (restrict to that API for safety).
//   3. Run:  GOOGLE_MAPS_API_KEY=AIza... node tools/precompute-drives.mjs
//
// Cost: ~841 elements (29x29 places) at $5 / 1000 = ~$4.20, fully covered
// by the $200/month Google Maps free credit. Re-run only when you add or
// move a place.
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

const waypoint = p => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });

// Routes API limit: 625 elements per request. 29x29 = 841 so we split
// destinations into two halves and keep origins whole — two calls total.
const HALF = Math.ceil(located.length / 2);
const destBatches = [located.slice(0, HALF), located.slice(HALF)];

const table = {};
let calls = 0;

for (const dests of destBatches) {
  const body = {
    origins: located.map(waypoint),
    destinations: dests.map(waypoint),
    travelMode: "DRIVE",
    // TRAFFIC_AWARE uses Google's live traffic prediction for the given
    // departureTime. Day 1 (Fri 22 May 2026) 8am MYT — the long Seremban →
    // Melaka leg drives at that hour, so its number is the most realistic.
    // Intra-Melaka pairs will be peak-ish, which is conservative for
    // planning. Routes API requires departureTime to be in the future and
    // within 7 days; rerun closer to the date for fresher predictions.
    routingPreference: "TRAFFIC_AWARE",
    departureTime: "2026-05-22T08:00:00+08:00"
  };
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`HTTP ${res.status}: ${errText}`);
    process.exit(2);
  }
  const rows = await res.json();
  calls++;
  if (!Array.isArray(rows)) {
    console.error("Unexpected response shape:", JSON.stringify(rows).slice(0, 500));
    process.exit(2);
  }
  for (const el of rows) {
    if (el.condition !== "ROUTE_EXISTS") continue;
    const from = located[el.originIndex];
    const to = dests[el.destinationIndex];
    if (!from || !to) continue;
    const seconds = parseInt(String(el.duration).replace(/s$/, ""), 10);
    if (!Number.isFinite(seconds)) continue;
    table[`${from.id}__${to.id}`] = Math.round(seconds / 60);
  }
  process.stdout.write(`. (${calls} calls, ${Object.keys(table).length} pairs)\r`);
}
process.stdout.write("\n");

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

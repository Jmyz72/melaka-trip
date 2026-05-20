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
const out = [];
let missing = 0;
for (const p of raw) {
  process.stdout.write(`Resolving ${p.id} ... `);
  const coords = await resolveCoords(p.mapsUrl);
  if (!coords) {
    console.log("MISSING");
    missing++;
    out.push({ ...p, lat: null, lng: null });
  } else {
    console.log(`${coords.lat}, ${coords.lng}`);
    out.push({ ...p, lat: coords.lat, lng: coords.lng });
  }
}

await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${out.length} places to places.json. Missing coords: ${missing}.`);
if (missing > 0) {
  console.log("Open the listed mapsUrl in a browser, copy the @lat,lng from the URL, and paste into places.json manually.");
  process.exit(1);
}

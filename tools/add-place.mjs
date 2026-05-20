#!/usr/bin/env node
// One-off: add a place to places.raw.json + places.json + images/, using Places API.
// Usage: node tools/add-place.mjs <id> <searchQuery> <section> <category> <mealType> <day> <order>
// Example: node tools/add-place.mjs seremban-market "芙蓉大巴刹 Pasar Besar Seremban" zapbalang food breakfast 1 1
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const ENV = await readFile(".env.local", "utf8").catch(() => "");
const KEY = (ENV.match(/GOOGLE_PLACES_API_KEY=(\S+)/) || [])[1];
if (!KEY) { console.error("Missing GOOGLE_PLACES_API_KEY"); process.exit(1); }

const [, , id, query, section, category, mealType, dayStr, orderStr] = process.argv;
if (!id || !query) {
  console.error("Usage: node tools/add-place.mjs <id> <query> <section> <category> <mealType> <day> <order>");
  process.exit(1);
}
const day = dayStr === "null" ? null : Number(dayStr);
const order = Number(orderStr);

// 1. Text search
const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": KEY,
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.photos,places.googleMapsUri"
  },
  body: JSON.stringify({ textQuery: query, maxResultCount: 1 })
});
if (!searchRes.ok) { console.error("search failed:", await searchRes.text()); process.exit(1); }
const { places: results = [] } = await searchRes.json();
if (results.length === 0) { console.error("no results for", query); process.exit(1); }
const r = results[0];
console.log("Found:", r.displayName?.text, "@", r.location);

// 2. Download photo
let photoPath = null;
if (r.photos && r.photos[0]) {
  await mkdir("images", { recursive: true });
  const photoUrl = `https://places.googleapis.com/v1/${r.photos[0].name}/media?maxWidthPx=800&skipHttpRedirect=true`;
  const pRes = await fetch(photoUrl, { headers: { "X-Goog-Api-Key": KEY } });
  if (pRes.ok) {
    const { photoUri } = await pRes.json();
    if (photoUri) {
      const img = await fetch(photoUri);
      if (img.ok) {
        photoPath = `images/${id}.jpg`;
        await writeFile(resolve(photoPath), Buffer.from(await img.arrayBuffer()));
        console.log("Saved photo to", photoPath);
      }
    }
  }
}

// 3. Format hours
const hoursText = r.regularOpeningHours?.weekdayDescriptions?.join("; ") || "";

// 4. Build entry
const entry = {
  id,
  name: r.displayName?.text || query,
  section,
  category,
  mealType,
  address: r.formattedAddress || "",
  mapsUrl: r.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  durationFromAirbnbMin: null,
  hours: hoursText,
  remarks: "",
  day,
  order,
  lat: r.location.latitude,
  lng: r.location.longitude,
  photo: photoPath
};

// 5. Append to both places.raw.json and places.json
for (const path of ["places.raw.json", "places.json"]) {
  const data = JSON.parse(await readFile(path, "utf8"));
  if (data.find(p => p.id === id)) {
    console.log(`${path}: ${id} already exists, replacing`);
    const i = data.findIndex(p => p.id === id);
    data[i] = path === "places.raw.json"
      ? { id, name: entry.name, section, category, mealType, address: entry.address, mapsUrl: entry.mapsUrl, durationFromAirbnbMin: null, hours: hoursText, remarks: "", day, order }
      : entry;
  } else {
    data.push(path === "places.raw.json"
      ? { id, name: entry.name, section, category, mealType, address: entry.address, mapsUrl: entry.mapsUrl, durationFromAirbnbMin: null, hours: hoursText, remarks: "", day, order }
      : entry);
  }
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`Updated ${path}`);
}

console.log("\nDone. Entry:");
console.log(JSON.stringify(entry, null, 2));

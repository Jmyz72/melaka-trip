# Melaka 3D2N Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static mobile-first HTML page that turns the user's Google Sheet of ~28 Melaka places into an interactive Leaflet map + auto-suggested 3-day itinerary, deployable to GitHub Pages.

**Architecture:** A hand-curated `places.json` is generated once from the PDF via a small Node build script that resolves `goo.gl/maps` short links to GPS coordinates. The page itself is plain HTML + vanilla JS + Leaflet (CDN), with a sticky tab bar switching between Map / Day 1 / Day 2 / Day 3 / All views. No framework, no bundler, no localStorage.

**Tech Stack:** HTML5, vanilla JS (ES modules), Leaflet 1.9.x via CDN, Node 20+ for the one-time build script, `node:test` for validation tests, OpenStreetMap tiles, GitHub Pages for hosting.

---

### Task 1: Initialise project and commit existing artefacts

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/.gitignore`

- [ ] **Step 1: Initialise the git repo**

Run:
```bash
cd /Users/jimmyhew/Documents/melaka-trip
git init -b main
```
Expected: `Initialized empty Git repository in .../melaka-trip/.git/`

- [ ] **Step 2: Create .gitignore**

Contents of `.gitignore`:
```
.DS_Store
node_modules/
*.log
.env
```

- [ ] **Step 3: Stage and commit the spec + source PDF**

Run:
```bash
git add .gitignore "Melaka 3 days 2 nights - Sheet2.pdf" docs/
git status
```
Expected: shows .gitignore, the PDF, and the spec + plan under `docs/superpowers/`.

Then:
```bash
git commit -m "chore: initial commit with spec, plan, and source sheet"
```
Expected: commit succeeds.

---

### Task 2: Hand-curate `places.raw.json` from the PDF

This is the data foundation. Every later task depends on it being correct.

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/places.raw.json`

- [ ] **Step 1: Write the raw places file**

Contents of `places.raw.json` — copy verbatim:

```json
[
  {
    "id": "airbnb",
    "name": "Airbnb",
    "section": "airbnb",
    "category": "airbnb",
    "mealType": "stay",
    "mapsUrl": "https://maps.app.goo.gl/vsm4QEqhgg5Kee827",
    "durationFromAirbnbMin": 0,
    "hours": "Check-in after 3pm; Check-out 11am",
    "remarks": "1h 15m from Seremban",
    "day": null,
    "order": 0
  },

  {
    "id": "mocity-cosmic-park",
    "name": "Mocity Cosmic Park",
    "section": "entertainment",
    "category": "entertainment",
    "mealType": "entertainment",
    "address": "PT434, Pekan Klebang Sek II, 75200 Melaka",
    "mapsUrl": "https://maps.app.goo.gl/UAWmZ3QdjuhLkBtN7",
    "durationFromAirbnbMin": 9,
    "hours": "Fri 11am-12:30am; Sat-Sun 10am-12:30am",
    "remarks": "玩 — optional",
    "day": 1,
    "order": 20
  },
  {
    "id": "go-kart",
    "name": "Go Kart (RM45 / 10 min)",
    "section": "entertainment",
    "category": "entertainment",
    "mealType": "entertainment",
    "mapsUrl": "https://maps.app.goo.gl/UAWmZ3QdjuhLkBtN7",
    "durationFromAirbnbMin": 9,
    "hours": "until 5pm",
    "remarks": "Same place as Mocity Cosmic Park",
    "day": 2,
    "order": 30
  },
  {
    "id": "atv-zapbalang",
    "name": "ATV Zapbalang",
    "section": "entertainment",
    "category": "entertainment",
    "mealType": "entertainment",
    "mapsUrl": "https://maps.app.goo.gl/RkLzjTQtgVBVsA4J8",
    "durationFromAirbnbMin": null,
    "hours": "Not stated",
    "remarks": "",
    "day": 2,
    "order": 20
  },

  {
    "id": "old-merchant",
    "name": "The Old Merchant",
    "section": "zapbalang",
    "category": "food",
    "mealType": "drinks",
    "mapsUrl": "https://maps.app.goo.gl/41ULyMCQCrKXsT4P6",
    "durationFromAirbnbMin": 7,
    "hours": "5pm-2am",
    "remarks": "Chill drinks — optional",
    "day": 1,
    "order": 60
  },
  {
    "id": "churrrmochi",
    "name": "Churrrmochi",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/LiZVrLfNKPdhUqox6",
    "durationFromAirbnbMin": 5,
    "hours": "12pm-7pm",
    "remarks": "IG: churrrmochi — preorder and pickup",
    "day": 1,
    "order": 10
  },
  {
    "id": "seafood-96",
    "name": "Seafood 96 Cafe",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dinner",
    "mapsUrl": "https://maps.app.goo.gl/x6GRdRy6VyVLGV2q7",
    "durationFromAirbnbMin": 11,
    "hours": "3pm-11:45pm",
    "remarks": "手抓海鲜 — dinner",
    "day": 1,
    "order": 40
  },
  {
    "id": "hok-chin",
    "name": "Hok Chin",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dinner",
    "mapsUrl": "https://maps.app.goo.gl/UNLdH7kQvUuqX3nF8",
    "durationFromAirbnbMin": 18,
    "hours": "5:30pm-11:30pm (Sun closed)",
    "remarks": "海鲜 — dinner alternative",
    "day": 2,
    "order": 50
  },
  {
    "id": "muse-peranakan",
    "name": "MUSE Peranakan Bistro By The Sea",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dinner",
    "mapsUrl": "https://maps.app.goo.gl/J3H9Sqn5MbFEogfw5",
    "durationFromAirbnbMin": 8,
    "hours": "12pm-10pm",
    "remarks": "晚餐 — dinner alternative",
    "day": 2,
    "order": 51
  },
  {
    "id": "chasing-sunsets",
    "name": "Chasing Sunsets Cafe",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dinner",
    "mapsUrl": "https://maps.app.goo.gl/Lq83M2wPi1rVUf4a8",
    "durationFromAirbnbMin": 22,
    "hours": "5pm-12am",
    "remarks": "晚餐 — dinner alternative",
    "day": 1,
    "order": 41
  },
  {
    "id": "shixia-shixia",
    "name": "十下十下 (loklok 宵夜)",
    "section": "zapbalang",
    "category": "food",
    "mealType": "late-night",
    "mapsUrl": "https://maps.app.goo.gl/nKiWWDsxXxPTzJo79",
    "durationFromAirbnbMin": 3,
    "hours": "5pm-1am",
    "remarks": "宵夜 lok-lok",
    "day": 1,
    "order": 70
  },
  {
    "id": "baba-kaya",
    "name": "Baba Kaya",
    "section": "zapbalang",
    "category": "food",
    "mealType": "breakfast",
    "mapsUrl": "https://maps.app.goo.gl/rvAKxdxUYwFZW9MN6",
    "durationFromAirbnbMin": 9,
    "hours": "Fri 8am-2:30pm; Sat-Sun 7:30am-2:30pm",
    "remarks": "早餐",
    "day": 2,
    "order": 10
  },
  {
    "id": "siang-chiang",
    "name": "香江茶室 Kedai Minuman Siang Chiang",
    "section": "zapbalang",
    "category": "food",
    "mealType": "breakfast",
    "mapsUrl": "https://maps.app.goo.gl/VUvShuatqeZ9f88k9",
    "durationFromAirbnbMin": 10,
    "hours": "7am-2pm",
    "remarks": "breakfast alternative",
    "day": 3,
    "order": 10
  },
  {
    "id": "mcqueks-satay-celup",
    "name": "McQuek's Satay Celup",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dinner",
    "mapsUrl": "https://maps.app.goo.gl/5anuARcwjqU6uW4u8",
    "durationFromAirbnbMin": 8,
    "hours": "4pm-11pm",
    "remarks": "吃爽 — dinner alternative",
    "day": 2,
    "order": 52
  },
  {
    "id": "something-bakery",
    "name": "Something Bakery",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/aH4GM1PN97FgjGLu5",
    "durationFromAirbnbMin": 11,
    "hours": "11am-10pm",
    "remarks": "千层蛋糕",
    "day": 2,
    "order": 40
  },
  {
    "id": "jia-hung-pastry",
    "name": "Jia Hung Pastry",
    "section": "zapbalang",
    "category": "souvenir",
    "mealType": "souvenir",
    "mapsUrl": "https://maps.app.goo.gl/7Kuh4Gwpy7XxgksA6",
    "durationFromAirbnbMin": 4,
    "hours": "Best arrival 10:30-11am",
    "remarks": "面包伴手礼",
    "day": 3,
    "order": 20
  },
  {
    "id": "la-mille-bakers",
    "name": "LA Mille Bakers",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/35D5AhA66c2iKsYLA",
    "durationFromAirbnbMin": 8,
    "hours": "8:30am-6pm",
    "remarks": "Croissant",
    "day": 2,
    "order": 11
  },
  {
    "id": "baba-ang",
    "name": "Restoran Baba Ang",
    "section": "zapbalang",
    "category": "food",
    "mealType": "lunch",
    "mapsUrl": "https://maps.app.goo.gl/UUuiY9T4jYYj7Pcg6",
    "durationFromAirbnbMin": 8,
    "hours": "11am-2pm; 6pm-9pm",
    "remarks": "Nyonya — RESERVATION NEEDED",
    "day": 2,
    "order": 30
  },
  {
    "id": "hing-loong",
    "name": "Hing Loong Taiwanese Noodle",
    "section": "zapbalang",
    "category": "food",
    "mealType": "lunch",
    "mapsUrl": "https://maps.app.goo.gl/cFyG6jCnCiq46esb9",
    "durationFromAirbnbMin": 7,
    "hours": "8am-5pm",
    "remarks": "排骨面 — breakfast/lunch alternative",
    "day": 2,
    "order": 31
  },
  {
    "id": "dashu-xia-duck",
    "name": "大树下鸭面",
    "section": "zapbalang",
    "category": "food",
    "mealType": "breakfast",
    "mapsUrl": "https://maps.app.goo.gl/v1zXD6JvRAk133yeA",
    "durationFromAirbnbMin": 6,
    "hours": "7am-1:30pm",
    "remarks": "Duck noodle breakfast alternative",
    "day": 2,
    "order": 11
  },
  {
    "id": "birdcage",
    "name": "Birdcage",
    "section": "zapbalang",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/6b4CcsXyvat4Kijx5",
    "durationFromAirbnbMin": 8,
    "hours": "3pm-7pm",
    "remarks": "买蛋糕 — dessert alternative",
    "day": 2,
    "order": 41
  },

  {
    "id": "hock-kee-waffle",
    "name": "Jonker Street Hock Kee Bakes (waffle)",
    "section": "jonker",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/c9Y9rDcXHeAgkWnK6",
    "durationFromAirbnbMin": 7,
    "hours": "9:30am-6pm",
    "remarks": "waffle",
    "day": 2,
    "order": 42
  },
  {
    "id": "kopi-harian",
    "name": "Kopi Harian Melaka",
    "section": "jonker",
    "category": "food",
    "mealType": "lunch",
    "mapsUrl": "https://maps.app.goo.gl/ASDQnk3oVcB1etjn9",
    "durationFromAirbnbMin": 6,
    "hours": "9am-5:30pm",
    "remarks": "First day lunch candidate",
    "day": 1,
    "order": 5
  },
  {
    "id": "fruit-cones",
    "name": "Fruit Cones",
    "section": "jonker",
    "category": "food",
    "mealType": "snack",
    "mapsUrl": "https://maps.app.goo.gl/QVXCLqNVddkW7V3W9",
    "durationFromAirbnbMin": 12,
    "hours": "11am-7:30pm",
    "remarks": "Near 马六甲河 and 红屋 — must try mixberry",
    "day": 2,
    "order": 32
  },
  {
    "id": "night-market",
    "name": "Jonker Night Market",
    "section": "jonker",
    "category": "entertainment",
    "mealType": "entertainment",
    "mapsUrl": "https://maps.app.goo.gl/1CkDNzXbEfxiJUNc8",
    "durationFromAirbnbMin": 13,
    "hours": "6pm-11pm",
    "remarks": "夜市 — Fri/Sat/Sun only",
    "day": 2,
    "order": 45
  },
  {
    "id": "tan-kim-hock",
    "name": "Tan Kim Hock",
    "section": "jonker",
    "category": "souvenir",
    "mealType": "souvenir",
    "mapsUrl": "https://maps.app.goo.gl/3JkU5D3XKpdwzuzC6",
    "durationFromAirbnbMin": 8,
    "hours": "9am-6pm",
    "remarks": "买手信",
    "day": 3,
    "order": 30
  },
  {
    "id": "hernan-food",
    "name": "Hernan Food Jonker (和南猫山王)",
    "section": "jonker",
    "category": "food",
    "mealType": "dessert",
    "mapsUrl": "https://maps.app.goo.gl/5dJpJwRdW1NYS73N6",
    "durationFromAirbnbMin": 17,
    "hours": "10am-8pm",
    "remarks": "猫山王 durian",
    "day": 2,
    "order": 43
  },
  {
    "id": "famosa-chicken-rice-ball",
    "name": "Famosa Chicken Rice Ball",
    "section": "jonker",
    "category": "food",
    "mealType": "lunch",
    "mapsUrl": "https://maps.app.goo.gl/KU1Wv2ry57SB2C8WA",
    "durationFromAirbnbMin": 8,
    "hours": "9:30am-8pm",
    "remarks": "Famous chicken rice ball",
    "day": 2,
    "order": 33
  }
]
```

- [ ] **Step 2: Commit the raw data**

Run:
```bash
git add places.raw.json
git commit -m "data: hand-curated raw places list from sheet"
```
Expected: commit succeeds.

---

### Task 3: Write the build script to resolve `goo.gl` links to GPS

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/tools/build-places.mjs`

- [ ] **Step 1: Write the build script**

Contents of `tools/build-places.mjs`:

```javascript
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
```

- [ ] **Step 2: Run the script**

Run:
```bash
node tools/build-places.mjs
```
Expected: prints one line per place with coordinates, ends with `Wrote 28 places to places.json. Missing coords: 0.` If any are MISSING, follow the printed instructions to manually paste coordinates into `places.json`, then re-run the script.

- [ ] **Step 3: Sanity-check the output**

Run:
```bash
node -e "const p=require('./places.json');console.log('count:',p.length);console.log('with coords:',p.filter(x=>x.lat&&x.lng).length);console.log('days:',[...new Set(p.map(x=>x.day))]);"
```
Expected:
```
count: 28
with coords: 28
days: [ null, 1, 2, 3 ]
```

- [ ] **Step 4: Commit**

Run:
```bash
git add tools/build-places.mjs places.json
git commit -m "feat: build script + generated places.json with GPS coords"
```

---

### Task 4: Write data validator and pure-function tests

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/tests/data.test.mjs`
- Create: `/Users/jimmyhew/Documents/melaka-trip/tests/grouping.test.mjs`
- Create: `/Users/jimmyhew/Documents/melaka-trip/lib/grouping.mjs`

- [ ] **Step 1: Write the data validation test (failing)**

Contents of `tests/data.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const places = JSON.parse(await readFile("places.json", "utf8"));

const VALID_CATEGORIES = ["food", "entertainment", "souvenir", "airbnb"];
const VALID_SECTIONS = ["entertainment", "zapbalang", "jonker", "airbnb"];
const VALID_MEAL_TYPES = [
  "breakfast", "lunch", "dinner", "snack", "dessert",
  "late-night", "drinks", "souvenir", "entertainment", "stay"
];

test("every place has the required fields", () => {
  for (const p of places) {
    assert.ok(p.id, `missing id: ${JSON.stringify(p)}`);
    assert.ok(p.name, `missing name on ${p.id}`);
    assert.ok(p.mapsUrl, `missing mapsUrl on ${p.id}`);
    assert.ok(VALID_CATEGORIES.includes(p.category), `bad category on ${p.id}: ${p.category}`);
    assert.ok(VALID_SECTIONS.includes(p.section), `bad section on ${p.id}: ${p.section}`);
    assert.ok(VALID_MEAL_TYPES.includes(p.mealType), `bad mealType on ${p.id}: ${p.mealType}`);
  }
});

test("every non-airbnb place has GPS coordinates", () => {
  for (const p of places) {
    if (p.category === "airbnb") continue;
    assert.equal(typeof p.lat, "number", `lat not a number on ${p.id}`);
    assert.equal(typeof p.lng, "number", `lng not a number on ${p.id}`);
    assert.ok(p.lat > 2 && p.lat < 3, `lat out of Melaka range on ${p.id}: ${p.lat}`);
    assert.ok(p.lng > 102 && p.lng < 103, `lng out of Melaka range on ${p.id}: ${p.lng}`);
  }
});

test("place ids are unique", () => {
  const ids = places.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
});

test("each day 1/2/3 has at least one dinner OR is the half-day check-out", () => {
  for (const day of [1, 2]) {
    const dinners = places.filter(p => p.day === day && p.mealType === "dinner");
    assert.ok(dinners.length >= 1, `day ${day} has no dinner`);
  }
});
```

- [ ] **Step 2: Run the data test**

Run:
```bash
node --test tests/data.test.mjs
```
Expected: all tests pass.

- [ ] **Step 3: Write the grouping pure-function test (failing)**

Contents of `tests/grouping.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDay, sortDaySchedule, getAlternatives } from "../lib/grouping.mjs";

const sample = [
  { id: "a", day: 1, mealType: "breakfast", order: 10 },
  { id: "b", day: 1, mealType: "dinner", order: 40 },
  { id: "c", day: 1, mealType: "dinner", order: 41 },
  { id: "d", day: 2, mealType: "breakfast", order: 10 },
  { id: "e", day: null, mealType: "stay", order: 0 }
];

test("groupByDay buckets places into days 1/2/3 and skips null", () => {
  const g = groupByDay(sample);
  assert.equal(g[1].length, 3);
  assert.equal(g[2].length, 1);
  assert.equal(g[3].length, 0);
});

test("sortDaySchedule sorts by order ascending", () => {
  const sorted = sortDaySchedule([
    { id: "z", order: 50 }, { id: "a", order: 10 }, { id: "m", order: 30 }
  ]);
  assert.deepEqual(sorted.map(p => p.id), ["a", "m", "z"]);
});

test("getAlternatives returns places of same mealType on same day, excluding the primary", () => {
  const day1 = sample.filter(p => p.day === 1);
  const primary = day1.find(p => p.id === "b");
  const alts = getAlternatives(day1, primary);
  assert.deepEqual(alts.map(p => p.id), ["c"]);
});
```

- [ ] **Step 4: Run grouping test (should fail — module missing)**

Run:
```bash
node --test tests/grouping.test.mjs
```
Expected: FAIL with "Cannot find module '../lib/grouping.mjs'".

- [ ] **Step 5: Implement `lib/grouping.mjs`**

Contents of `lib/grouping.mjs`:

```javascript
export function groupByDay(places) {
  const out = { 1: [], 2: [], 3: [] };
  for (const p of places) {
    if (p.day === 1 || p.day === 2 || p.day === 3) out[p.day].push(p);
  }
  return out;
}

export function sortDaySchedule(places) {
  return [...places].sort((a, b) => a.order - b.order);
}

export function getAlternatives(dayPlaces, primary) {
  return dayPlaces.filter(p => p.mealType === primary.mealType && p.id !== primary.id);
}
```

- [ ] **Step 6: Re-run grouping test (should pass)**

Run:
```bash
node --test tests/grouping.test.mjs
```
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**

Run:
```bash
git add tests/ lib/
git commit -m "test: data validation + grouping pure functions"
```

---

### Task 5: Build the HTML shell with tab bar

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/index.html`

- [ ] **Step 1: Write `index.html`**

Contents:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Melaka 3D2N</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topbar">
    <h1>Melaka 3D2N</h1>
  </header>

  <nav class="tabs" role="tablist" aria-label="Trip views">
    <button class="tab" data-view="map" aria-selected="true">🗺 Map</button>
    <button class="tab" data-view="day1" aria-selected="false">Day 1</button>
    <button class="tab" data-view="day2" aria-selected="false">Day 2</button>
    <button class="tab" data-view="day3" aria-selected="false">Day 3</button>
    <button class="tab" data-view="all" aria-selected="false">All</button>
  </nav>

  <main id="app">
    <section id="view-map" class="view active"><div id="leaflet-map"></div></section>
    <section id="view-day1" class="view"></section>
    <section id="view-day2" class="view"></section>
    <section id="view-day3" class="view"></section>
    <section id="view-all" class="view"></section>
  </main>

  <div id="sheet" class="sheet" hidden aria-hidden="true">
    <button id="sheet-close" class="sheet-close" aria-label="Close">×</button>
    <div id="sheet-body"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open the page to confirm it renders**

Run:
```bash
open /Users/jimmyhew/Documents/melaka-trip/index.html
```
Expected: a page with "Melaka 3D2N" title, five tab buttons, no styling yet. Nothing else.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: HTML shell with tab bar"
```

---

### Task 6: Add mobile-first stylesheet

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/style.css`

- [ ] **Step 1: Write `style.css`**

```css
:root {
  --bg: #faf8f4;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --card: #ffffff;
  --border: #e6e0d4;
  --day1: #d64545;
  --day2: #3672c3;
  --day3: #2f9e44;
  --airbnb: #d4a017;
  --accent: #1a1a1a;
  --shadow: 0 1px 3px rgba(0,0,0,.08);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--fg);
  -webkit-text-size-adjust: 100%;
}
.topbar {
  padding: 14px 16px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.topbar h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: .2px; }

.tabs {
  position: sticky; top: 0; z-index: 5;
  display: flex; gap: 4px; padding: 8px;
  background: var(--bg); border-bottom: 1px solid var(--border);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
}
.tab {
  flex: 0 0 auto; min-height: 44px; padding: 0 14px;
  background: transparent; color: var(--muted);
  border: 1px solid var(--border); border-radius: 999px;
  font: inherit; font-weight: 500; cursor: pointer;
}
.tab[aria-selected="true"] {
  background: var(--accent); color: #fff; border-color: var(--accent);
}

#app { padding: 12px; }
.view { display: none; }
.view.active { display: block; }

#view-map.active { padding: 0; display: block; }
#leaflet-map { width: 100%; height: calc(100vh - 130px); }

.card {
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow);
  border-left: 4px solid var(--border);
}
.card.day-1 { border-left-color: var(--day1); }
.card.day-2 { border-left-color: var(--day2); }
.card.day-3 { border-left-color: var(--day3); }
.card.airbnb { border-left-color: var(--airbnb); }

.card h3 { margin: 0 0 4px; font-size: 17px; }
.card .meta { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.card .meta span + span::before { content: " · "; }
.card .remarks { font-size: 14px; margin: 6px 0 10px; }
.card .actions { display: flex; gap: 8px; flex-wrap: wrap; }
.card .btn {
  display: inline-block; min-height: 36px; padding: 8px 12px;
  background: var(--accent); color: #fff; border-radius: 8px;
  text-decoration: none; font-size: 14px; font-weight: 500;
}
.card .btn.secondary {
  background: transparent; color: var(--accent); border: 1px solid var(--border);
}

.alternatives { margin-top: 8px; }
.alternatives summary {
  cursor: pointer; color: var(--muted); font-size: 13px; padding: 4px 0;
}
.alternatives .card { margin-top: 8px; box-shadow: none; }

.filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.filters .chip {
  min-height: 36px; padding: 0 12px; border-radius: 999px;
  border: 1px solid var(--border); background: transparent;
  color: var(--muted); font: inherit; cursor: pointer;
}
.filters .chip[aria-pressed="true"] {
  background: var(--accent); color: #fff; border-color: var(--accent);
}

.sheet {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: var(--card); border-top: 1px solid var(--border);
  border-radius: 16px 16px 0 0; padding: 16px 16px 24px;
  box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  max-height: 70vh; overflow-y: auto; z-index: 10;
}
.sheet[hidden] { display: none; }
.sheet-close {
  position: absolute; top: 8px; right: 8px;
  width: 36px; height: 36px; border: 0; background: transparent;
  font-size: 24px; cursor: pointer;
}

@media (min-width: 768px) {
  #app { max-width: 960px; margin: 0 auto; }
  .view.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  #leaflet-map { height: calc(100vh - 130px); }
}
```

- [ ] **Step 2: Reload the page to confirm styles applied**

Open `index.html` in a browser. Expected: tabs are pill-shaped, the active "🗺 Map" tab is dark. Layout is centered and clean.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: mobile-first stylesheet"
```

---

### Task 7: Wire up tab switching in `app.js`

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/app.js`

- [ ] **Step 1: Write the initial `app.js` with tab switching only**

```javascript
import { groupByDay, sortDaySchedule, getAlternatives } from "./lib/grouping.mjs";

const places = await fetch("./places.json").then(r => r.json());

// --- tab switching ---
const tabs = document.querySelectorAll(".tab");
const views = {
  map: document.getElementById("view-map"),
  day1: document.getElementById("view-day1"),
  day2: document.getElementById("view-day2"),
  day3: document.getElementById("view-day3"),
  all: document.getElementById("view-all")
};

function selectTab(name) {
  for (const t of tabs) {
    const isActive = t.dataset.view === name;
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("active", key === name);
  }
  if (name === "map" && window.__map) window.__map.invalidateSize();
}

for (const t of tabs) {
  t.addEventListener("click", () => selectTab(t.dataset.view));
}

// Placeholder so the rest of the app can be filled in.
window.__places = places;
window.__groupByDay = groupByDay;
window.__sortDaySchedule = sortDaySchedule;
window.__getAlternatives = getAlternatives;
```

- [ ] **Step 2: Serve the folder locally and verify tab switching**

Static files need a server because the page uses `fetch`. Run:
```bash
cd /Users/jimmyhew/Documents/melaka-trip && python3 -m http.server 8000
```
Then open `http://localhost:8000/` in a browser. Click each tab in turn. Expected: the active tab styling updates, and the active view section becomes visible (currently empty except Map which has an empty `#leaflet-map`).

Stop the server with Ctrl-C when done.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: tab switching"
```

---

### Task 8: Render the Leaflet map with day-colored pins

**Files:**
- Modify: `/Users/jimmyhew/Documents/melaka-trip/app.js`

- [ ] **Step 1: Add map rendering to `app.js`**

Append to `app.js` (after the existing tab-switching code, before the `window.__places = ...` placeholder block — remove the placeholder block):

```javascript
// --- map ---
const DAY_COLOR = { 1: "#d64545", 2: "#3672c3", 3: "#2f9e44" };
const AIRBNB_COLOR = "#d4a017";
const UNASSIGNED_COLOR = "#9a9a9a";

function colorFor(p) {
  if (p.category === "airbnb") return AIRBNB_COLOR;
  if (p.day === 1 || p.day === 2 || p.day === 3) return DAY_COLOR[p.day];
  return UNASSIGNED_COLOR;
}

function makeIcon(color) {
  return L.divIcon({
    className: "pin",
    html: `<span style="
      display:block;width:22px;height:22px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
}

const map = L.map("leaflet-map", { zoomControl: true });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "© OpenStreetMap contributors"
}).addTo(map);
window.__map = map;

const withCoords = places.filter(p => typeof p.lat === "number" && typeof p.lng === "number");
const markers = withCoords.map(p => {
  const m = L.marker([p.lat, p.lng], { icon: makeIcon(colorFor(p)) }).addTo(map);
  m.on("click", () => openSheet(p));
  return m;
});
map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [30, 30] });
```

- [ ] **Step 2: Add the bottom-sheet open function (stub for now)**

Append to `app.js`:

```javascript
// --- bottom sheet ---
const sheet = document.getElementById("sheet");
const sheetBody = document.getElementById("sheet-body");
document.getElementById("sheet-close").addEventListener("click", closeSheet);

function openSheet(p) {
  sheetBody.innerHTML = renderCardHtml(p, { showDayBadge: true });
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
}
function closeSheet() {
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
}

function renderCardHtml(p, { showDayBadge = false } = {}) {
  const dayClass = p.category === "airbnb"
    ? "airbnb"
    : (p.day ? `day-${p.day}` : "");
  const dayBadge = showDayBadge && p.day ? `<span>Day ${p.day}</span>` : "";
  const dur = p.durationFromAirbnbMin != null
    ? `<span>${p.durationFromAirbnbMin} min from Airbnb</span>` : "";
  const hours = p.hours ? `<span>${escapeHtml(p.hours)}</span>` : "";
  const remarks = p.remarks ? `<p class="remarks">${escapeHtml(p.remarks)}</p>` : "";
  return `
    <article class="card ${dayClass}">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta">${dayBadge}${hours}${dur}</div>
      ${remarks}
      <div class="actions">
        <a class="btn" href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
```

- [ ] **Step 3: Verify the map and bottom sheet in a browser**

Run:
```bash
cd /Users/jimmyhew/Documents/melaka-trip && python3 -m http.server 8000
```
Open `http://localhost:8000/`. Expected:
- Map view shows ~28 colored pins across Melaka, color-coded (red=Day1, blue=Day2, green=Day3, gold=Airbnb).
- Map auto-zooms to fit all pins.
- Tapping a pin opens the bottom sheet with the place's name, hours, remarks, and an "Open in Google Maps" button.
- Tapping × closes the sheet.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: Leaflet map with day-colored pins and bottom sheet"
```

---

### Task 9: Render Day 1 / Day 2 / Day 3 card lists with alternatives

**Files:**
- Modify: `/Users/jimmyhew/Documents/melaka-trip/app.js`

- [ ] **Step 1: Add the day-view renderer to `app.js`**

Append to `app.js`:

```javascript
// --- day views ---
const SLOT_LABEL = {
  breakfast: "Breakfast 早餐",
  lunch: "Lunch 午餐",
  dinner: "Dinner 晚餐",
  snack: "Snack",
  dessert: "Dessert / 蛋糕",
  "late-night": "Late-night 宵夜",
  drinks: "Drinks",
  souvenir: "Souvenir 手信",
  entertainment: "Entertainment 玩",
  stay: "Stay"
};

function renderDayView(dayNumber, containerEl) {
  const dayPlaces = sortDaySchedule(groupByDay(places)[dayNumber]);

  // Pick one primary per mealType; rest become alternatives.
  const seenMeal = new Set();
  const primaries = [];
  const altsByMeal = {};
  for (const p of dayPlaces) {
    if (seenMeal.has(p.mealType)) {
      (altsByMeal[p.mealType] ||= []).push(p);
    } else {
      seenMeal.add(p.mealType);
      primaries.push(p);
    }
  }

  containerEl.innerHTML = primaries.map(p => {
    const alts = altsByMeal[p.mealType] || [];
    const altsHtml = alts.length === 0 ? "" : `
      <details class="alternatives">
        <summary>${alts.length} alternative${alts.length > 1 ? "s" : ""}</summary>
        ${alts.map(a => renderCardHtml(a)).join("")}
      </details>
    `;
    return `
      <div class="slot">
        <div class="meta" style="margin:14px 0 6px;font-weight:600;color:#444">
          ${SLOT_LABEL[p.mealType] || p.mealType}
        </div>
        ${renderCardHtml(p)}
        ${altsHtml}
      </div>
    `;
  }).join("") || `<p style="color:#666">No places assigned to Day ${dayNumber}.</p>`;
}

renderDayView(1, views.day1);
renderDayView(2, views.day2);
renderDayView(3, views.day3);
```

- [ ] **Step 2: Verify in browser**

Run the local server, open the page, click **Day 1**. Expected: cards in chronological order, each preceded by a slot label like "Dinner 晚餐". Where there are multiple candidates, a `details` toggle "N alternatives" expands to show the rest. Repeat for Day 2 and Day 3.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: Day 1/2/3 schedule views with alternatives"
```

---

### Task 10: Render the All view with category filter

**Files:**
- Modify: `/Users/jimmyhew/Documents/melaka-trip/app.js`

- [ ] **Step 1: Append the All-view renderer**

```javascript
// --- all view ---
const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "entertainment", label: "Entertainment" },
  { key: "souvenir", label: "Souvenir" },
  { key: "airbnb", label: "Airbnb" }
];

let allFilter = "all";

function renderAllView() {
  const filtered = allFilter === "all"
    ? places
    : places.filter(p => p.category === allFilter);
  const chips = CATEGORIES.map(c => `
    <button class="chip" data-cat="${c.key}" aria-pressed="${c.key === allFilter}">${c.label}</button>
  `).join("");
  views.all.innerHTML = `
    <div class="filters">${chips}</div>
    <div class="list">${filtered.map(p => renderCardHtml(p, { showDayBadge: true })).join("")}</div>
  `;
  for (const chip of views.all.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      allFilter = chip.dataset.cat;
      renderAllView();
    });
  }
}

renderAllView();
```

- [ ] **Step 2: Verify in browser**

Reload the page, click **All**. Expected: filter chips at top (All / Food / Entertainment / Souvenir / Airbnb). All 28 cards listed below. Clicking a chip filters the list and updates the active chip styling.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: All view with category filter"
```

---

### Task 11: Browser verification with chrome-devtools

**Files:** none

- [ ] **Step 1: Serve the site**

Run:
```bash
cd /Users/jimmyhew/Documents/melaka-trip && python3 -m http.server 8000
```

- [ ] **Step 2: Open the page in chrome-devtools at phone size**

Use the chrome-devtools MCP tools:
1. `mcp__chrome-devtools__new_page` with `url: "http://localhost:8000/"`
2. `mcp__chrome-devtools__resize_page` to `width: 390, height: 844` (iPhone 14 Pro)
3. `mcp__chrome-devtools__take_screenshot` of the initial Map view
4. Click each tab via `mcp__chrome-devtools__click` and screenshot each view
5. Click a map pin and screenshot the bottom sheet
6. `mcp__chrome-devtools__list_console_messages` — should show no errors

- [ ] **Step 3: Note any visual bugs and fix them before continuing**

If anything is broken (overlapping text, hidden tabs, sheet covering content, pins missing), fix in the relevant file and re-run step 2 until clean.

- [ ] **Step 4: Stop the server and commit any fixes**

```bash
git add -A && git diff --cached --quiet || git commit -m "fix: visual fixes from chrome-devtools verification"
```

---

### Task 12: Write README with regenerate + deploy instructions

**Files:**
- Create: `/Users/jimmyhew/Documents/melaka-trip/README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Melaka 3D2N Trip Planner

Static mobile-first HTML page with a Leaflet map and a 3-day itinerary, built from a hand-curated list of places.

## Run locally

```
python3 -m http.server 8000
```
Open http://localhost:8000/

## Regenerate `places.json`

Edit `places.raw.json`, then:
```
node tools/build-places.mjs
node --test tests/
```

## Deploy to GitHub Pages

1. Create an empty public repo on github.com named `melaka-trip`.
2. From this folder:
   ```
   git remote add origin git@github.com:<your-username>/melaka-trip.git
   git push -u origin main
   ```
3. On github.com: Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `/ (root)`, Save.
4. Page goes live at `https://<your-username>.github.io/melaka-trip/`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with run + deploy instructions"
```

---

### Task 13: Deploy to GitHub Pages

This task requires the user to perform two manual steps (create the repo on github.com, enable Pages). The agent prepares the commands and prompts the user.

- [ ] **Step 1: Pause for user action — create the GitHub repo**

Show the user this message and stop until they confirm:

> Please create an empty public repo on github.com named **`melaka-trip`** (no README, no .gitignore, no license — empty). Then tell me your GitHub username so I can set the remote.

- [ ] **Step 2: Set the remote and push**

Once the user gives a username `<USER>`:
```bash
cd /Users/jimmyhew/Documents/melaka-trip
git remote add origin "git@github.com:<USER>/melaka-trip.git"
git push -u origin main
```
Expected: push succeeds.

- [ ] **Step 3: Pause for user action — enable GitHub Pages**

Show the user:

> Go to https://github.com/<USER>/melaka-trip/settings/pages → Source: **Deploy from a branch** → Branch: **main** / **/ (root)** → Save. Tell me when the green "Your site is live" banner shows the URL.

- [ ] **Step 4: Verify the deployed URL**

Use `mcp__chrome-devtools__new_page` to open the user-reported URL. Take a screenshot to confirm the Map view loads and pins are visible.

- [ ] **Step 5: Done**

Tell the user the URL is live and they can bookmark it on their phone for the trip.

# Memory Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the Melaka trip planner site into a single-curator photo+video memory book per `docs/superpowers/specs/2026-05-23-memory-book-design.md`.

**Architecture:** Static site, vanilla ES modules, no bundler. Single data file `memories.json`. Per-stop folder under `media/<id>/`. Renderer mounts a sticky Leaflet map + per-day vertical timeline (red dots on a per-day red line). Each stop card hosts a varied photo+video grid; tapping any tile opens a fullscreen swipe lightbox. A `tools/add-stop.mjs` script imports a folder of media for one stop and upserts the entry into `memories.json`.

**Tech Stack:** Vanilla JS ES modules, Leaflet 1.9.4 (CDN), Google Fonts (Cormorant Garamond + Inter), `node:test` for tests, `sharp` for HEIC→JPEG + image dims, system `ffmpeg`/`ffprobe` for video posters + dims.

**Branching note for the executor:** This plan replaces a large amount of code in a single sequence. Either work on a feature branch and open one PR at the end, or work directly on `main` and accept the live site is broken between Task 1 and ~Task 7. The plan's `git commit` steps do not include `git push` — push at phase boundaries (or per-task on a branch) at your discretion.

---

## File structure overview

**Created:**
- `memories.json` — the only runtime data file
- `media/<id>/` — per-stop media folders (created by the curation script)
- `lib/name.mjs` — bilingual `splitName()` helper (extracted)
- `lib/render.mjs` — day section + stop card markup
- `lib/gallery.mjs` — `sizeFor()` rule + grid mount + click handler
- `lib/lightbox.mjs` — fullscreen swipe overlay
- `lib/map.mjs` — Leaflet setup, pins, polyline, sticky-shrink
- `tools/add-stop.mjs` — curation CLI
- `tools/lib/resolve-maps.mjs` — short URL → lat/lng helper
- `tools/lib/media-import.mjs` — copy + rename + dims + video posters
- `tests/data.test.mjs` — rewritten for `memories.json`
- `tests/name.test.mjs` — `splitName()` cases
- `tests/gallery.test.mjs` — `sizeFor()` cases
- `tests/resolve-maps.test.mjs` — extractor cases
- `package.json` — `sharp` dependency (dev-time only, for the script)

**Rewritten:**
- `index.html` — bare scaffold
- `app.js` — small entry point (~80 lines)
- `style.css` — warm palette, fonts, timeline, lightbox

**Deleted:**
- `lib/timeline.mjs`, `lib/hours.mjs`, `lib/now.mjs`, `lib/grouping.mjs`, `lib/drives.json`
- `tools/build-places.mjs`, `tools/add-place.mjs`, `tools/precompute-drives.mjs`, `tools/fetch-photos.mjs`
- `tests/timeline.test.mjs`, `tests/hours.test.mjs`, `tests/now.test.mjs`, `tests/grouping.test.mjs`
- `places.json`, `places.raw.json`
- `images/` directory
- `firebase.json`, `firestore.rules`, `.firebaserc`

---

# Phase 1 — Foundation (clean slate + data shape)

### Task 1: Tear down planner code

**Files:**
- Delete: many (listed below)
- Modify: `CLAUDE.md` — strip planner-era notes (re-written later in Task 17)

- [ ] **Step 1: Delete planner-era source files**

```bash
cd /Users/jimmyhew/Documents/melaka-trip
git rm \
  lib/timeline.mjs lib/hours.mjs lib/now.mjs lib/grouping.mjs lib/drives.json \
  tools/build-places.mjs tools/add-place.mjs tools/precompute-drives.mjs tools/fetch-photos.mjs \
  tests/timeline.test.mjs tests/hours.test.mjs tests/now.test.mjs tests/grouping.test.mjs \
  places.json places.raw.json \
  firebase.json firestore.rules .firebaserc
git rm -r images/
```

- [ ] **Step 2: Verify the deletion was complete**

Run: `ls lib/ tools/ tests/ && ls | grep -E "places|firebase|firestore|images"`
Expected: `lib/` contains nothing (we'll add files in later tasks). `tools/` and `tests/` are empty too. The grep should return nothing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove planner-era code and data ahead of memory-book pivot"
```

---

### Task 2: Establish `memories.json` and rewrite data test

**Files:**
- Create: `memories.json`
- Create: `tests/data.test.mjs`

- [ ] **Step 1: Seed `memories.json` with one sample stop**

Write to `memories.json`:

```json
[
  {
    "id": "jonker-walk",
    "name": "Jonker Walk 鸡场街",
    "day": 1,
    "order": 1,
    "time": "14:30",
    "lat": 2.1956,
    "lng": 102.2486,
    "mapsUrl": "https://maps.app.goo.gl/sample",
    "rating": 4,
    "media": []
  }
]
```

(One stop with empty media — proves the schema works; renderer will filter it out in Phase 2.)

- [ ] **Step 2: Write the failing test**

Write to `tests/data.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const memories = JSON.parse(await readFile("memories.json", "utf8"));

const ID_RE = /^[a-z0-9-]{1,40}$/;
const TIME_RE = /^[0-2]\d:[0-5]\d$/;

test("every entry has required scalar fields with valid values", () => {
  for (const m of memories) {
    assert.ok(ID_RE.test(m.id), `bad id: ${m.id}`);
    assert.ok(typeof m.name === "string" && m.name.length > 0, `bad name on ${m.id}`);
    assert.ok([1, 2, 3].includes(m.day), `bad day on ${m.id}: ${m.day}`);
    assert.equal(typeof m.order, "number", `bad order on ${m.id}`);
    assert.ok(TIME_RE.test(m.time), `bad time on ${m.id}: ${m.time}`);
    assert.equal(typeof m.lat, "number", `bad lat on ${m.id}`);
    assert.equal(typeof m.lng, "number", `bad lng on ${m.id}`);
    assert.ok(m.lat > 2 && m.lat < 3, `lat out of range on ${m.id}: ${m.lat}`);
    assert.ok(m.lng > 101 && m.lng < 103, `lng out of range on ${m.id}: ${m.lng}`);
    assert.ok(typeof m.mapsUrl === "string" && m.mapsUrl.startsWith("https://"), `bad mapsUrl on ${m.id}`);
    assert.ok([1, 2, 3, 4, 5].includes(m.rating), `bad rating on ${m.id}: ${m.rating}`);
    assert.ok(Array.isArray(m.media), `media not an array on ${m.id}`);
  }
});

test("ids are unique", () => {
  const ids = memories.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
});

test("every media entry points to an existing file", async () => {
  for (const m of memories) {
    for (const item of m.media) {
      assert.ok(item.src.startsWith(`media/${m.id}/`), `bad src path on ${m.id}: ${item.src}`);
      assert.ok(["photo", "video"].includes(item.type), `bad type on ${m.id}: ${item.type}`);
      assert.equal(typeof item.w, "number", `missing w on ${m.id}/${item.src}`);
      assert.equal(typeof item.h, "number", `missing h on ${m.id}/${item.src}`);
      await stat(resolve(item.src)); // throws if missing
      if (item.type === "video") {
        assert.ok(typeof item.poster === "string", `video missing poster on ${m.id}/${item.src}`);
        await stat(resolve(item.poster));
      }
    }
  }
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test tests/*.mjs`
Expected: all 3 tests pass (the sample stop has no media, so the third test loops zero times).

- [ ] **Step 4: Commit**

```bash
git add memories.json tests/data.test.mjs
git commit -m "feat: introduce memories.json schema and validation test"
```

---

### Task 3: Extract `splitName` into `lib/name.mjs`

**Files:**
- Create: `lib/name.mjs`
- Create: `tests/name.test.mjs`

- [ ] **Step 1: Write the failing test**

Write to `tests/name.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitName } from "../lib/name.mjs";

test("leading CJK then Latin splits cleanly", () => {
  assert.deepEqual(
    splitName("芙蓉大巴刹 Seremban Central Market"),
    { cn: "芙蓉大巴刹", main: "Seremban Central Market" }
  );
});

test("Latin then trailing CJK splits cleanly", () => {
  assert.deepEqual(
    splitName("Jonker Walk 鸡场街"),
    { cn: "鸡场街", main: "Jonker Walk" }
  );
});

test("Latin-only returns cn:null", () => {
  assert.deepEqual(
    splitName("Seremban Central Market"),
    { cn: null, main: "Seremban Central Market" }
  );
});

test("CJK-only falls back to main = original", () => {
  assert.deepEqual(
    splitName("大树下鸭面"),
    { cn: null, main: "大树下鸭面" }
  );
});

test("messy mixed-middle falls back to main = original", () => {
  const raw = "Foo 中文 Bar";
  assert.deepEqual(splitName(raw), { cn: null, main: raw });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/name.test.mjs`
Expected: FAIL — `Cannot find module '../lib/name.mjs'`.

- [ ] **Step 3: Implement `lib/name.mjs`**

Write to `lib/name.mjs`:

```js
// splitName("Jonker Walk 鸡场街") → { cn: "鸡场街", main: "Jonker Walk" }
// splitName("芙蓉大巴刹 Seremban Central Market") → { cn: "芙蓉大巴刹", main: "Seremban Central Market" }
// splitName("Seremban Central Market") → { cn: null, main: "Seremban Central Market" }
// splitName("大树下鸭面") → { cn: null, main: "大树下鸭面" }
const CJK = "\\u3400-\\u9FFF\\u3000-\\u303F";
const CJK_RE = new RegExp(`[${CJK}]`);
export function splitName(name) {
  const leading = name.match(new RegExp(`^([${CJK}][${CJK} ·]*?)\\s+([A-Za-z].+)$`));
  if (leading && !CJK_RE.test(leading[2])) return { cn: leading[1].trim(), main: leading[2].trim() };
  const trailing = name.match(new RegExp(`^([A-Za-z][^${CJK}]*?)\\s+([${CJK}][${CJK} ·]*)$`));
  if (trailing) return { cn: trailing[2].trim(), main: trailing[1].trim() };
  return { cn: null, main: name };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/name.test.mjs`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/name.mjs tests/name.test.mjs
git commit -m "feat: extract splitName into lib/name.mjs with unit tests"
```

---

# Phase 2 — Minimal renderer (see something in the browser)

### Task 4: New `index.html` scaffold

**Files:**
- Modify (rewrite): `index.html`

- [ ] **Step 1: Replace the entire file**

Write to `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Melaka — Memories</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="masthead">
    <div class="eyebrow">MEMORIES</div>
    <h1 class="title">Melaka</h1>
    <p class="dek">22–24 May 2026</p>
    <div class="tile-strip" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span><span></span>
    </div>
  </header>

  <div id="map" class="map"></div>

  <main id="timeline"></main>

  <div id="lightbox" class="lightbox" hidden aria-hidden="true">
    <button class="lightbox-close" aria-label="Close">×</button>
    <div class="lightbox-counter"></div>
    <div class="lightbox-stage"></div>
    <button class="lightbox-prev" aria-label="Previous">‹</button>
    <button class="lightbox-next" aria-label="Next">›</button>
    <div class="lightbox-progress"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Smoke test by serving locally**

Run: `python3 -m http.server 8000 &`
Then open `http://localhost:8000/`. Expected: page loads, you see the "MEMORIES" / "Melaka" header. Console may show 404s for `app.js` since it doesn't exist yet — that's fine.

Kill the server: `kill %1` (or close the terminal tab).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: bare index.html scaffold for memory book"
```

---

### Task 5: New `app.js` + `lib/render.mjs` (day sections + stop cards, no media yet)

**Files:**
- Modify (rewrite): `app.js`
- Create: `lib/render.mjs`

- [ ] **Step 1: Write `lib/render.mjs`**

Write to `lib/render.mjs`:

```js
import { splitName } from "./name.mjs";

const DAY_LABELS = {
  1: { eyebrow: "DAY ONE",   date: "Friday, 22 May" },
  2: { eyebrow: "DAY TWO",   date: "Saturday, 23 May" },
  3: { eyebrow: "DAY THREE", date: "Sunday, 24 May" }
};

function stars(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function stopCardHTML(stop) {
  const { main, cn } = splitName(stop.name);
  return `
    <article class="stop" id="stop-${stop.id}">
      <div class="stop-dot" aria-hidden="true"></div>
      <div class="stop-head">
        <span class="stop-time">${stop.time}</span>
        <span class="stop-stars" aria-label="${stop.rating} stars">${stars(stop.rating)}</span>
      </div>
      <h3 class="stop-name">${main}</h3>
      ${cn ? `<p class="stop-cn">${cn}</p>` : ""}
      <div class="stop-gallery" data-id="${stop.id}"></div>
      <a class="stop-maps" href="${stop.mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </article>
  `;
}

function dayHTML(day, stops) {
  const { eyebrow, date } = DAY_LABELS[day];
  const cards = stops.map(stopCardHTML).join("");
  return `
    <section class="day day-${day}">
      <header class="day-head">
        <div class="day-eyebrow">${eyebrow}</div>
        <h2 class="day-date">${date}</h2>
      </header>
      <div class="day-line">${cards}</div>
    </section>
  `;
}

export function renderDays(memories, container) {
  const stops = memories
    .filter(m => m.media.length > 0)
    .sort((a, b) => a.day - b.day || a.order - b.order);
  const byDay = new Map([[1, []], [2, []], [3, []]]);
  for (const s of stops) byDay.get(s.day).push(s);
  container.innerHTML = [...byDay.entries()]
    .filter(([_, list]) => list.length > 0)
    .map(([day, list]) => dayHTML(day, list))
    .join("");
  return stops; // returned for the map + gallery + lightbox to attach to
}
```

- [ ] **Step 2: Write the new `app.js`**

Replace `app.js` with:

```js
import { renderDays } from "./lib/render.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  renderDays(memories, timeline);
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});
```

- [ ] **Step 3: Add a second stop to `memories.json` with non-empty media so something actually renders**

Modify `memories.json` to include a temporary fake media item (we'll use a real photo in later tasks; for now we just need *something* so the renderer doesn't filter all stops away):

```json
[
  {
    "id": "jonker-walk",
    "name": "Jonker Walk 鸡场街",
    "day": 1,
    "order": 1,
    "time": "14:30",
    "lat": 2.1956,
    "lng": 102.2486,
    "mapsUrl": "https://maps.app.goo.gl/sample",
    "rating": 4,
    "media": [
      { "src": "media/jonker-walk/placeholder.svg", "type": "photo", "w": 800, "h": 600 }
    ]
  }
]
```

Then create the placeholder file:

```bash
mkdir -p media/jonker-walk
cat > media/jonker-walk/placeholder.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#b9a47c"/><text x="400" y="320" text-anchor="middle" fill="#3a2a18" font-family="serif" font-size="48">placeholder</text></svg>
EOF
```

- [ ] **Step 4: Run the data test, then smoke test in the browser**

Run: `node --test tests/data.test.mjs`
Expected: passes (the placeholder SVG exists, so the file-exists assertion passes).

Run: `python3 -m http.server 8000 &`
Open: `http://localhost:8000/`. Expected: header still shows, plus a "DAY ONE · Friday, 22 May" section and a "Jonker Walk" stop card with time, stars, name, English+Chinese, and a "Open in Maps ↗" link. The `.stop-gallery` div will be empty (Phase 2 finishes that in Task 6).

Kill server: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add app.js lib/render.mjs memories.json media/jonker-walk/placeholder.svg
git commit -m "feat: minimal renderer — day sections and stop cards"
```

---

### Task 6: `lib/gallery.mjs` — varied grid + sizeFor logic

**Files:**
- Create: `lib/gallery.mjs`
- Create: `tests/gallery.test.mjs`

- [ ] **Step 1: Write the failing test**

Write to `tests/gallery.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeFor } from "../lib/gallery.mjs";

test("landscape image gets span-2 columns", () => {
  assert.deepEqual(sizeFor({ w: 1600, h: 900 }), { colSpan: 2, rowSpan: 1 });
});

test("portrait image gets span-2 rows", () => {
  assert.deepEqual(sizeFor({ w: 900, h: 1600 }), { colSpan: 1, rowSpan: 2 });
});

test("near-square stays 1x1", () => {
  assert.deepEqual(sizeFor({ w: 1000, h: 1000 }), { colSpan: 1, rowSpan: 1 });
  assert.deepEqual(sizeFor({ w: 1200, h: 1000 }), { colSpan: 1, rowSpan: 1 });
});

test("missing dimensions default to 1x1", () => {
  assert.deepEqual(sizeFor({}), { colSpan: 1, rowSpan: 1 });
  assert.deepEqual(sizeFor({ w: 0, h: 0 }), { colSpan: 1, rowSpan: 1 });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/gallery.test.mjs`
Expected: FAIL — `Cannot find module '../lib/gallery.mjs'`.

- [ ] **Step 3: Implement `lib/gallery.mjs`**

Write to `lib/gallery.mjs`:

```js
// Decide grid cell span for a media item given its pixel dimensions.
// Landscape (w/h > 1.4): span 2 columns. Portrait (h/w > 1.4): span 2 rows.
// Otherwise: 1x1. Missing/zero dims also fall back to 1x1.
export function sizeFor(item) {
  const w = Number(item?.w) || 0;
  const h = Number(item?.h) || 0;
  if (!w || !h) return { colSpan: 1, rowSpan: 1 };
  const ratio = w / h;
  if (ratio > 1.4)  return { colSpan: 2, rowSpan: 1 };
  if (1 / ratio > 1.4) return { colSpan: 1, rowSpan: 2 };
  return { colSpan: 1, rowSpan: 1 };
}

function mediaTileHTML(item, idx) {
  const { colSpan, rowSpan } = sizeFor(item);
  const style = `grid-column:span ${colSpan};grid-row:span ${rowSpan};`;
  const bg = item.type === "video" ? (item.poster || item.src) : item.src;
  const playOverlay = item.type === "video" ? `<span class="play-overlay" aria-hidden="true">▶</span>` : "";
  return `
    <button type="button" class="tile" data-idx="${idx}" style="${style}background-image:url('${bg}')">
      ${playOverlay}
    </button>
  `;
}

// Mounts the grid for one stop into its container.
// onTileClick is called with (stop, mediaIndex) when a tile is tapped.
export function mountGallery(stop, container, onTileClick) {
  container.innerHTML = stop.media.map(mediaTileHTML).join("");
  container.addEventListener("click", e => {
    const btn = e.target.closest(".tile");
    if (!btn) return;
    onTileClick(stop, Number(btn.dataset.idx));
  });
}
```

- [ ] **Step 4: Run gallery test**

Run: `node --test tests/gallery.test.mjs`
Expected: all 4 tests pass.

- [ ] **Step 5: Wire `mountGallery` into `app.js`**

Replace the body of `main()` in `app.js`:

```js
import { renderDays } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      console.log("clicked", s.id, i); // lightbox wires in next task
    });
  }
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});
```

- [ ] **Step 6: Smoke test**

Run: `python3 -m http.server 8000 &`
Open: `http://localhost:8000/`. Expected: the Jonker Walk card now shows a grid with the placeholder SVG tile. Clicking it logs to the browser console. Kill: `kill %1`.

- [ ] **Step 7: Commit**

```bash
git add lib/gallery.mjs tests/gallery.test.mjs app.js
git commit -m "feat: varied media grid with sizeFor rules and tests"
```

---

### Task 7: `lib/lightbox.mjs` — fullscreen swipe overlay

**Files:**
- Create: `lib/lightbox.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write `lib/lightbox.mjs`**

Write to `lib/lightbox.mjs`:

```js
// Fullscreen swipeable lightbox. Single global instance, uses #lightbox in index.html.
let state = null; // { items, idx, label }

function el(sel) { return document.querySelector(sel); }

function renderItem() {
  const stage = el(".lightbox-stage");
  const item = state.items[state.idx];
  if (item.type === "video") {
    stage.innerHTML = `<video src="${item.src}" controls playsinline></video>`;
  } else {
    stage.innerHTML = `<img src="${item.src}" alt="">`;
  }
  el(".lightbox-counter").textContent = `${state.label} · ${state.idx + 1} / ${state.items.length}`;
  const progress = el(".lightbox-progress");
  progress.innerHTML = state.items.map((_, i) =>
    `<span class="dot${i === state.idx ? " active" : ""}"></span>`
  ).join("");
}

function move(delta) {
  if (!state) return;
  state.idx = (state.idx + delta + state.items.length) % state.items.length;
  renderItem();
}

function close() {
  state = null;
  const root = el("#lightbox");
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  el(".lightbox-stage").innerHTML = "";
  document.body.style.overflow = "";
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  el(".lightbox-close").addEventListener("click", close);
  el(".lightbox-prev").addEventListener("click", () => move(-1));
  el(".lightbox-next").addEventListener("click", () => move(1));
  document.addEventListener("keydown", e => {
    if (!state) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "ArrowRight") move(1);
  });
  // touch swipe
  const stage = el(".lightbox-stage");
  let startX = null;
  stage.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
    startX = null;
  });
}

export function openLightbox(items, startIdx, label) {
  wireOnce();
  state = { items, idx: Math.max(0, Math.min(startIdx, items.length - 1)), label };
  const root = el("#lightbox");
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderItem();
}
```

- [ ] **Step 2: Wire it into `app.js`**

Replace `app.js`:

```js
import { renderDays } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      const label = splitName(s.name).main;
      openLightbox(s.media, i, label);
    });
  }
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});
```

- [ ] **Step 3: Smoke test**

Run: `python3 -m http.server 8000 &`
Open `http://localhost:8000/`. Expected: tap the placeholder tile — fullscreen lightbox opens. `‹` / `›` buttons exist but only one item so they wrap. `×` button closes. Kill: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add lib/lightbox.mjs app.js
git commit -m "feat: fullscreen swipe lightbox for media tiles"
```

---

# Phase 3 — Curation script (the curator can now bulk-import)

### Task 8: Bootstrap `package.json` with `sharp` dependency

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write `package.json`**

Write to `package.json`:

```json
{
  "name": "melaka-trip-memory-book",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.mjs",
    "add-stop": "node tools/add-stop.mjs"
  },
  "devDependencies": {
    "sharp": "^0.33.5"
  }
}
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:

```
node_modules/
```

(`.superpowers/` should already be there from earlier.)

- [ ] **Step 3: Install**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`. Sharp downloads its prebuilt binary.

- [ ] **Step 4: Verify sharp loads**

Run: `node -e "import('sharp').then(s => console.log('ok:', typeof s.default))"`
Expected: prints `ok: function`.

- [ ] **Step 5: Verify ffmpeg is available on the system**

Run: `which ffmpeg && which ffprobe`
Expected: prints two paths. If either is missing, run `brew install ffmpeg` first.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: add package.json with sharp for curation script"
```

---

### Task 9: `tools/lib/resolve-maps.mjs` — short URL → lat/lng

**Files:**
- Create: `tools/lib/resolve-maps.mjs`
- Create: `tests/resolve-maps.test.mjs`

- [ ] **Step 1: Write the failing test**

Write to `tests/resolve-maps.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLatLng } from "../tools/lib/resolve-maps.mjs";

test("extracts !3d / !4d from a resolved URL", () => {
  const url = "https://www.google.com/maps/place/Jonker+Walk/@2.1956,102.2486,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d2.1956!4d102.2486!16s%2Fg%2F1tdwm6lc";
  assert.deepEqual(extractLatLng(url), { lat: 2.1956, lng: 102.2486 });
});

test("extracts from @lat,lng,zoom form if !3d/!4d absent", () => {
  const url = "https://www.google.com/maps/@2.1956,102.2486,17z";
  assert.deepEqual(extractLatLng(url), { lat: 2.1956, lng: 102.2486 });
});

test("returns null for an unparseable URL", () => {
  assert.equal(extractLatLng("https://example.com/no/coords/here"), null);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/resolve-maps.test.mjs`
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Implement the module**

Write to `tools/lib/resolve-maps.mjs`:

```js
// Resolve a Google Maps short URL (https://maps.app.goo.gl/…) to {lat, lng}.
// Two layers:
//   resolveShortUrl(url) → follows redirects and returns the final long URL
//   extractLatLng(longUrl) → parses lat/lng out of the long URL

export function extractLatLng(longUrl) {
  // Prefer the !3d / !4d form which is the canonical place coordinate.
  const place = longUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]) };
  // Fallback: @lat,lng,zoomZ form (viewport center; usually close enough).
  const at = longUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  return null;
}

export async function resolveShortUrl(shortUrl) {
  // GET (not HEAD — Google sometimes blocks HEAD) and follow redirects manually.
  let url = shortUrl;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    return url;
  }
  throw new Error(`too many redirects starting from ${shortUrl}`);
}

export async function resolveCoords(input) {
  // Accepts: lat,lng pair like "2.1956,102.2486" — returns it directly.
  const direct = input.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (direct) return { lat: Number(direct[1]), lng: Number(direct[2]) };
  // Accepts: a https://… URL — short or long.
  const long = input.startsWith("https://maps.app.goo.gl/") ? await resolveShortUrl(input) : input;
  const coords = extractLatLng(long);
  if (!coords) throw new Error(`could not extract coords from ${long}`);
  return coords;
}
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/resolve-maps.test.mjs`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/resolve-maps.mjs tests/resolve-maps.test.mjs
git commit -m "feat: maps short-url resolver with lat/lng extractor"
```

---

### Task 10: `tools/lib/media-import.mjs` — copy + rename + dims + posters

**Files:**
- Create: `tools/lib/media-import.mjs`

- [ ] **Step 1: Implement the module**

Write to `tools/lib/media-import.mjs`:

```js
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
```

- [ ] **Step 2: Manual smoke test with a fake source directory**

Run:
```bash
mkdir -p /tmp/melaka-test-import
# put any small jpg there. If you don't have one handy, generate:
node -e "import('sharp').then(({default:sharp})=>sharp({create:{width:400,height:300,channels:3,background:'#b91c1c'}}).jpeg().toFile('/tmp/melaka-test-import/test.jpg'))"
node -e "import('./tools/lib/media-import.mjs').then(m=>m.importMedia('/tmp/melaka-test-import','smoke-test')).then(console.log)"
```
Expected: prints an array with one item like `{ src: 'media/smoke-test/01.jpg', type: 'photo', w: 400, h: 300 }`. The file `media/smoke-test/01.jpg` exists.

- [ ] **Step 3: Clean up the smoke-test artifacts**

```bash
rm -rf media/smoke-test /tmp/melaka-test-import
```

- [ ] **Step 4: Commit**

```bash
git add tools/lib/media-import.mjs
git commit -m "feat: media import helper — copy, rename, dims, video posters"
```

---

### Task 11: `tools/add-stop.mjs` — the curation CLI

**Files:**
- Create: `tools/add-stop.mjs`

- [ ] **Step 1: Implement the CLI**

Write to `tools/add-stop.mjs`:

```js
#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv } from "node:process";
import { spawnSync } from "node:child_process";
import { resolveCoords } from "./lib/resolve-maps.mjs";
import { importMedia } from "./lib/media-import.mjs";

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
  const day = Number(flags.day ?? await prompt(rl, "day (1/2/3)", {
    validate: v => ["1","2","3"].includes(v) ? null : "must be 1, 2, or 3"
  }));
  const time = flags.time ?? await prompt(rl, "time (HH:MM)", {
    validate: v => /^[0-2]\d:[0-5]\d$/.test(v) ? null : "must be HH:MM"
  });
  const rating = Number(flags.rating ?? await prompt(rl, "rating (1-5)", {
    validate: v => ["1","2","3","4","5"].includes(v) ? null : "must be 1..5"
  }));
  const mapsInput = flags.maps ?? await prompt(rl, "maps URL or lat,lng");
  const mediaDir = flags.media ?? await prompt(rl, "media folder path");

  rl.close();

  // Resolve coords
  const { lat, lng } = await resolveCoords(mapsInput);
  const mapsUrl = mapsInput.startsWith("https://") ? mapsInput : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

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

  const entry = { id, name, day, order, time, lat, lng, mapsUrl, rating, media };

  // Upsert
  const i = memories.findIndex(m => m.id === id);
  if (i >= 0) memories[i] = entry; else memories.push(entry);
  memories.sort((a, b) => a.day - b.day || a.order - b.order);

  // Write atomically: write to temp, then rename
  const tmp = "memories.json.tmp";
  await writeFile(tmp, JSON.stringify(memories, null, 2) + "\n");
  const { renameSync, unlinkSync } = await import("node:fs");
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
```

- [ ] **Step 2: End-to-end smoke test the script**

Run, providing fake but valid inputs:

```bash
mkdir -p /tmp/melaka-add-stop-test
node -e "import('sharp').then(({default:sharp})=>sharp({create:{width:1600,height:900,channels:3,background:'#5a8a8a'}}).jpeg().toFile('/tmp/melaka-add-stop-test/sunset.jpg'))"
node tools/add-stop.mjs \
  --id smoke-test-stop \
  --name "Smoke Test 测试" \
  --day 2 \
  --time 18:00 \
  --rating 5 \
  --maps "2.1956,102.2486" \
  --media /tmp/melaka-add-stop-test
```

Expected: script prints "imported 1 item(s)", runs tests, prints "✓ Added/updated 'smoke-test-stop'". `memories.json` now contains the new entry. `media/smoke-test-stop/01.jpg` exists.

- [ ] **Step 3: Clean up the smoke-test artifacts**

```bash
node -e "
import('node:fs/promises').then(async fs => {
  const m = JSON.parse(await fs.readFile('memories.json','utf8'));
  await fs.writeFile('memories.json', JSON.stringify(m.filter(x => x.id !== 'smoke-test-stop'), null, 2) + '\n');
});
" && rm -rf media/smoke-test-stop /tmp/melaka-add-stop-test
```

Verify with: `node --test tests/data.test.mjs` (should still pass).

- [ ] **Step 4: Commit**

```bash
git add tools/add-stop.mjs
git commit -m "feat: add-stop CLI for single-step stop curation"
```

---

# Phase 4 — Map

### Task 12: `lib/map.mjs` — pins, polyline, click-to-scroll

**Files:**
- Create: `lib/map.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write `lib/map.mjs`**

Write to `lib/map.mjs`:

```js
// Leaflet wrapper for the memory book's sticky map header.
// Exports mountMap(container, stops, { onPinClick }).

const TILE_URL = "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg";
const TILE_ATTR = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen</a> &copy; <a href="https://openstreetmap.org/">OSM</a>';

function pinIcon(number) {
  return L.divIcon({
    className: "trip-pin",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="trip-pin-inner">${number}</div>`
  });
}

export function mountMap(container, stops, { onPinClick } = {}) {
  if (!stops.length) return null;

  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([2.1956, 102.2486], 13);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);

  const numbered = stops.map((s, i) => ({ ...s, n: i + 1 }));
  for (const s of numbered) {
    L.marker([s.lat, s.lng], { icon: pinIcon(s.n) })
      .addTo(map)
      .on("click", () => onPinClick && onPinClick(s));
  }
  L.polyline(numbered.map(s => [s.lat, s.lng]), {
    color: "#b91c1c", weight: 2, opacity: 0.6, dashArray: "4,4"
  }).addTo(map);

  map.fitBounds(numbered.map(s => [s.lat, s.lng]), { padding: [30, 30] });
  return map;
}
```

- [ ] **Step 2: Add minimal pin styling to `style.css`**

Append to `style.css` (file may not exist yet — if so, create it empty first):

```css
.trip-pin-inner {
  background: #b91c1c;
  color: #fff;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Inter, sans-serif;
  font-weight: 600;
  font-size: 13px;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.map { height: 40vh; }
```

- [ ] **Step 3: Wire it into `app.js`**

Update `app.js`:

```js
import { renderDays } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";
import { mountMap } from "./lib/map.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  mountMap(document.getElementById("map"), stops, {
    onPinClick: (s) => {
      const card = document.getElementById(`stop-${s.id}`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      openLightbox(s.media, i, splitName(s.name).main);
    });
  }
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});
```

- [ ] **Step 4: Smoke test**

Run: `python3 -m http.server 8000 &`
Open `http://localhost:8000/`. Expected: warm watercolor map appears with a numbered red pin for the Jonker Walk stop. Clicking the pin smooth-scrolls to the card below. Kill: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add lib/map.mjs app.js style.css
git commit -m "feat: leaflet map with numbered pins, polyline, click-scroll"
```

---

### Task 13: Sticky map shrink-on-scroll

**Files:**
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add sticky CSS**

Append to `style.css`:

```css
.map {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 40vh;
  transition: height 0.25s ease;
}
.map.shrunk { height: 80px; }
```

- [ ] **Step 2: Wire the scroll listener in `app.js`**

After the `mountMap(...)` call, add (and capture the returned map):

```js
  const map = mountMap(document.getElementById("map"), stops, {
    onPinClick: (s) => {
      const card = document.getElementById(`stop-${s.id}`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const mapEl = document.getElementById("map");
  let shrunk = false;
  window.addEventListener("scroll", () => {
    const should = window.scrollY > window.innerHeight * 0.3;
    if (should !== shrunk) {
      shrunk = should;
      mapEl.classList.toggle("shrunk", shrunk);
      if (map) map.invalidateSize();
    }
  }, { passive: true });
```

- [ ] **Step 3: Smoke test**

Run: `python3 -m http.server 8000 &`
Open `http://localhost:8000/`. Expected: as you scroll past ~30% of the viewport, the map shrinks to an 80px strip and stays pinned. Scrolling back to the top expands it again. Kill: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: sticky map shrinks to a strip on scroll"
```

---

# Phase 5 — Visual polish

### Task 14: Full `style.css` rewrite — palette, fonts, layout

**Files:**
- Modify (rewrite): `style.css`

- [ ] **Step 1: Replace the entire file**

Write to `style.css`:

```css
:root {
  --bg:     #e8dcc4;
  --ink:    #3a2a18;
  --accent: #b91c1c;
  --gold:   #e8a838;
  --muted:  #7a6346;
  --rule:   #d4c4a0;

  --font-serif: "Cormorant Garamond", "Noto Serif SC", Georgia, serif;
  --font-sans:  Inter, "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: var(--font-serif); }

/* ─── Masthead ─────────────────────────────── */
.masthead {
  padding: 36px 20px 18px;
  text-align: center;
  border-bottom: 1px solid var(--rule);
}
.eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--muted);
  margin-bottom: 6px;
}
.title {
  margin: 0;
  font-size: 44px;
  font-weight: 600;
}
.dek {
  margin: 4px 0 14px;
  font-style: italic;
  color: var(--muted);
}
.tile-strip {
  display: inline-flex;
  gap: 4px;
}
.tile-strip span {
  width: 16px;
  height: 16px;
  background: var(--accent);
}
.tile-strip span:nth-child(3n+2) { background: var(--gold); }
.tile-strip span:nth-child(3n+3) { background: #5a8a8a; }

/* ─── Map ──────────────────────────────────── */
.map {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 40vh;
  transition: height 0.25s ease;
}
.map.shrunk { height: 80px; }
.trip-pin-inner {
  background: var(--accent);
  color: #fff;
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-sans); font-weight: 600; font-size: 13px;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

/* ─── Day section ──────────────────────────── */
.day { padding: 24px 0 8px; }
.day-head { padding: 0 24px 8px; }
.day-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--accent);
}
.day-date {
  margin: 2px 0 0;
  font-size: 28px;
  font-weight: 600;
}

/* ─── Timeline line + stops ────────────────── */
.day-line {
  position: relative;
  margin: 16px 0 0;
  padding: 0 24px 0 56px;
}
.day-line::before {
  content: "";
  position: absolute;
  left: 36px;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: var(--accent);
}
.stop {
  position: relative;
  padding: 14px 0 22px;
  border-bottom: 1px solid var(--rule);
}
.stop:last-child { border-bottom: none; }
.stop-dot {
  position: absolute;
  left: -29px;
  top: 18px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  background: var(--bg);
}
.stop-dot::after {
  content: "";
  position: absolute;
  inset: 3px;
  background: var(--accent);
  border-radius: 50%;
}

/* ─── Stop head + name ─────────────────────── */
.stop-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}
.stop-time {
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--muted);
}
.stop-stars {
  font-size: 13px;
  color: var(--gold);
}
.stop-name {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.15;
}
.stop-cn {
  margin: 2px 0 12px;
  font-style: italic;
  color: var(--muted);
  font-size: 15px;
}

/* ─── Gallery grid ─────────────────────────── */
.stop-gallery {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 80px;
  gap: 4px;
  margin: 10px 0 8px;
}
.tile {
  position: relative;
  border: 0;
  padding: 0;
  background-size: cover;
  background-position: center;
  border-radius: 4px;
  cursor: pointer;
}
.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  pointer-events: none;
}

.stop-maps {
  display: inline-block;
  margin-top: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
}
.stop-maps:hover { color: var(--accent); }

/* ─── Lightbox ─────────────────────────────── */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.92);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox[hidden] { display: none; }
.lightbox-stage {
  width: min(94vw, 1400px);
  height: min(82vh, 1000px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-stage img,
.lightbox-stage video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.lightbox-close,
.lightbox-prev,
.lightbox-next {
  position: absolute;
  background: rgba(255,255,255,0.12);
  color: #fff;
  border: 0;
  width: 44px; height: 44px;
  border-radius: 50%;
  font-size: 22px;
  cursor: pointer;
}
.lightbox-close { top: 16px; right: 16px; }
.lightbox-prev  { left: 16px;  top: 50%; transform: translateY(-50%); }
.lightbox-next  { right: 16px; top: 50%; transform: translateY(-50%); }
.lightbox-counter {
  position: absolute;
  top: 20px; left: 20px;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 12px;
  opacity: 0.7;
}
.lightbox-progress {
  position: absolute;
  bottom: 18px; left: 0; right: 0;
  display: flex;
  gap: 4px;
  justify-content: center;
}
.lightbox-progress .dot {
  width: 20px; height: 3px;
  background: rgba(255,255,255,0.3);
  border-radius: 2px;
}
.lightbox-progress .dot.active { background: #fff; }

/* ─── Mobile ───────────────────────────────── */
@media (max-width: 640px) {
  .map { height: 35vh; }
  .day-line { padding: 0 16px 0 44px; }
  .day-line::before { left: 26px; }
  .stop-dot { left: -27px; }
  .stop-gallery { grid-auto-rows: 64px; }
}
```

- [ ] **Step 2: Smoke test the visual**

Run: `python3 -m http.server 8000 &`
Open `http://localhost:8000/`. Expected: cream background, serif "Melaka" header, tile-strip below the date, sticky watercolor map, "DAY ONE" eyebrow + serif date heading, vertical red line on the left of the day section, red ringed dot beside the Jonker Walk card, time/stars/name/Chinese name/grid/maps-link all rendered with the warm palette. Tap the tile → lightbox styled to match. Kill: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style: full warm/nostalgic palette, fonts, timeline, lightbox"
```

---

# Phase 6 — Docs

### Task 15: Update `README.md` and `CLAUDE.md`

**Files:**
- Modify (rewrite): `README.md`
- Modify (rewrite): `CLAUDE.md`

- [ ] **Step 1: Rewrite `README.md`**

Write to `README.md`:

```markdown
# Melaka Memory Book

A single-page static site that documents the Melaka trip, 22–24 May 2026.
Lives at https://jmyz72.github.io/melaka-trip/.

## Local dev

```bash
python3 -m http.server 8000  # then open http://localhost:8000/
node --test tests/*.mjs      # run all tests
```

## Adding a stop

```bash
npm install                  # one-time; pulls in `sharp` for HEIC + dims
brew install ffmpeg          # one-time; for video posters + dims
node tools/add-stop.mjs      # interactive prompts
# or with flags:
node tools/add-stop.mjs \
  --id jonker-walk \
  --name "Jonker Walk 鸡场街" \
  --day 1 --time 14:30 --rating 4 \
  --maps "https://maps.app.goo.gl/..." \
  --media ~/Downloads/jonker-photos/
```

The script copies media into `media/<id>/`, generates posters for videos, reads
dimensions, and upserts the entry into `memories.json`. Always commit
`memories.json` and `media/<id>/` together.

## Deploy

`git push origin main` — GitHub Pages serves the result.
```

- [ ] **Step 2: Rewrite `CLAUDE.md`**

Write to `CLAUDE.md`:

```markdown
# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

A single-page static site documenting a 3-day Melaka trip (22–24 May 2026).
**Memory book**: photos, videos, ratings on a vertical per-day timeline anchored
by a sticky watercolor map. Single curator (Carson); contributions come in via
the `tools/add-stop.mjs` script, not via the website.

No bundler. Vanilla ES modules. Hosted on GitHub Pages — `git push origin main`
deploys.

## Commands

```bash
python3 -m http.server 8000         # serve at http://localhost:8000/
node --test tests/*.mjs             # run all tests
node tools/add-stop.mjs [flags]     # add or update a stop (see README.md)
```

## Architecture

`memories.json` is the only runtime data file. The app:

1. `app.js` fetches `memories.json`, calls `lib/render.mjs` to mount day sections.
2. `lib/render.mjs` filters out stops with no media, groups by `day`, sorts by
   `order`, emits day headings + stop cards with a dot on a vertical red line.
3. `lib/map.mjs` mounts a Leaflet map with numbered red pins + polyline.
   Clicking a pin smooth-scrolls to that stop's card.
4. `lib/gallery.mjs` decides each tile's grid span via `sizeFor()` (landscape →
   2 cols, portrait → 2 rows, else 1×1). Tapping a tile opens the lightbox.
5. `lib/lightbox.mjs` is a single global overlay; swipe / arrow keys to navigate,
   ESC to close.
6. `lib/name.mjs` exposes `splitName()` for bilingual names like
   `"Jonker Walk 鸡场街"` → `{ main: "Jonker Walk", cn: "鸡场街" }`.

## Data shape

Each entry in `memories.json`:

```json
{
  "id": "jonker-walk",
  "name": "Jonker Walk 鸡场街",
  "day": 1,
  "order": 3,
  "time": "14:30",
  "lat": 2.1956,
  "lng": 102.2486,
  "mapsUrl": "https://maps.app.goo.gl/...",
  "rating": 4,
  "media": [
    { "src": "media/jonker-walk/01.jpg", "type": "photo", "w": 1600, "h": 1200 },
    { "src": "media/jonker-walk/02.mp4", "type": "video", "poster": "media/jonker-walk/02-thumb.jpg", "w": 1920, "h": 1080 }
  ]
}
```

Validated in `tests/data.test.mjs`: id format `^[a-z0-9-]{1,40}$` and unique,
`day ∈ {1,2,3}`, `time` matches `HH:MM`, lat/lng in Peninsular Malaysia,
`rating ∈ 1..5`, every media path exists on disk, video posters exist.

## Conventions and gotchas

- **`memories.json` is hand-curated only via `add-stop.mjs`** — never invent
  entries; the script is the source of truth for ID format, file paths, and
  poster generation.
- **Always commit `memories.json` + `media/<id>/` together.** A new entry that
  points to media files that aren't in git breaks the live site.
- **`splitName()` requires `<CJK> <Latin>` or `<Latin> <CJK>`** — mixed-middle
  strings fall back to `{ cn: null, main: original }`.
- **Map tiles** come from Stadia's Stamen Watercolor endpoint. If unauthenticated
  requests get rate-limited later, switch to OSM with a sepia CSS filter (see
  spec for details).
- **Videos commit to the repo.** Acceptable up to ~1 GB total; if it bloats
  further, revisit Cloudflare R2 or GitHub Releases per the design spec.
- **Tests are the only gate** — no CI, no linter. Run `node --test tests/*.mjs`
  after any change to `memories.json`, `lib/`, or the tools.
```

- [ ] **Step 3: Final sanity check — all tests pass**

Run: `node --test tests/*.mjs`
Expected: all tests pass across `data.test.mjs`, `name.test.mjs`, `gallery.test.mjs`, `resolve-maps.test.mjs`.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: rewrite README and CLAUDE.md for memory-book era"
```

---

## After this plan

- The site renders the curated set of stops on a per-day timeline with a sticky map.
- `tools/add-stop.mjs` is ready for Carson to bulk-import the real trip media.
- The placeholder Jonker Walk stop (and `media/jonker-walk/placeholder.svg`) can
  be removed manually once the first real stop is added, or kept until then.
- Push to `origin/main` and GitHub Pages will serve the new site.

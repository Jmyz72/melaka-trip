# Friends Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live Firestore-backed 1–5 star ratings (with average + count) to every memory-book stop card. Spec: `docs/superpowers/specs/2026-05-23-friends-rating-design.md`.

**Architecture:** Anonymous uid in `localStorage`. Firestore collection `ratings/{placeId}` doc with `{ by: { uid: 1..5 } }` map. Live `onSnapshot` subscription. `setDoc` merge for writes. Pure `summarize()` helper unit-tested; DOM and Firestore wiring verified in the browser.

**Tech Stack:** Firebase Web SDK v10+ (modular, ESM CDN); same vanilla ES modules, `node:test`, sharp/exifr for tooling (unchanged).

**Branching note:** Work directly on `main`, push after each task. The site is already in mid-rebuild state (placeholder Jonker Walk + empty data); breaking it further during this feature is acceptable. The rules deploy step (Task 7) is the only externally visible action.

---

## File structure overview

**Created:**
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `lib/ratings.mjs`
- `tests/ratings.test.mjs`

**Modified:**
- `app.js`, `lib/render.mjs`, `style.css`, `memories.json`, `tests/data.test.mjs`, `tools/add-stop.mjs`, `CLAUDE.md`, `README.md`

---

### Task 1: Restore Firebase config files

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`

- [ ] **Step 1: Create `firebase.json`**

Write to `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 2: Create `.firebaserc`**

Write to `.firebaserc`:

```json
{
  "projects": {
    "default": "project-21c844a6-e5cc-4a62-920"
  }
}
```

- [ ] **Step 3: Create `firestore.rules` for the ratings collection**

Write to `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Per-stop rating doc. id matches the stop id format.
    match /ratings/{placeId} {
      allow read: if true;

      // Writes must:
      //  - target a valid place id
      //  - touch only the `by` map
      //  - keep total rater count <= 100
      //  - every value in `by` must be an integer 1..5
      allow write: if placeId.matches('^[a-z0-9-]{1,40}$')
                   && request.resource.data.keys().hasOnly(['by'])
                   && request.resource.data.by is map
                   && request.resource.data.by.size() <= 100
                   && request.resource.data.by.values().toSet()
                        .difference([1,2,3,4,5].toSet()).size() == 0;
    }

    // Lock everything else.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add firebase.json .firebaserc firestore.rules
git commit -m "feat(firestore): restore firebase config with rules for ratings collection"
```

---

### Task 2: Add `lib/ratings.mjs` — Firebase init + uid + subscribe + write + summarize

**Files:**
- Create: `lib/ratings.mjs`
- Create: `tests/ratings.test.mjs`

- [ ] **Step 1: Write the failing test**

Write to `tests/ratings.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../lib/ratings.mjs";

test("empty map → null avg, 0 count, null my", () => {
  assert.deepEqual(summarize({}, "uid-mine"), { my: null, avg: null, count: 0 });
});

test("three ratings without my uid", () => {
  const r = summarize({ a: 4, b: 5, c: 4 }, "uid-mine");
  assert.equal(r.my, null);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("three ratings including mine", () => {
  const r = summarize({ a: 4, "uid-mine": 5, c: 4 }, "uid-mine");
  assert.equal(r.my, 5);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("only my rating", () => {
  assert.deepEqual(summarize({ "uid-mine": 4 }, "uid-mine"), { my: 4, avg: 4, count: 1 });
});

test("missing/undefined map argument", () => {
  assert.deepEqual(summarize(undefined, "uid-mine"), { my: null, avg: null, count: 0 });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `node --test tests/ratings.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/ratings.mjs`**

Write to `lib/ratings.mjs`:

```js
// Firestore-backed friends ratings. Browser-only module:
// the Firebase imports run in the browser via ESM CDN. The pure helper
// `summarize` is exported separately for Node-side unit tests.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQyLGKURTB64x_a038gdYTxCGHYDszhj4",
  authDomain: "project-21c844a6-e5cc-4a62-920.firebaseapp.com",
  projectId: "project-21c844a6-e5cc-4a62-920",
  storageBucket: "project-21c844a6-e5cc-4a62-920.firebasestorage.app",
  messagingSenderId: "810424813381",
  appId: "1:810424813381:web:a390e6227e83c3be2be02c"
};

let app, db;
function ensureInit() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
}

export function getUserId() {
  let uid = localStorage.getItem("melaka_uid");
  if (!uid) {
    uid = (crypto.randomUUID && crypto.randomUUID()) ||
          ("u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("melaka_uid", uid);
  }
  return uid;
}

// Pure: take a `by` map (uid → 1..5) and your uid, return display data.
export function summarize(by, myUid) {
  const safe = (by && typeof by === "object") ? by : {};
  const values = Object.values(safe).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
  const count = values.length;
  const avg = count ? values.reduce((a, b) => a + b, 0) / count : null;
  const my = (myUid && safe[myUid] != null) ? safe[myUid] : null;
  return { my, avg, count };
}

// Subscribe to the entire `ratings` collection. `onUpdate(map)` is called
// with a Map<placeId, { my, avg, count }> on every Firestore push.
export function subscribeAll(onUpdate) {
  ensureInit();
  const uid = getUserId();
  return onSnapshot(collection(db, "ratings"), snap => {
    const out = new Map();
    snap.forEach(d => {
      const by = d.data().by || {};
      out.set(d.id, summarize(by, uid));
    });
    onUpdate(out);
  });
}

// Write/update my rating for one place.
export async function setRating(placeId, stars) {
  ensureInit();
  const uid = getUserId();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error(`stars must be integer 1..5, got ${stars}`);
  }
  await setDoc(doc(db, "ratings", placeId), { by: { [uid]: stars } }, { merge: true });
}
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/ratings.test.mjs`

The test will FAIL at module load time because Node can't resolve the `https://…` Firebase imports — they're browser-only. This is expected. Update the test approach:

Replace `tests/ratings.test.mjs` with a version that imports `summarize` differently. Since Node won't follow the `https://` import in `lib/ratings.mjs`, we need to either (a) split `summarize` into its own module, or (b) use a dynamic import wrapped in a try/catch.

The cleaner solution is (a): extract `summarize` into `lib/ratings-summary.mjs` (pure, no Firebase deps), then have `lib/ratings.mjs` re-export it. Refactor:

**`lib/ratings-summary.mjs`** (new):

```js
// Pure helper: take a `by` map (uid → 1..5) and your uid,
// return { my, avg, count } display data. No Firebase dep so Node can test it.
export function summarize(by, myUid) {
  const safe = (by && typeof by === "object") ? by : {};
  const values = Object.values(safe).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
  const count = values.length;
  const avg = count ? values.reduce((a, b) => a + b, 0) / count : null;
  const my = (myUid && safe[myUid] != null) ? safe[myUid] : null;
  return { my, avg, count };
}
```

**`lib/ratings.mjs`** — remove the inline `summarize` and import it:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { summarize } from "./ratings-summary.mjs";

const firebaseConfig = {
  apiKey: "AIzaSyAQyLGKURTB64x_a038gdYTxCGHYDszhj4",
  authDomain: "project-21c844a6-e5cc-4a62-920.firebaseapp.com",
  projectId: "project-21c844a6-e5cc-4a62-920",
  storageBucket: "project-21c844a6-e5cc-4a62-920.firebasestorage.app",
  messagingSenderId: "810424813381",
  appId: "1:810424813381:web:a390e6227e83c3be2be02c"
};

let app, db;
function ensureInit() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
}

export function getUserId() {
  let uid = localStorage.getItem("melaka_uid");
  if (!uid) {
    uid = (crypto.randomUUID && crypto.randomUUID()) ||
          ("u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("melaka_uid", uid);
  }
  return uid;
}

export { summarize };

export function subscribeAll(onUpdate) {
  ensureInit();
  const uid = getUserId();
  return onSnapshot(collection(db, "ratings"), snap => {
    const out = new Map();
    snap.forEach(d => {
      const by = d.data().by || {};
      out.set(d.id, summarize(by, uid));
    });
    onUpdate(out);
  });
}

export async function setRating(placeId, stars) {
  ensureInit();
  const uid = getUserId();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error(`stars must be integer 1..5, got ${stars}`);
  }
  await setDoc(doc(db, "ratings", placeId), { by: { [uid]: stars } }, { merge: true });
}
```

Update `tests/ratings.test.mjs` to import from the pure module:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../lib/ratings-summary.mjs";

test("empty map → null avg, 0 count, null my", () => {
  assert.deepEqual(summarize({}, "uid-mine"), { my: null, avg: null, count: 0 });
});

test("three ratings without my uid", () => {
  const r = summarize({ a: 4, b: 5, c: 4 }, "uid-mine");
  assert.equal(r.my, null);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("three ratings including mine", () => {
  const r = summarize({ a: 4, "uid-mine": 5, c: 4 }, "uid-mine");
  assert.equal(r.my, 5);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("only my rating", () => {
  assert.deepEqual(summarize({ "uid-mine": 4 }, "uid-mine"), { my: 4, avg: 4, count: 1 });
});

test("missing/undefined map argument", () => {
  assert.deepEqual(summarize(undefined, "uid-mine"), { my: null, avg: null, count: 0 });
});
```

- [ ] **Step 5: Run the test (should now pass)**

Run: `node --test tests/ratings.test.mjs`
Expected: 5 pass.

Run: `node --test tests/*.mjs`
Expected: 20 pass total (15 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add lib/ratings.mjs lib/ratings-summary.mjs tests/ratings.test.mjs
git commit -m "feat(ratings): firebase-backed ratings module + pure summarize helper"
```

---

### Task 3: Drop `rating` from data + script

**Files:**
- Modify: `memories.json`
- Modify: `tests/data.test.mjs`
- Modify: `tools/add-stop.mjs`

- [ ] **Step 1: Update `memories.json`**

Read current contents, remove the `rating` field from every entry. The current `memories.json` has one entry (`jonker-walk`); after edit it should look like:

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
    "media": [
      { "src": "media/jonker-walk/placeholder.svg", "type": "photo", "w": 800, "h": 600 }
    ]
  }
]
```

- [ ] **Step 2: Update `tests/data.test.mjs`**

Remove the rating assertion from the first test. Specifically delete the line:

```js
    assert.ok([1, 2, 3, 4, 5].includes(m.rating), `bad rating on ${m.id}: ${m.rating}`);
```

The rest of the test stays the same.

- [ ] **Step 3: Update `tools/add-stop.mjs`**

Remove all references to `rating`:
- Delete the `const rating = Number(flags.rating ?? await prompt(rl, "rating (1-5)", { ... }));` block.
- Remove `rating` from the `entry` object construction.
- Update the README mention in the help output (the trailing `console.log` block) is fine to leave; we'll update README in the final task.

The resulting `entry` construction becomes:

```js
const entry = { id, name, day, order, time, lat, lng, mapsUrl, media };
```

- [ ] **Step 4: Confirm tests pass**

Run: `node --test tests/*.mjs`
Expected: 20 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add memories.json tests/data.test.mjs tools/add-stop.mjs
git commit -m "refactor: drop rating field — ratings live in firestore now"
```

---

### Task 4: Update `lib/render.mjs` — emit star UI

**Files:**
- Modify: `lib/render.mjs`

- [ ] **Step 1: Remove the static `stars()` helper and rewrite the stop card**

Replace the contents of `lib/render.mjs` with:

```js
import { splitName } from "./name.mjs";

const DAY_LABELS = {
  1: { eyebrow: "DAY ONE",   date: "Friday, 22 May" },
  2: { eyebrow: "DAY TWO",   date: "Saturday, 23 May" },
  3: { eyebrow: "DAY THREE", date: "Sunday, 24 May" }
};

function ratingHTML(stopId) {
  const buttons = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star" data-id="${stopId}" data-star="${n}" aria-label="${n} star${n === 1 ? "" : "s"}">☆</button>`
  ).join("");
  return `
    <div class="rating">
      <div class="rating-stars" role="radiogroup" aria-label="Rate this stop">${buttons}</div>
      <div class="rating-avg" data-id="${stopId}">★ — · 0 ratings</div>
    </div>
  `;
}

function stopCardHTML(stop) {
  const { main, cn } = splitName(stop.name);
  return `
    <article class="stop" id="stop-${stop.id}">
      <div class="stop-dot" aria-hidden="true"></div>
      <div class="stop-head">
        <span class="stop-time">${stop.time}</span>
        ${ratingHTML(stop.id)}
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
  return stops;
}

// Update star + average rendering for a single stop. Called by app.js on every
// ratings tick. `summary` is { my, avg, count }; element lookup is by data-id.
export function applyRatingForStop(stopId, summary) {
  const root = document.getElementById(`stop-${stopId}`);
  if (!root) return;
  const my = summary.my || 0;
  const stars = root.querySelectorAll(`.star[data-id="${stopId}"]`);
  stars.forEach((btn) => {
    const n = Number(btn.dataset.star);
    btn.textContent = n <= my ? "★" : "☆";
    btn.classList.toggle("filled", n <= my);
  });
  const avgEl = root.querySelector(`.rating-avg[data-id="${stopId}"]`);
  if (avgEl) {
    if (summary.count === 0) {
      avgEl.textContent = `★ — · 0 ratings`;
    } else {
      const avg1 = summary.avg.toFixed(1);
      avgEl.textContent = `★ ${avg1} · ${summary.count} rating${summary.count === 1 ? "" : "s"}`;
    }
  }
}
```

- [ ] **Step 2: Confirm tests still pass**

Run: `node --test tests/*.mjs`
Expected: 20 pass / 0 fail.

- [ ] **Step 3: Commit**

```bash
git add lib/render.mjs
git commit -m "feat(render): emit interactive star UI + applyRatingForStop helper"
```

---

### Task 5: Wire ratings into `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace `app.js`**

Write to `app.js`:

```js
import { renderDays, applyRatingForStop } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";
import { mountMap } from "./lib/map.mjs";
import { subscribeAll, setRating } from "./lib/ratings.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

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

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      openLightbox(s.media, i, splitName(s.name).main);
    });
  }

  // Live ratings subscription
  subscribeAll((map) => {
    for (const stop of stops) {
      const summary = map.get(stop.id) || { my: null, avg: null, count: 0 };
      applyRatingForStop(stop.id, summary);
    }
  });

  // Delegated click handler for star buttons
  timeline.addEventListener("click", (e) => {
    const btn = e.target.closest(".star");
    if (!btn) return;
    const stopId = btn.dataset.id;
    const stars = Number(btn.dataset.star);
    setRating(stopId, stars).catch(err => {
      console.error("rating write failed:", err);
    });
  });
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});
```

- [ ] **Step 2: Confirm tests still pass**

Run: `node --test tests/*.mjs`
Expected: 20 pass / 0 fail.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(app): subscribe to live ratings, wire star clicks"
```

---

### Task 6: Star styling in `style.css`

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Replace the `.stop-stars` block**

The current `style.css` (rewritten in Task 14 of the memory-book plan) has a `.stop-stars { font-size: 13px; color: var(--gold); }` rule that is no longer used (we removed the `<span class="stop-stars">` from `lib/render.mjs`). Remove that rule and append the new rating styling.

Use Edit to delete:

```css
.stop-stars {
  font-size: 13px;
  color: var(--gold);
}
```

Then append the following at the end of `style.css`:

```css
/* ─── Rating ──────────────────────────────── */
.rating {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.rating-stars {
  display: inline-flex;
  gap: 2px;
}
.star {
  background: none;
  border: 0;
  padding: 0 2px;
  margin: 0;
  font-size: 18px;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
}
.star.filled { color: var(--gold); }
.star:hover ~ .star { color: var(--muted); } /* dim stars to the right of hover */
.rating-stars:hover .star { color: var(--gold); opacity: 0.6; }
.rating-stars:hover .star:hover ~ .star { color: var(--muted); opacity: 1; }
.rating-stars:hover .star:hover { opacity: 1; }
.rating-avg {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--muted);
}
```

- [ ] **Step 2: Confirm tests still pass**

Run: `node --test tests/*.mjs`
Expected: 20 pass / 0 fail.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style: add interactive star + average display"
```

---

### Task 7: Deploy the firestore rules

**Files:** none (deploys remote config)

- [ ] **Step 1: Verify firebase CLI is authenticated and pointed at the right project**

Run: `firebase projects:list 2>&1 | grep 21c844a6`
Expected: prints a row containing `project-21c844a6-e5cc-4a62-920`.

If the CLI is not logged in: report status `BLOCKED` with the message "user needs to run `firebase login` first". Do not try to run `firebase login` (it's an interactive browser flow).

- [ ] **Step 2: Deploy the rules**

Run:
```bash
firebase deploy --only firestore:rules --project project-21c844a6-e5cc-4a62-920
```
Expected: ends with "✔  Deploy complete!".

- [ ] **Step 3: Smoke test rules from the browser**

(Optional, can skip if Step 2 succeeded.) Run `python3 -m http.server 8000`, open `http://localhost:8000/`, tap a star on the placeholder Jonker Walk card, then open the Firebase console at https://console.firebase.google.com/project/project-21c844a6-e5cc-4a62-920/firestore — confirm the `ratings/jonker-walk` document exists with `by: { <uid>: <stars> }`.

If you can't run a browser test in your environment, skip this step — the rules are syntactically validated by `firebase deploy`.

- [ ] **Step 4: No commit needed**

This task touches only remote Firestore state, not git-tracked files. Report DONE without a SHA.

---

### Task 8: Update docs

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `README.md`**

Read the current `README.md`. Replace it entirely with:

````markdown
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
npm install                  # one-time; pulls in `sharp` (HEIC + dims) and `exifr` (EXIF reader)
brew install ffmpeg          # one-time; for video posters + dims
node tools/add-stop.mjs      # interactive prompts
# or with flags:
node tools/add-stop.mjs \
  --id jonker-walk \
  --name "Jonker Walk 鸡场街" \
  --day 1 --time 14:30 \
  --maps "https://maps.app.goo.gl/..." \
  --media ~/Downloads/jonker-photos/
```

The script reads EXIF from the first photo to auto-fill `time`, `day`, and
`lat/lng`. Flags override EXIF; prompts fall back to EXIF then to empty.
It copies media into `media/<id>/`, generates posters for videos, and upserts
the entry into `memories.json`. Always commit `memories.json` and
`media/<id>/` together.

## Ratings

Friends rate each stop 1–5 stars from the live site. Ratings live in
Firestore (collection `ratings`), keyed by an anonymous uid stored in each
browser's `localStorage`. The card shows the average + count.

To deploy security rule changes:

```bash
firebase deploy --only firestore:rules --project project-21c844a6-e5cc-4a62-920
```

## Deploy

`git push origin main` — GitHub Pages serves the result.
````

- [ ] **Step 2: Update `CLAUDE.md`**

Read the current `CLAUDE.md`. Replace it entirely with:

````markdown
# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

A single-page static site documenting a 3-day Melaka trip (22–24 May 2026).
**Memory book**: photos, videos, and **live friends-ratings** on a vertical
per-day timeline anchored by a sticky watercolor map. Single curator (Carson)
for content; multiple anonymous friends rate stops. Curation via the
`tools/add-stop.mjs` script; ratings via Firestore from the browser.

No bundler. Vanilla ES modules. Hosted on GitHub Pages — `git push origin main`
deploys the site. Firestore rules deploy separately via `firebase deploy`.

## Commands

```bash
python3 -m http.server 8000         # serve at http://localhost:8000/
node --test tests/*.mjs             # run all tests
node tools/add-stop.mjs [flags]     # add or update a stop (see README.md)
firebase deploy --only firestore:rules  # deploy rule changes
```

## Architecture

`memories.json` is the only runtime data file for stops. **Ratings** live in
Firestore, not in `memories.json`.

1. `app.js` fetches `memories.json`, calls `lib/render.mjs` to mount day
   sections, then subscribes to the Firestore `ratings` collection.
2. `lib/render.mjs` filters out stops with no media, groups by `day`, sorts by
   `order`, emits day headings + stop cards with a dot on a vertical red line.
   Each card has 5 clickable stars + an average display, updated by
   `applyRatingForStop(stopId, summary)` on every Firestore tick.
3. `lib/map.mjs` mounts a Leaflet map with numbered red pins + polyline.
4. `lib/gallery.mjs` decides each tile's grid span via `sizeFor()` (landscape →
   2 cols, portrait → 2 rows, else 1×1). Tapping a tile opens the lightbox.
5. `lib/lightbox.mjs` is a single global overlay; swipe / arrow keys / ESC.
6. `lib/name.mjs` exposes `splitName()` for bilingual names.
7. `lib/ratings.mjs` initializes Firebase (only in the browser — Node can't
   resolve the CDN imports), manages the anonymous uid, subscribes to the
   `ratings` collection, and writes via `setDoc(..., {merge:true})`.
8. `lib/ratings-summary.mjs` is the pure `summarize(byMap, myUid)` helper —
   isolated from the Firebase imports so Node can test it.

## Data shapes

### `memories.json` (per stop)

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
  "media": [
    { "src": "media/jonker-walk/01.jpg", "type": "photo", "w": 1600, "h": 1200 },
    { "src": "media/jonker-walk/02.mp4", "type": "video", "poster": "media/jonker-walk/02-thumb.jpg", "w": 1920, "h": 1080 }
  ]
}
```

There is **no `rating` field** — ratings live in Firestore.

### Firestore `ratings/{placeId}`

```
{ by: { "<uid-1>": 5, "<uid-2>": 4, ... } }
```

Doc id is the stop's `id` (matches `^[a-z0-9-]{1,40}$`). Values are integers
1..5. Max 100 raters per stop (enforced by rules).

## Conventions and gotchas

- **`memories.json` is hand-curated only via `add-stop.mjs`.**
- **Always commit `memories.json` + `media/<id>/` together.**
- **`lib/ratings.mjs` is browser-only.** It uses ESM CDN imports for the
  Firebase SDK; Node will throw on `node --test` if you try to import it.
  Pure rating logic lives in `lib/ratings-summary.mjs`.
- **Each browser has one uid.** Stored in `localStorage.melaka_uid`, never
  changes. Clearing it makes the user "new" again.
- **Rules deploy is a separate step.** After changing `firestore.rules`, run
  `firebase deploy --only firestore:rules`.
- **`splitName()` requires `<CJK> <Latin>` or `<Latin> <CJK>`** — mixed-middle
  strings fall back to `{ cn: null, main: original }`.
- **Map tiles** come from Stadia's Stamen Watercolor endpoint.
- **Videos commit to the repo.** Acceptable up to ~1 GB total.
- **Tests are the only gate** — no CI, no linter. Run `node --test tests/*.mjs`
  after any change to `memories.json`, `lib/`, or the tools.
````

- [ ] **Step 2: Final sanity check**

Run: `node --test tests/*.mjs`
Expected: 20 pass / 0 fail.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document ratings system in README and CLAUDE.md"
```

---

## After this plan

- Stops show 5 clickable stars + a live average + count.
- Friends opening the site can rate each stop; updates appear across all open browsers within a second.
- `memories.json` is rating-free; the script no longer asks for `--rating`.
- Firestore rules live in git and are deployed via `firebase deploy --only firestore:rules`.

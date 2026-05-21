# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page static site for a 3-day-2-night Melaka trip (22–24 May 2026). Vanilla ES modules — **no bundler, no package manager, no build step for the app itself**. Hosting is GitHub Pages; Firestore is used only for the public vote counts on each place. The PDF in the repo root is the original source the data was hand-curated from.

## Commands

```bash
# Serve locally (open http://localhost:8000/)
python3 -m http.server 8000

# Run tests (node:test, no test runner dep)
node --test tests/
node --test tests/hours.test.mjs                 # single file
node --test tests/ --test-name-pattern="closing"  # by name

# Regenerate places.json from places.raw.json (resolves maps short URLs → lat/lng)
node tools/build-places.mjs

# Refresh real Google drive times → lib/drives.json (optional; ~$4 of free credit)
GOOGLE_MAPS_API_KEY=AIza... node tools/precompute-drives.mjs

# Add a new place end-to-end (Places API search + photo download + JSON insert)
# Needs GOOGLE_PLACES_API_KEY in .env.local
node tools/add-place.mjs <id> "<query>" <section> <category> <mealType> <day> <order>

# Refresh photos for some/all places (writes images/{id}.jpg, updates places.json)
node tools/fetch-photos.mjs [id1 id2 ...]
```

There's no linter, formatter, or CI configured. Tests are the only automated gate; run them after any data or `lib/` change.

## Architecture

### Data flow

`places.raw.json` (hand-edited, no coords) → `tools/build-places.mjs` (resolves `maps.app.goo.gl` shortlinks) → **`places.json`** (single runtime source of truth, with `lat`/`lng` and `photo` filled in).

At load time `app.js`:
1. Fetches `places.json`.
2. Tries to fetch `lib/drives.json` and calls `setDriveTable()` — absence is fine, `driveMinutes()` falls back to a haversine heuristic in `lib/timeline.mjs`.
3. Subscribes to the Firestore `votes` collection for live vote counts.

Pure logic lives in `lib/` and is unit-tested in `tests/`:
- `lib/grouping.mjs` — `groupByDay`, `sortDaySchedule`, `getAlternatives`.
- `lib/timeline.mjs` — schedule construction with `DAY_START_MIN`, `MEAL_START_MIN` anchors, dwell times, and the haversine/Google-drive override.
- `lib/hours.mjs` — pragmatic free-text hours parser. Returns `{ parsed: false }` for messy strings; supports per-day chunks, midnight-wrap (`close > 1440`), `(Tue closed)` exclusions, and `until 5pm` shorthand. `checkVisit()` returns one of `open / closing-soon / closed-today / arrive-before-open / between-service / arrive-after-close / unknown`.

`app.js` (~1000 lines, single file) owns all rendering. Day-of-week is hard-coded for the trip dates in `TRIP_DAYS` (Fri/Sat/Sun = dow 5/6/7).

### Place schema

Validated in `tests/data.test.mjs`. Key fields and the valid values:
- `category` ∈ `food | entertainment | souvenir | airbnb`
- `section` ∈ `entertainment | zapbalang | jonker | airbnb` (original PDF groupings)
- `mealType` ∈ `breakfast | lunch | dinner | snack | dessert | late-night | drinks | souvenir | entertainment | stay | night-market`
- `day` ∈ `1 | 2 | 3 | null`, `order` is a number used to sort within a day
- Optional overrides: `dwellMin` (custom dwell), `minArriveMin` (hard "no earlier than" floor — e.g. Airbnb check-in)
- `committed: true` marks an entry as already booked/non-negotiable

### Committed vs. candidate slots (the voting model)

Within a day, each `mealType` is one **slot**. A place with `committed: true` gets its own timeline row and is **not part of the vote** (`computeLeaderId` and the day-view splitter both filter it out). Non-committed places compete inside their slot: sorted by vote count, then by open-on-trip-day (closed places sink), then by `order`. The top one is the featured "leader"; the rest render as contender thumbnails.

`applyVoteSnapshot` runs on every Firestore push. It **always** does a cheap button refresh, but only triggers a full re-render when a leader actually flips — `currentLeaders` (keyed `${day}:${meal}`) tracks the previous state so we don't blow away ~120 DOM nodes (and Leaflet maps) on every vote tick.

### Firestore + auth

No real auth. Each browser mints a UUID into `localStorage.melaka_uid` on first load. Writes go to `votes/{placeId}` with shape `{ voters: [uid, ...] }` (`arrayUnion` / `arrayRemove`). `firestore.rules` is the only safety net — it locks the doc id to `^[a-z0-9-]{1,40}$`, restricts the field set to `voters`, and caps the array at 50. **If you add a new place id, make sure it matches that regex** or writes will be silently rejected. The Firebase API key in `app.js` is a public web-SDK identifier; do not treat it as a secret.

### Drive times

Two-tier system. `driveMinutes(a, b)` first looks up the pair in the override table built from `lib/drives.json` (real Google Routes API durations for `${fromId}__${toId}`). Falls back to a haversine heuristic: `<15 km` uses a Melaka-city formula (~17 km/h equivalent with parking buffer), longer assumes highway. The precompute script splits the 29×29 matrix into two batches (Routes API caps at 625 elements per request) and uses `TRAFFIC_AWARE` with `departureTime: 2026-05-22T08:00:00+08:00` — rerun closer to the trip for fresher predictions.

## Conventions and gotchas

- **Always edit `places.raw.json`, not `places.json` directly.** Re-run `node tools/build-places.mjs` to refill coordinates from the maps shortlinks. `places.json` is treated as generated.
- After data edits, run `node --test tests/` — `data.test.mjs` catches bad `category` / `section` / `mealType` values, missing GPS, duplicate ids, and ensures days 1–2 each have a dinner.
- `node tools/precompute-drives.mjs` is **idempotent** (only writes if the table differs) and pulls coords from `places.json`, so run it *after* `build-places.mjs` whenever you add or move a place.
- Bilingual names: `splitName()` expects `<CJK> <Latin>` or `<Latin> <CJK>` — the leading/trailing CJK run becomes `cn`, the rest becomes `main`. Mixed-script middles defeat the split and fall back to the original.
- Times throughout `lib/` are **minutes from midnight**. Intervals spanning midnight have `close > 1440` (e.g. `5pm–2am` → `close = 1560`); call sites must handle that.
- Meals are anchored: a `breakfast` stop will never start before 10:00 even if the day starts earlier (a "wait" appears in the schedule). See `MEAL_START_MIN` in `lib/timeline.mjs`.
- `lib/drives.json` is generated. Don't hand-edit it.
- `firebase.json` only references `firestore.rules` — there is no `hosting` config and Firebase Hosting is not used. Deploy is "push to `main` → GitHub Pages".

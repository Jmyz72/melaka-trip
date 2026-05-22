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

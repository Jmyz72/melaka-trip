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

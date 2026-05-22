# Memory Book — Design Spec

**Date:** 2026-05-23 · **Trip:** Melaka, 22–24 May 2026 · **Curator:** Carson (single editor)

## Goal

Transform the existing Melaka trip planner site (`https://jmyz72.github.io/melaka-trip/`) into a **memorable, warm, photo-led keepsake** of the trip. The planner is retired; the new site shows what actually happened — stops, photos, videos, ratings — on a vertical timeline anchored by a map of the route.

## Out of scope (explicit non-goals)

- **No voting** — Firestore, contender lists, leader computation all removed.
- **No schedule logic** — drive times, hours, dwell, meal anchors all removed.
- **No upload UI / multi-user / auth** — single curator; data added via local script.
- **No "skipped" state** — every entry in the data is a stop you visited. Nothing else is rendered.
- **No personal notes / captions** — content is photos + verdict (rating) only.
- **No new stops via UI** — all stops added via the script; the site is read-only at runtime.
- **No backwards compatibility** with the planner data shape. The old `places.json`, `places.raw.json`, `lib/drives.json`, etc. are deleted, not migrated.

## User experience

### Layout (top to bottom)

1. **Header.** Title "Melaka", subtitle "22–24 May 2026", small "MEMORIES" eyebrow label. Cream background.
2. **Map.** Sticky to the top of the viewport as the user scrolls (full height when at top, shrinks to ~80 px strip when scrolled past). Numbered red pins for every stop, polyline connecting them in visit order. Click a pin → smooth-scroll to that stop card.
3. **Day sections.** "DAY ONE · Friday, 22 May" / "DAY TWO · Saturday, 23 May" / "DAY THREE · Sunday, 24 May". Large serif heading per day.
4. **Stop cards within each day** — see below. A vertical red line runs down the left of each day's stops; each stop has a filled red ringed dot on the line. **Line resets per day** (independent line per day section).
5. **Lightbox overlay** — hidden by default. Opens when any media tile is tapped; full-screen, swipe left/right through every photo & video at that stop, ESC or × to close.

### Stop card

```
●  14:30                                    ★★★★☆
   Jonker Walk
   鸡场街
   ┌──────────┬─────┬─────┐
   │          │     │  ▶  │     ← varied photo+video grid
   │          ├─────┴─────┤
   │          │           │
   ├─────┬────┴─────┬─────┤
   │     │          │     │
   └─────┴──────────┴─────┘
   Open in Maps ↗
```

Components, in order:
- **Dot on the timeline line** (left side).
- **Time** (HH:MM, sans-serif, small, top-left) and **stars** (1–5 amber, top-right).
- **Name (English)** — serif, prominent.
- **Name (中文)** — italic, muted, smaller. If a name has no Chinese, this row is omitted.
- **Varied media grid** — see "Media grid rules" below.
- **"Open in Maps ↗"** — small link, opens `mapsUrl` in a new tab.

### Media grid rules

A CSS grid: 4 columns, square auto-rows. Each item occupies cells based on its aspect ratio:
- `w / h > 1.4` (landscape) → `grid-column: span 2`
- `h / w > 1.4` (portrait) → `grid-row: span 2`
- Otherwise → `1 × 1`
- Videos render their poster thumbnail with a `▶` overlay.

Every item is rendered (nothing hidden, no "+N more"). Tapping any item opens the lightbox.

### Lightbox

- Full-screen, dark background.
- Shows one item at a time, full-bleed.
- Swipe (touch) or `‹`/`›` buttons to navigate; `ESC` or `×` to close.
- Counter ("5 / 15") and stop name at the top.
- Videos play with native browser controls.
- Progress strip at the bottom shows position in the gallery.

### Stops without media

Stops with zero media items are **not rendered**. The data may contain them as placeholders during curation, but the renderer filters them out so the timeline only shows finished entries.

## Visual design

| Token | Value | Use |
|---|---|---|
| `--bg` | `#e8dcc4` | Page background (warm cream) |
| `--ink` | `#3a2a18` | Body text, headings |
| `--accent` | `#b91c1c` | Timeline line, dots, day labels, map pins |
| `--gold` | `#e8a838` | Star ratings |
| `--muted` | `#7a6346` | Meta (Chinese names italic, "Open in Maps") |
| `--rule` | `#d4c4a0` | Hairlines between sections |

**Type** (loaded from Google Fonts via `<link>` in `index.html`):
- **Cormorant Garamond** — serif, used for stop names, day headings, site title.
- **Inter** — sans-serif, used for time, stars, eyebrow labels, "Open in Maps" link.
- CJK fallback chain: `PingFang SC, "Noto Sans SC", system-ui, sans-serif`.

**Map tiles:** Stadia "Stamen Watercolor" (warm-toned, matches the cream palette). Fallback if API-key gating becomes a problem: OSM default tiles with `filter: sepia(0.3) saturate(0.8)` overlay.

**Header decoration:** small Peranakan-tile-inspired color strip — six colored squares (red / amber / teal, alternating) below the date. Purely decorative.

## Data model

Single file: **`memories.json`** (replaces `places.json`).

```json
[
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
]
```

### Field rules

| Field | Type | Rule |
|---|---|---|
| `id` | string | `^[a-z0-9-]{1,40}$`, unique across the file |
| `name` | string | Bilingual: `<EN> <CJK>` or `<CJK> <EN>`. The renderer splits via `splitName()`. |
| `day` | int | `1`, `2`, or `3` |
| `order` | int | Used to sort within a day. If not provided to `add-stop.mjs`, the script auto-assigns `max(existing order for that day) + 1`. |
| `time` | string | `HH:MM` (24-hour) |
| `lat`, `lng` | number | Required |
| `mapsUrl` | string | Required (used for "Open in Maps" link) |
| `rating` | int | `1`–`5` |
| `media` | array | May be empty during curation; empty stops are not rendered. |
| `media[].src` | string | Path relative to repo root, must start with `media/<id>/` |
| `media[].type` | string | `"photo"` or `"video"` |
| `media[].w`, `.h` | int | Pixel dimensions, used by grid sizing |
| `media[].poster` | string | Required when `type === "video"`; path to generated thumbnail |

## Folder layout

```
melaka-trip/
├── index.html              ← rewritten, much smaller
├── app.js                  ← rewritten, ~300 lines
├── style.css               ← rewritten, ~500 lines
├── memories.json           ← NEW, the only data file
├── media/                  ← NEW
│   └── <stop-id>/
│       ├── 01.jpg
│       ├── 02.jpg
│       ├── 03.mp4
│       └── 03-thumb.jpg
├── lib/
│   ├── name.mjs            ← splitName() bilingual helper (kept)
│   ├── map.mjs             ← NEW: Leaflet setup, pins, sticky-shrink
│   ├── gallery.mjs         ← NEW: varied grid layout rules
│   ├── lightbox.mjs        ← NEW: fullscreen swipe gallery
│   └── render.mjs          ← NEW: day section + stop card markup
├── tools/
│   ├── add-stop.mjs        ← NEW: the curation script
│   └── fetch-photos.mjs    ← REMOVED
├── tests/
│   ├── data.test.mjs       ← rewritten for memories.json shape
│   ├── name.test.mjs       ← bilingual split tests (renamed from existing)
│   └── gallery.test.mjs    ← NEW: wide/tall/square decisions
└── README.md               ← rewritten
```

### Files deleted

- `lib/timeline.mjs`, `lib/hours.mjs`, `lib/now.mjs`, `lib/grouping.mjs`, `lib/drives.json`
- `tools/build-places.mjs`, `tools/add-place.mjs`, `tools/precompute-drives.mjs`, `tools/fetch-photos.mjs`
- `tests/timeline.test.mjs`, `tests/hours.test.mjs`, `tests/now.test.mjs`, `tests/grouping.test.mjs`
- `places.json`, `places.raw.json`
- `images/` directory (contents migrated into `media/<id>/01.jpg` by the script's first run, or just deleted if regenerating from new photos)
- `firebase.json`, `firestore.rules`, `.firebaserc` (no more Firestore)

## The `add-stop.mjs` script

**Invocation:**

```bash
node tools/add-stop.mjs \
  --id jonker-walk \
  --name "Jonker Walk 鸡场街" \
  --day 1 --time 14:30 --order 3 \
  --rating 4 \
  --maps "https://maps.app.goo.gl/..." \
  --media ~/Downloads/jonker-photos/
```

Any missing flag triggers an interactive prompt (`readline`). For convenience, `--maps` accepts either a short Google Maps URL (resolved to lat/lng via HTTP `HEAD` redirect, same logic as the deleted `build-places.mjs`) or a literal `lat,lng` pair.

**Behavior:**

1. Validate inputs against the schema rules above. Fail with a clear message if invalid.
2. Resolve `mapsUrl` → `lat`, `lng` if a short URL was given (HTTP `HEAD` follows the redirect, parse `!3d<lat>!4d<lng>` out of the resolved URL).
3. `mkdir -p media/<id>/` (idempotent).
4. For each file in `--media` (sorted by filename):
   - Photos (`.jpg`, `.jpeg`, `.png`, `.heic`): copy & rename to `media/<id>/NN.jpg`. Convert HEIC → JPEG via `sharp` if HEIC is present; otherwise no transform. Read `w`/`h`.
   - Videos (`.mp4`, `.mov`): copy & rename to `media/<id>/NN.mp4`. Generate a poster via `ffmpeg -ss 1 -i ... -vframes 1 NN-thumb.jpg`. Read `w`/`h` via `ffprobe`.
5. Build the entry object and **upsert** into `memories.json` (replace if `id` exists, append otherwise). Sort the file by `(day, order)`.
6. Run `node --test tests/data.test.mjs`. If it fails, print the error and roll back the `memories.json` write (the media files stay — they're harmless on disk).

**Dependencies:**
- `sharp` (already not in repo — add as the only `npm` dep, in a new `package.json`. The earlier "no package manager" stance is relaxed here because the curation script is dev-time only, not runtime).
- `ffmpeg` / `ffprobe` (system binaries — `brew install ffmpeg`).

## Module responsibilities

- **`app.js`** — entry point. Fetches `memories.json`, calls `render.mjs` to mount the page.
- **`lib/name.mjs`** — `splitName(raw)` → `{ main, cn }`. Lifted as-is from the current `app.js` (with its existing test cases).
- **`lib/map.mjs`** — `mountMap(container, stops, { onPinClick })`. Builds the Leaflet map, adds numbered red pins per stop, draws the polyline, wires the click handler. Exports a `setSticky(scrollY)` method called from a window scroll listener that shrinks the map height when scrolled past.
- **`lib/gallery.mjs`** — `sizeFor(media)` → `{ colSpan, rowSpan }` pure function. Renders the grid container, attaches click handlers that open the lightbox.
- **`lib/lightbox.mjs`** — `open(mediaList, startIndex)`. Manages a single global overlay element. Touch swipe + keyboard navigation + close.
- **`lib/render.mjs`** — `renderDays(memories, container)`. Groups by `day`, sorts by `order`, filters out empty-media stops, renders each day section with the timeline line and stop cards.

## Testing

`node --test tests/` remains the only gate. Three test files:

- **`tests/data.test.mjs`** — for every entry in `memories.json`: id matches regex, no duplicates; day ∈ {1,2,3}; time matches `^[0-2]\d:[0-5]\d$`; lat/lng present and numeric; rating ∈ 1..5; every media path resolves to an existing file on disk; every video has a `poster` file on disk.
- **`tests/name.test.mjs`** — `splitName()` covers EN-only, CJK-only, EN+CJK, CJK+EN, mixed-middle (falls back), empty input.
- **`tests/gallery.test.mjs`** — `sizeFor()` returns `span 2 / 1` for landscape, `1 / span 2` for portrait, `1 / 1` for near-square, and tolerates missing dimensions (default `1/1`).

CI is not configured; tests are run by hand and by `add-stop.mjs` after each insert.

## Deploy

Unchanged. `git push origin main` → GitHub Pages serves `https://jmyz72.github.io/melaka-trip/`. The auto-deploy preference in user memory still applies — each meaningful change is committed and pushed.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Repo size bloat from videos | At ~30 videos × 5–20 MB each ≈ 150–600 MB, acceptable for GitHub Pages (1 GB soft, 100 GB bandwidth/month). Revisit (Cloudflare R2 or GitHub Releases) only if we exceed 1 GB. |
| HEIC photos from iPhone | `sharp` converts to JPEG during `add-stop.mjs`. If `sharp` install fails on the user's Mac, the script prints a clear error and instructs to AirDrop as JPEG instead. |
| Stadia map tiles requiring API key | If unauthenticated requests get rate-limited, fall back to OSM default tiles with a CSS `filter: sepia(0.3) saturate(0.8)` overlay to keep the warm tone. Decided at implementation time. |
| Browser autoplay restrictions on videos | Videos in the grid are static posters only. Lightbox uses `<video controls>` and requires a user gesture (the swipe-in already counts as one). |
| Curator forgets to commit `media/<id>/` after running the script | `add-stop.mjs` prints a reminder at the end with the exact `git add` / `git commit` commands to run. |

## Open questions

None at design time. Implementation-time decisions (e.g., exact font weights, whether to add a Peranakan tile SVG accent or just colored rectangles, Stadia vs OSM map tiles) are surface-level and can be made during the build without revisiting this spec.

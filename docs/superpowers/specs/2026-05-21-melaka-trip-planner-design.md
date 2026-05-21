# Melaka 3D2N Trip Planner — Design

## Purpose

A single static HTML page that turns the user's Google Sheet of 28 Melaka places (food, entertainment, souvenirs) into a usable mobile trip planner: an interactive map of every place plus an auto-suggested day-by-day itinerary for a 3-day-2-night trip.

Primary device: phone, used during the trip in Melaka.
Hosting: GitHub Pages.

## Source data

`Melaka 3 days 2 nights - Sheet2.pdf` in the project root. Columns per row:

- Place name (mix of English + Chinese, e.g. `Baba Kaya （早餐）`)
- Address / Google Maps short link (`https://maps.app.goo.gl/...`)
- Duration from Airbnb (e.g. `9 min`)
- Operation hours
- Remarks (e.g. `Reservation Needed`, `must try - mixberry`)

Original groupings in the sheet: **Airbnb**, **Entertainment**, **Zapbalang** (general food), **Jonker Street** (food on/near Jonker).

The sheet contains 1 Airbnb + 3 entertainment + ~16 Zapbalang food + ~8 Jonker Street food = ~28 places.

## Page structure (mobile-first)

Single `index.html` with a sticky top tab bar:

```
┌─────────────────────────────────┐
│  Melaka 3D2N                    │
├─────────────────────────────────┤
│ [🗺 Map][Day 1][Day 2][Day 3][All] │
├─────────────────────────────────┤
│   (active view fills screen)    │
└─────────────────────────────────┘
```

### Views

- **Map view** (default): full-screen Leaflet map. All pins shown, color-coded by assigned day. Tap a pin → bottom sheet with details. Initial viewport auto-fits all pins.
- **Day 1 / Day 2 / Day 3 views**: vertical scroll of cards in chronological order (morning → night). Each card shows: name, time slot label (breakfast / lunch / dinner / snack / late-night / entertainment / souvenir), opening hours, drive time from Airbnb, remarks, "Open in Google Maps" button. If multiple places compete for the same slot, the picked one is shown and an "alternatives" toggle reveals the others.
- **All view**: every place as a card, filterable by category (food / entertainment / souvenir / airbnb).

### Bottom sheet (map pin tap)

Slides up from bottom. Shows: name, time slot, hours, drive time from Airbnb, remarks, "Open in Google Maps" button (uses the original `goo.gl` link so it opens the native Maps app on phone). Dismiss by tapping outside or swiping down.

## Data model

`places.json` is the single source of truth, generated once from the PDF:

```json
{
  "id": "baba-kaya",
  "name": "Baba Kaya",
  "nameZh": "",
  "category": "food",
  "section": "zapbalang",
  "mealType": "breakfast",
  "address": "",
  "mapsUrl": "https://maps.app.goo.gl/rvAKxdxUYwFZW9MN6",
  "lat": 2.2000,
  "lng": 102.2500,
  "durationFromAirbnbMin": 9,
  "hours": "Fri 8am-2:30pm; Sat-Sun 7:30am-2:30pm",
  "remarks": "",
  "day": 2,
  "order": 1
}
```

Fields:
- `category`: `food` | `entertainment` | `souvenir` | `airbnb`
- `section`: `entertainment` | `zapbalang` | `jonker` | `airbnb` (preserves original sheet grouping for the All view filter)
- `mealType`: `breakfast` | `lunch` | `dinner` | `snack` | `dessert` | `late-night` | `drinks` | `souvenir` | `entertainment` | `stay`
- `day`: `1` | `2` | `3` | `null` (null = unassigned, shown only in All view)
- `order`: integer used to sort cards within a day's view (lower = earlier)

## Itinerary auto-assignment

Day assignment is done **once** during data preparation, not at runtime. Logic:

- **Day 1** (check-in 3pm, so afternoon + evening only): light snack/dessert → Mocity Cosmic Park (entertainment, open till late) → dinner → 宵夜 (late-night)
- **Day 2** (full day): breakfast → mid-morning activity or souvenir pickup → lunch → snack/dessert → dinner → 宵夜
- **Day 3** (checkout 11am, so morning only): breakfast → 手信 souvenir pickup → leave by 11am (no lunch — too tight)

Mapping from Chinese remarks to `mealType`:
- `早餐` → `breakfast`
- `午餐` → `lunch`
- `晚餐` → `dinner`
- `宵夜` → `late-night`
- `手信` → `souvenir`
- `玩` → `entertainment`
- bakeries / `蛋糕` / `waffle` / `croissant` / `mochi` → `dessert`
- drinks / `chill drinks` → `drinks`

Conflicts (e.g. 4 dinner candidates for 2 dinner slots): pick one for the day, leave the rest as alternatives within that day's slot. The user can swap during the trip by reading the alternatives.

## Map

- **Library**: Leaflet (no API key, ~40KB minified)
- **Tiles**: OpenStreetMap default tiles
- **Markers**: colored circular markers — red (Day 1), blue (Day 2), green (Day 3), gold star (Airbnb), grey (unassigned)
- **Bottom sheet on pin tap**: CSS transform sliding panel; tapping outside dismisses
- **"Open in Google Maps"**: anchor with the original `mapsUrl`. On mobile this opens the Google Maps app via universal link.

## Build step (one-time, done by assistant, not at page load)

Tooling: a small Node script `tools/build-places.mjs`.

1. Read the PDF source data (already captured in this design discussion). Hand-curate a `places.raw.json` with name, mapsUrl, durationFromAirbnbMin, hours, remarks, and inferred mealType/day/order.
2. For each `mapsUrl`, resolve the `goo.gl` short link via HTTP HEAD (follow redirects) to extract `lat,lng` from the resolved URL's `!3d<lat>!4d<lng>` or `@lat,lng` segment.
3. Write the final `places.json` to the project root.

This script runs once. If a link fails to resolve, the script writes `lat: null, lng: null` and prints a warning so the user can paste the coordinates manually.

## Tech stack

- Plain HTML + CSS + vanilla JS — no framework, no bundler.
- Leaflet via CDN `<script>` tag.
- No localStorage, no service worker, no PWA. Page works offline only if cached by the browser; map tiles need internet.

## File layout

```
melaka-trip/
  index.html
  app.js               # tab switching, render cards, render map, bottom sheet
  style.css            # mobile-first; one breakpoint for ≥768px
  places.json          # generated; the data the page reads
  tools/
    build-places.mjs   # one-time link resolver + tagger
  docs/
    superpowers/specs/2026-05-21-melaka-trip-planner-design.md
  README.md            # how to regenerate places.json + deploy
  Melaka 3 days 2 nights - Sheet2.pdf  # source, kept for reference
```

## Visual design

- Mobile-first, single column on phone; on `min-width: 768px` the day views render as a 2-column grid.
- Typography: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`) for fast load and native feel.
- Colors: neutral background, accent color per day matching the map pin colors (red / blue / green) so a card and its pin are visually linked.
- Tabs are large tap targets (min 44px).

## Deploy

1. `git init` in `melaka-trip/`.
2. Commit everything.
3. User creates a GitHub repo named `melaka-trip` (assistant provides exact commands).
4. Push.
5. Enable GitHub Pages (Settings → Pages → Source: `main` branch, root).
6. URL: `https://<your-username>.github.io/melaka-trip/`.

## Out of scope

- Editing the itinerary in the browser (no drag-and-drop, no localStorage). To change which place is on which day, edit `places.json` and redeploy.
- Translating Chinese remarks to English — kept as-is per user preference.
- Booking integration, calendar export, sharing flow, offline tiles, search.
- Pulling live data from the Google Sheet. The PDF snapshot is treated as fixed input.

## Success criteria

- Page loads on a phone in < 2 seconds on 4G.
- All ~28 places appear as pins on the map view.
- Each Day view shows a coherent morning-to-night sequence with no time conflicts.
- Tapping "Open in Google Maps" on any place opens the Google Maps app on iOS/Android with the correct destination.
- The page is reachable at a public GitHub Pages URL.

# Two-tab restructure: Overview + Three Days

**Date:** 2026-05-23
**Status:** Approved
**Author:** Carson Hew (curator), with Claude

## Goal

Split the current single-page Melaka memory book into two tabs:

- **Three Days** (default) — the existing cinematic scroll-through of every
  stop, completely unchanged in behaviour. Postcard hero → Day 1 → Day 2 →
  Day 3 → closing seal.
- **Overview** (new) — a bird's-eye view: a large map at the top, then a
  scrollable list of every place grouped by day. Tapping a list row hints
  the corresponding pin on the same map.

The floating bottom-left map button on Three Days is removed; the Overview
tab now owns map duties.

No content, ratings, photos, or memories.json data change.

## Why now

The cinematic scroll is good for visiting the trip, but bad for "where did
we go again?". A dedicated map + list answers that without disrupting the
postcard experience.

## Navigation

A sticky top bar with two labels: `Overview · Three Days`.

- Active tab gets a vermillion underline (reuse the existing brush-rule
  stroke aesthetic — a short SVG path animating in).
- Typography matches the rest of the site: mono caps for the labels, ~10px
  with letter-spacing 0.32em.
- Bar background: cream paper with `rgba(244, 234, 213, 0.92)` and a 6 px
  backdrop-filter blur so the WebGL fluid still bleeds through faintly.
- Bar height ~52 px; stays above the content via `position: fixed; top: 0;
  z-index: 70` (above the side-timeline rail at 55, below the lightbox
  at 1000).
- The existing audio toggle sits at `top: 20px; right: 20px`, which puts
  it inside the nav bar's footprint. Move the audio toggle to the right
  end of the nav bar itself so it visually belongs to the chrome rather
  than overlapping it. (One line of CSS positioning, no JS changes.)

Tab state syncs to the URL hash:

- `#days` (or no hash) → Three Days
- `#overview` → Overview

Hash changes push history entries so browser back/forward work. Clicking a
tab updates the hash; the hashchange listener swaps the visible section.

## Layouts

### Three Days tab — near-zero changes

The current `<main id="scroll" class="scroll">` and all its children
(cover, day-interstitial, stop, closing) stay exactly as today. Side
timeline rail, Firestore ratings, WebGL fluid, splash particles — all
unchanged.

Two small changes are unavoidable:

1. The floating `#map-toggle` button (bottom-left circular icon) and the
   `#map-overlay` element are deleted. Map duties move to the Overview
   tab.
2. `cover3D.pause()` is called when the tab switches away from Three
   Days, and `resume()` when it comes back. This is in addition to the
   existing scroll-out pause logic; both can fire independently and the
   3D module's pause is already idempotent.

### Overview tab — new

Two stacked regions inside a `<section id="overview" class="overview">`:

1. **Map region** — top ~55 vh on desktop, 40 vh on phone.
   - Full-width Leaflet map using the existing CartoDB Voyager tiles + the
     softened `.map` CSS filter from the previous map fix.
     (sepia 0.15, no hue-rotate.)
   - Five numbered pins + the red dashed polyline, identical to the
     current `lib/map.mjs` output.
   - Tooltips on hover/tap (also reused from the existing map fix).
   - Same Leaflet instance is mounted once on first tab activation and
     kept warm across tab switches (don't re-mount every visit).
2. **List region** — fills the remainder below the map.
   - Heading per day, brush-numeral style (`一 Day One`, `二 Day Two`,
     `三 Day Three`). Same typographic treatment as the day-interstitial
     section, but at smaller scale (~28 px brush numeral, ~9 px mono
     subtitle).
   - One row per stop:
     ```
     [01]   13:35   Jinbo Dim Sum 珍宝点心       →
     ```
     - Number badge (vermillion circle, mono number, 22 px).
     - Mono time, 10 px, indigo-faint.
     - Bilingual name: italic EB Garamond for the Latin part, brush font
       for CJK (`splitName()` from `lib/name.mjs`).
     - Right-edge arrow `→` that fades in on hover.
   - Row hover: light cream tint + the row's pin on the map gets the
     active-tooltip treatment.
   - Row tap (click): smooth-pan the map to the pin's lat/lng at zoom 15,
     then open the pin's tooltip. No tab switch.
   - List scrolls independently of the map (map stays sticky at top of
     viewport while list scrolls underneath).

### Bidirectional sync

- **List row → map pin** (on click): `map.flyTo([lat, lng], 15, { duration: 0.6 })`, then `marker.openTooltip()`. The clicked row gets a
  `.is-active` highlight that persists for ~2 s, then fades.
- **Map pin → list row** (on hover on desktop, on tap on touch): the
  corresponding list row gets the same `.is-active` highlight. If the
  row is off-screen in the list pane, `scrollIntoView({ block: "nearest" })`.

Active highlight: thin vermillion left-border + faint vermillion background
tint on the row.

## File-level impact

### New files

- **`lib/tabs.mjs`** (~80 lines)
  - `mountTabs(navEl, sectionMap, defaultTab)` — accepts the nav element,
    a map of `{ tabName: sectionEl }`, and a default tab name.
  - Reads `location.hash` on load, shows the matching section and marks
    the matching nav link active. Unknown/empty hash falls back to
    default.
  - Click handlers on nav links: prevent default, `history.pushState`
    new hash, swap section, fire a `tabchange` custom event so other
    modules (e.g. Overview) can lazy-init.
  - `popstate` and `hashchange` listeners for browser nav.

- **`lib/overview.mjs`** (~120 lines)
  - `mountOverview(rootEl, stops)` — builds the map + list DOM into
    `rootEl`. Lazy-init the Leaflet map on first activation (listen for
    the `tabchange` event from tabs.mjs).
  - Reuses `mountMap()` from `lib/map.mjs` for the Leaflet instance.
  - Wires bidirectional sync between list rows and Leaflet markers.
  - Returns `{ activate(), destroy() }` so the tab system can call
    `activate()` to ensure `invalidateSize()` is called when the tab
    becomes visible (Leaflet needs this when its container was hidden).

### Modified files

- **`index.html`**
  - Add `<nav id="tab-nav" class="tab-nav">` above `<main>` with two
    links: `<a href="#days">Three Days</a>` and
    `<a href="#overview">Overview</a>`.
  - Wrap the existing `<main id="scroll">` content unchanged inside
    `<section id="three-days" class="tab-section">` (or attach the
    `tab-section` class directly to `<main>` — implementation choice
    during writing-plans).
  - Add `<section id="overview" class="tab-section" hidden>` after.
  - **Delete** `<button id="map-toggle">` and `<div id="map-overlay">`
    along with their inline SVG icon.

- **`app.js`**
  - Import `mountTabs`, `mountOverview`.
  - Wire up `mountTabs` with the two sections.
  - Wire up `mountOverview` with the stops list.
  - Delete the entire "Layer 5: Map overlay" block (map-toggle,
    map-overlay, mapClose, ensureMap, all click handlers).
  - `cover3D.pause()` / `resume()` driven by which tab is active in
    addition to the existing scroll-out logic — pause when not on Three
    Days. (One-line addition to the `tabchange` handler.)

- **`style.css`**
  - New rules for `.tab-nav` (sticky bar, mono caps, vermillion underline
    on active).
  - New rules for `.tab-section` (full-viewport stacked containers,
    `display: none` when not active).
  - New rules for `.overview`, `.overview-map`, `.overview-list`,
    `.overview-row`, `.overview-row.is-active`.
  - Delete the `.map-toggle` and `.map-overlay` rules.

### Unchanged files

- `memories.json` — same data, same shape.
- `lib/render.mjs`, `lib/gallery.mjs`, `lib/lightbox.mjs`,
  `lib/name.mjs`, `lib/ratings.mjs`, `lib/ratings-summary.mjs`,
  `lib/cover-3d.mjs`, `lib/fluid-bg.mjs`, `lib/transitions.mjs`,
  `lib/rating-splash.mjs`, `lib/side-timeline.mjs`.
- `lib/map.mjs` — reused as-is for Overview's Leaflet instance.
- `firestore.rules` — no changes.
- `tools/add-stop.mjs` — no changes.

## Data flow

```
                 hash change / link click
                          │
                          ▼
                  ┌──────────────┐
                  │  lib/tabs    │
                  │  - readHash  │
                  │  - showTab   │  emits 'tabchange'
                  │  - pushState │      │
                  └──────────────┘      │
                          │             │
                          ▼             ▼
                ┌────────────────┐  ┌─────────────────┐
                │ #three-days    │  │ #overview       │
                │ (untouched)    │  │ - lazy mountMap │
                │                │  │ - row↔pin sync  │
                └────────────────┘  └─────────────────┘
                                            │
                                            ▼
                                    Firestore (read-only)
                                    via existing subscribeAll;
                                    Overview doesn't write
```

`memories.json` is loaded once in `app.js` (already the case) and the
resulting `stops` array is passed to both `renderDays()` (Three Days)
and `mountOverview()` (Overview). Both views read from the same source.

## Default behaviour & edge cases

- **First visit** (no hash): show Three Days, do not push a history
  entry. URL stays clean.
- **Direct link to `#overview`**: Overview mounts immediately. The
  Three Days section stays hidden but already-rendered (so the cover-3d
  scene initialises eagerly — minor wasted work on first paint; can
  defer if it becomes a real cost).
- **Tab switch while audio is playing**: audio keeps playing. Toggle
  button stays in place on both tabs.
- **Tab switch while a stop's lightbox is open**: lightbox closes via
  ESC on tab change (call `closeLightbox()` from the tabchange handler).
- **Reduced motion**: tab swap is instant (no animation); list row
  click pans the map without `flyTo` easing (`setView` instead).
- **Mobile**: top nav stays compact — two pill-shaped links centered
  in the bar. Hamburger not needed for two items. Overview's map
  region drops to 40 vh; list takes the remainder.

## Testing

Existing tests (20 currently passing) all keep passing — none touch
DOM/tab routing, all are pure-logic tests of `name.mjs`, `gallery.mjs`,
`ratings-summary.mjs`, and the `add-stop` tooling.

Manual verification checklist:

- Land on `/` → Three Days visible, postcard hero rendering, side rail
  appears on scroll.
- Tap "Overview" → URL becomes `#overview`, map and list visible.
- Tap a list row → map flies to that pin, tooltip opens, row highlights.
- Hover a pin (desktop) → corresponding row highlights.
- Tap "Three Days" → URL becomes `#days`, postcard hero back.
- Browser back → returns to Overview (history entries respected).
- Refresh on `#overview` → Overview shown directly.
- Mobile (390 px): nav fits, map is 40 vh, list scrolls under it,
  rows tappable.
- Audio toggle works on both tabs.

## Out of scope

- No deep-linking to individual stops (e.g. `#overview/jinbo-dim-sum`).
- No animations between tabs beyond an opacity fade.
- No persistence of "last visited tab" across sessions (always default
  to Three Days on first paint).
- No changes to the photo galleries, ratings, lightbox, or audio.
- No new tab beyond Overview + Three Days (the trip-only structure was
  reduced from the original four-tab proposal at the user's request).

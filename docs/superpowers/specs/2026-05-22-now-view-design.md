# "Now" view — design

**Date:** 2026-05-22
**Status:** Approved, ready for implementation plan
**Author:** Carson Hew + Claude

## Problem

The Melaka trip planner currently presents a fixed plan (Day 1 / 2 / 3 schedules + Atlas & Index of all 29 places). During the trip itself, the group needs to translate that plan against the real clock and their real location: *"It's 6:40pm and we're near Jonker — what's open and worth doing right now?"* The static views don't answer that directly.

## Goal

Add a dedicated **Now** tab that, given the current time and the user's GPS location, surfaces the single best place to go next plus a short ranked list of alternatives, drawn from the full pool of 29 places (any day, not just today's plan).

## Non-goals

- **No re-flowing of the Day 1/2/3 schedules.** Those views remain static plans.
- **No walking-vs-driving mode toggle.** "Distance" is a single closeness signal.
- **No multi-stop trip re-planning.** Just "what's the best next single stop."
- **No new data source.** Reuses the existing `places.json`, hours parser, drive heuristics, and Firestore votes.

## User experience

### Navigation

A sixth tab is added to the masthead nav in `index.html`:

```
I. Atlas & Index | II. Itinerary | III. Day One | IV. Day Two | V. Day Three | VI. Now
```

The page is its own `<section id="view-now" class="view">` and follows the existing view-switching pattern (`data-view="now"`).

### Page layout

Top-to-bottom on a phone screen:

1. **Context strip** — current local datetime, trip-day label, and GPS state.
   - Granted: `🕒 Fri, 22 May · 6:42pm · Day 1 of 3` / `📍 Near Jonker Walk`
   - Denied: `📍 Location off — tap to enable`
   - Pre-trip: `Trip starts Fri 22 May at 11am · 14 hours to go`
   - Post-trip: `Trip's over 👋 — open the Day views to look back`

2. **Filter chips** (one row, horizontally scrollable on narrow screens):
   - `Food only` — restrict to `category: food`
   - `Walking distance only` — restrict to places within 1.5 km of current GPS
   - `Souvenir / non-food` — restrict to `category` in `{souvenir, entertainment}`
   - Chips are mutually exclusive within their group; selection persists for the session in `localStorage`.

3. **Top pick** — one hero card with photo, name (CJK + Latin), short reason line, and primary actions.
   - Reason line examples: `Open until 9:30pm · 5 min walk · matches dinner` / `Open now · 2 km away · group favourite`
   - Actions: existing vote button, **Open in Google Maps** (uses `mapsUrl`), tap-to-open the existing place detail sheet.

4. **Ranked alternatives** — up to 5 more places, stacked card-list, same shape as the Index. Tap → existing place detail sheet.

5. **Empty state** — when nothing matches: `Nothing open right now. Next opens at 11:00am — Hai Nan Tea Garden (≈8h from now).`

### Refresh behaviour

- The Now view re-renders **every 60 s** while it is the active view (cleared on view switch).
- Re-renders immediately on GPS updates and Firestore vote-snapshot updates.
- Other views are untouched by Now's timers.

### GPS handling

`navigator.geolocation.watchPosition()` is requested **only when the user first opens the Now tab**, never on page load — keeps the rest of the app permission-prompt-free.

Three states are handled:

| State | Behaviour |
|---|---|
| Granted | Distance-ranked recommendations; `📍 Near <nearest-place-name>` label. |
| Denied / unavailable | Page still renders. Distance hidden. Ranking falls back to open-now + meal-fit + votes only. |
| Loading (first fix pending) | Render immediately without distance; re-render on first fix. |

## Architecture

### New module: `lib/now.mjs`

A pure, unit-testable module mirroring the style of `lib/grouping.mjs` / `lib/hours.mjs`.

**Public function:**

```
recommendNow(places, { now, lat, lng, filter }) => {
  context: { tripDay, tripPhase, currentMealBand },
  top: place | null,
  alternatives: place[],
  empty: { reason, nextOpen?: { place, opensAt } } | null
}
```

- `now` is a `Date` (or minutes-from-midnight + day-of-week, consistent with the rest of `lib/`).
- `lat`/`lng` are optional. If absent, distance term in the score is zero and `distanceKm` is omitted from outputs.
- `filter` is one of `null | 'food' | 'walking' | 'non-food'`.

**Tripphase:**
- `pre-trip` — before Fri 22 May 11:00
- `in-trip` — during the trip window
- `post-trip` — after Sun 24 May ~end of day

Pre-trip and post-trip both return `empty` with an appropriate `reason`; in those phases the page just shows the context strip and the empty-state message.

### Ranking

For each candidate place, compute a `score` (higher = better):

1. **Hard filter — must be open now.** Uses existing `checkVisit(hoursStr, { dow, minute })` from `lib/hours.mjs`. Excluded if the result is `closed-today`, `arrive-before-open`, `arrive-after-close`, or `between-service`. Kept if `open`, `closing-soon`, or `unknown` (we don't punish places with unparseable hours).

2. **Soft score components** (added together):
   - `distanceTerm` — `+max(0, 30 - distMinutes) / 30` using `driveMinutes()` from `lib/timeline.mjs` if GPS available, else `0`.
   - `mealFitTerm` — `+1.0` if the place's `mealType` matches the current hour band, `+0.2` if adjacent, `0` otherwise. Bands:
     - breakfast: 07:00–11:00
     - lunch: 11:00–14:30
     - dessert / snack: 14:30–17:30
     - dinner: 17:30–21:30
     - drinks / late-night: 21:30–02:00
     - souvenir / entertainment: any time
   - `votesTerm` — `+min(votes, 4) * 0.1`. Small tiebreaker; capped so a single popular place doesn't dominate.
   - `closingSoonPenalty` — `-0.3` if `checkVisit` returned `closing-soon`.

3. **Ties** are broken by lower `order` then alphabetical `id` to stay deterministic.

The score weights live as named constants at the top of `lib/now.mjs` and can be tuned without touching call sites.

### Rendering — `app.js`

A new `renderNow()` function, sibling to the existing `renderDay()` / `renderIndex()`. It:

1. Calls `recommendNow()` with the current state.
2. Mounts a `#view-now` DOM tree following the Index card pattern (photo + bilingual name + meta line + vote button) so it visually belongs.
3. Wires up the filter chips and the "tap to enable location" affordance.
4. Sets a `setInterval(60_000)` while the Now view is active; clears it on view switch.

The existing `applyVoteSnapshot()` is extended to call `renderNow()` when the Now view is active and a vote count for any currently-ranked place changes.

### Tests — `tests/now.test.mjs`

`node:test` suite, in the existing style. Cases:

- Lunch-band time → lunch-typed places rank above dinner-typed ones, all else equal.
- A closed place is filtered out regardless of votes/proximity.
- With no GPS, ranking still produces a non-empty list (distance term zeros out).
- Pre-trip / post-trip returns `empty` with the right `reason`.
- `closing-soon` place is demoted vs. a fully-open peer at similar distance.
- Filter `food` excludes `souvenir` / `entertainment` / `airbnb`.

## Data assumptions

- `places.json` already has `lat`, `lng`, `hours`, `category`, `mealType`, `mapsUrl`, and `order` for every place.
- `lib/drives.json` covers the existing 29×29 matrix; **GPS-to-place distances will not be in it**, so `driveMinutes(currentLocation, place)` falls back to the haversine heuristic — that's acceptable for ranking purposes.

## Risks

- **GPS accuracy in the Jonker / old-town area can be poor** (dense buildings). Distance ranking may bounce around between refreshes. Mitigated by the 60 s refresh cadence — not too jumpy — and by using `watchPosition`'s `enableHighAccuracy: true` only after the first fix.
- **Hours data quality.** Some `hours` strings are unparseable and `checkVisit()` returns `unknown`. The design treats `unknown` as "keep, but no bonus" so we never hide a place just because we couldn't parse its hours; the worst case is a misleading recommendation, which the user can verify in the place sheet.
- **Battery.** `watchPosition` is more expensive than a one-shot `getCurrentPosition`. Mitigated by only starting the watch on Now-tab entry and stopping it on view switch / page unload.

## Out of scope (explicitly)

These were considered and deliberately deferred:

- Re-flowing the Day 1/2/3 timelines based on real time.
- Push notifications when a leader flips.
- "Visited" toggle / per-stop photos / post-trip journal export.
- A walking-vs-driving toggle on the Now view.

## Acceptance criteria

1. A new **Now** tab is reachable from the masthead nav and switching to it does not break any other view.
2. With GPS granted and the system clock set to a time during the trip, the Now view renders a context strip, exactly one hero "top pick" card, and up to 5 alternative cards.
3. With GPS denied, the view still renders meaningfully (no distance, ranked by meal-fit + votes + open-now).
4. With the clock outside the trip window, the view renders only the context strip and a pre-trip / post-trip message.
5. `node --test tests/` passes, including the new `tests/now.test.mjs`.
6. No other view's rendering or behaviour is changed.

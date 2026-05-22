# Friends Rating — Design Spec

**Date:** 2026-05-23 · **Builds on:** the memory book at `docs/superpowers/specs/2026-05-23-memory-book-design.md`

## Goal

Replace the static per-stop rating (chosen by the curator at curation time) with a **live, Firestore-backed 1–5 star rating that friends can contribute to**. Each stop card shows the average rating + count and lets the viewer set/change their own rating with one tap.

## Scope changes vs. the memory-book spec

- **Removed:** the `rating` field on `memories.json` entries; the `--rating` flag on `add-stop.mjs`; the curator-side rating in the data test.
- **Added:** a Firestore collection storing per-place ratings, anonymous per-browser uid in localStorage, live subscription + writes from the client, security rules, and an interactive star UI on every stop card.
- **Unchanged:** layout, map, gallery, lightbox, timeline aesthetic.

## User experience

For each stop card the static `★★★★☆` row from the memory-book spec is replaced with:

```
★ ★ ★ ★ ☆        ← 5 buttons; your current pick is highlighted (filled)
★ 4.3 · 5 ratings ← average + count, muted small text below
```

Behavior:
- **Tap a star** → writes (or updates) your rating to Firestore. Your highlighted stars update instantly. The shared average + count update via the live subscription within a second.
- **Re-rating** is allowed — tap a different star and the previous pick is replaced.
- **No "rate" button**, no modal — the stars are the control.
- **Average display**: shown to one decimal (`★ 4.3`); always 1 decimal even on integers (`★ 4.0`). If zero ratings yet, show "★ — · 0 ratings" with stars greyed out.

The viewer is identified by an anonymous uid stored in `localStorage.melaka_uid`. No login. No display names. Friends are anonymous to each other; only counts and averages are visible.

## Architecture

### Identity

```js
function getUserId() {
  let uid = localStorage.getItem("melaka_uid");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("melaka_uid", uid);
  }
  return uid;
}
```

Lifted from the deleted planner. Each browser gets one uid per device.

### Firestore schema

Collection: `ratings`. One document per stop, id matches the stop's `id`.

```
ratings/{placeId} = {
  by: {
    "<uid-1>": 5,
    "<uid-2>": 4,
    "<uid-3>": 5
  }
}
```

- `by` is a **map** of uid → integer 1..5.
- Adding a new rater: `setDoc(ref, { by: { [myUid]: 5 } }, { merge: true })` — Firestore merge on a map field adds/updates the key without touching others.
- Updating an existing rater: same operation; merge semantics overwrite the single key.
- (No need for a separate `count` or `sum` field; we compute average client-side from the map.)

### Security rules (`firestore.rules`)

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

Threat model is the same as the old planner's voting rules: an attacker with the SDK in hand could rate as many fake uids as they want, up to the 100-rater cap. Acceptable for a friends-and-family site.

### Client modules

- **`lib/ratings.mjs`** — new module. Owns:
  - Firebase SDK init (modular Web SDK, loaded via ESM CDN inside the module).
  - `getUserId()` helper.
  - `subscribeAll(onUpdate)` — opens a snapshot listener on the whole `ratings` collection. `onUpdate` receives a `Map<placeId, { my: number|null, avg: number|null, count: number }>` and is called on every Firestore push.
  - `setRating(placeId, stars)` — writes via `setDoc(..., { by: { [uid]: stars } }, { merge: true })`.

- **`lib/render.mjs`** — emit the new star row inside `.stop-head`. Each stop card gets:
  ```html
  <div class="rating" data-id="${stop.id}">
    <div class="rating-stars" role="radiogroup" aria-label="Rate this stop">
      <button data-star="1" aria-label="1 star">☆</button>
      ... five buttons ...
    </div>
    <div class="rating-avg" data-id="${stop.id}">★ — · 0 ratings</div>
  </div>
  ```

- **`app.js`** — wire the subscription. After `renderDays(...)`, subscribe; each tick walks the live map and updates each stop's `.rating-stars` button states + `.rating-avg` text. Clicks on a `[data-star]` button call `setRating(placeId, stars)`.

### Visual

Star button styling additions to `style.css`:
- Button reset (no border, transparent bg, cursor pointer).
- Inactive star: outline glyph (`☆`), color `var(--muted)`.
- Active star (any star ≤ your pick): filled glyph (`★`), color `var(--gold)`.
- Average text: small, sans-serif, `var(--muted)`.
- Hover (desktop): highlight stars 1..hovered with `var(--gold)` at 50% opacity.

## Files affected

**Created:**
- `firebase.json` (top-level config, just points at `firestore.rules`)
- `firestore.rules` (new ratings rules above)
- `.firebaserc` (binds `default` to project id)
- `lib/ratings.mjs` (Firebase init + uid + subscribe + write)
- `tests/ratings.test.mjs` (pure-function tests for the average computation)

**Modified:**
- `app.js` (wire subscription + star clicks)
- `lib/render.mjs` (emit star row + average placeholder; drop the `stars(n)` static string)
- `style.css` (star button styling)
- `memories.json` (remove `rating` field from existing entry)
- `tests/data.test.mjs` (remove `rating` assertion)
- `tools/add-stop.mjs` (remove `--rating` flag + prompt; remove from entry construction)
- `CLAUDE.md` (document ratings system)
- `README.md` (note Firebase deploy step)

## Pure-function unit testing

`tests/ratings.test.mjs` covers a pure helper exported from `ratings.mjs`:

```js
export function summarize(byMap, myUid) {
  // returns { my: number|null, avg: number|null, count: number }
}
```

Test cases:
- empty map → `{ my: null, avg: null, count: 0 }`
- 3 ratings without my uid → `{ my: null, avg: 4.33..., count: 3 }`
- 3 ratings including mine → `{ my: 5, avg: ..., count: 3 }`
- my uid is the only rater → `{ my: 4, avg: 4, count: 1 }`

The Firestore subscription and DOM wiring are exercised by hand in the browser, not by unit tests.

## Deploy

One additional step on top of the memory-book's "push to main":

```bash
firebase deploy --only firestore:rules --project project-21c844a6-e5cc-4a62-920
```

Run this once after the rules land on `main`. After that, normal `git push origin main` deploys the site as before.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Fake ratings via SDK manipulation | Hard cap of 100 raters per stop in rules. Trip is friends-only; acceptable. |
| Stale `melaka_uid` collision | Vanishingly low (crypto.randomUUID, 122 bits). |
| Friend ratings before rules deployed | First push to main without `firebase deploy --only firestore:rules` will leave writes failing (old rules only allow `votes/`). Plan calls out the deploy step. |
| The Firestore project is from the old planner | Same project, new collection (`ratings/`). Old `votes/` collection is untouched and effectively orphaned — leave it; nobody reads it. |

## Open questions

None. Implementation choices (CDN URL for the modular SDK, exact star glyphs, hover style) are surface-level and decided during the build.

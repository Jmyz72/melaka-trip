# Melaka — Painted Postcard (Design Spec)

**Date:** 2026-05-23
**Approved:** Carson Hew (verbal, "build it")
**Goal:** Redesign the Melaka trip memory site to be visually striking enough to shock friends. Lean hard into a Cinematic Watercolor aesthetic with WebGL, Three.js, Canvas, and scroll-driven 3D as the technical shock layer.

## Aesthetic

Cinematic Watercolor: bleed-cream paper grain, indigo ink, vermillion seal accents.

- **Type:** EB Garamond (display) + Ma Shan Zheng (Chinese, hand-brushed) + Caveat (annotations). Letter-spaced small-caps sans only for tiny meta (ratings counter).
- **Palette:** `#f4ead5` paper · `#1d2b4f` indigo · `#c8392b` vermillion · `#5a4a2a` aged ink · `#d4c4a0` rule lines.

## Structure (three movements)

### 1. Postmark Cover (full-viewport hero)
A 3D postcard floats in space. The watercolor map of Melaka is its front texture. A 3D vermillion seal drops from above with a bounce + ink-splash particle burst. Below: live ratings ticker (subscribes to Firestore). Drag/swipe rotates the card with momentum; you can flip it to see the back. Device-tilt parallax on mobile. Unmounts when scrolled past.

### 2. Cinematic Scroll-Snap Journey
`scroll-snap-type: y mandatory`. Each stop = one full-viewport section. Photo emerges through a canvas watercolor brush-mask synced to IntersectionObserver ratio. Title brushes itself on via SVG `stroke-dasharray` (English + Chinese strokes). Multi-photo stops drift Ken-Burns-style on scroll; tap → existing lightbox. Day transitions are full 3D page-flips (CSS `rotateY` + `perspective`). A floating map button bottom-left opens a watercolor map overlay showing current position.

### 3. Closing Seal
"三日 · three days" calligraphy interstitial. Total stops, total raters, top-rated moment auto-computed. A second postcard flies in (Three.js), the seal stamps it, camera dollies back — feels sealed and sent.

## Four "wow" engines

1. **WebGL fluid ink background** (always on). Pavel-Dobryakov-style fluid simulation behind everything. Mouse pushes indigo ink that bleeds on cream paper. 0.5× resolution, 30fps cap, paused on tab hidden. → `lib/fluid-bg.mjs`
2. **3D postcard hero** (Three.js r160 via esm.sh). Mesh + texture + drag/swipe rotation + drop-bounce seal + particle splash. → `lib/cover-3d.mjs`
3. **Scroll-driven reveals + page-flip 3D**. Canvas brush masks for photos, SVG dash-array brush strokes for titles, CSS 3D rotateY for day transitions. → `lib/transitions.mjs`, `lib/brush-reveal.mjs`
4. **Ink-trail cursor + rating splash**. Vermillion brush trail (canvas), 50–80 droplet particle burst on rating click (canvas). Touch fallback: tap-ripple. → `lib/ink-cursor.mjs`, `lib/rating-splash.mjs`

## Bonus

- Audio toggle (off by default): ambient brush + rain loop
- Konami code: indigo ink → gold for the session

## Performance

- Low-power detection: `navigator.hardwareConcurrency < 4` OR `prefers-reduced-motion` → fluid sim becomes static SVG noise; 3D postcard becomes a 2D parallax card.
- Three.js scenes mount on viewport-enter, dispose on exit.
- Budget: <300KB JS gzipped (Three.js ~140KB is the heavy hitter).
- All animations honor `prefers-reduced-motion`.

## What stays

- `memories.json` schema — unchanged
- Firestore ratings + uid — unchanged; UI re-skinned as inked stars
- `lib/ratings.mjs`, `lib/ratings-summary.mjs`, `lib/name.mjs`, `lib/lightbox.mjs` — kept
- `lib/map.mjs` — kept, repurposed (map renders to a texture for the 3D card, plus overlay)

## What changes

- `index.html` — rewritten shell with canvas/webgl layers
- `style.css` — full rewrite for watercolor aesthetic
- `app.js` — rewritten orchestrator
- `lib/render.mjs`, `lib/gallery.mjs` — rewritten for scroll-snap + canvas-mask reveals

## New files

```
lib/fluid-bg.mjs          WebGL fluid simulation
lib/cover-3d.mjs          Three.js postcard + seal hero
lib/brush-reveal.mjs      SVG stroke-dasharray title brushwork
lib/ink-cursor.mjs        canvas vermillion cursor trail
lib/rating-splash.mjs     canvas particle burst on rate click
lib/transitions.mjs       scroll-snap + 3D page-flip orchestration
assets/paper.svg          paper grain texture
assets/seal.svg           vermillion seal artwork
assets/brush-masks.svg    photo reveal masks
shaders/fluid.frag        fluid sim fragment shader
shaders/fluid.vert        fluid sim vertex shader
```

## Testing

Existing tests for `ratings-summary`, `name`, `render` must keep passing. Update `render` tests for new DOM structure. No tests for WebGL/Three.js scenes — visual QA in browser.

## Out of scope

- Server-side anything (still static GitHub Pages)
- Bundler (still vanilla ESM via CDN)
- Backwards-compat with old DOM structure

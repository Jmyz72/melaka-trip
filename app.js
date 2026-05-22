// Melaka — A Painted Postcard
// Orchestrator: wires WebGL fluid bg, 3D postcard, scroll-snap timeline,
// brush reveals, live Firestore ratings, ink cursor, particle splashes.

import { renderDays, applyRatingForStop, applyClosingStats } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";
import { mountMap } from "./lib/map.mjs";
import { subscribeAll, setRating } from "./lib/ratings.mjs";
import { mountFluidBG } from "./lib/fluid-bg.mjs";
import { mountCover3D } from "./lib/cover-3d.mjs";
import { rate_splash, burst } from "./lib/rating-splash.mjs";
import { mountTransitions, mountTicker } from "./lib/transitions.mjs";
import { mountSideTimeline } from "./lib/side-timeline.mjs";

async function main() {
  // ── Layer 1: WebGL fluid ink background ─────────────────────────
  const fluid = mountFluidBG(document.getElementById("fluid-bg"));

  // ── Layer 2: Load memories and render timeline ──────────────────
  const memories = await fetch("memories.json").then(r => r.json());
  const timelineEl = document.getElementById("timeline");
  const stops = renderDays(memories, timelineEl);

  // Mount galleries (with canvas brush-mask reveals)
  for (const stop of stops) {
    const container = timelineEl.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      openLightbox(s.media, i, splitName(s.name).main);
    });
  }

  // ── Layer 3b: Side timeline rail ────────────────────────────────
  const scrollElForRail = document.getElementById("scroll");
  mountSideTimeline(stops, scrollElForRail, document.getElementById("side-timeline"));

  // ── Layer 4: 3D postcard hero ───────────────────────────────────
  const mountEl = document.getElementById("cover-3d-mount");
  let cover3D = null;
  try {
    cover3D = await mountCover3D(mountEl, {
      onSealImpact: (x, y) => burst(x, y, { count: 140, color: "#c8392b", speed: 7, life: 1000 })
    });
  } catch (err) {
    console.warn("3D postcard failed, falling back to 2D card:", err);
    mountEl.dataset.fallback = "true";
  }

  // ── Layer 5: Map overlay (existing Leaflet map, opens on tap) ───
  const mapEl       = document.getElementById("map");
  const mapOverlay  = document.getElementById("map-overlay");
  const mapToggle   = document.getElementById("map-toggle");
  const mapClose    = mapOverlay.querySelector(".map-overlay-close");
  let leafletMap = null;
  function ensureMap() {
    if (leafletMap) { setTimeout(() => leafletMap.invalidateSize(), 100); return; }
    leafletMap = mountMap(mapEl, stops, {
      onPinClick: (s) => {
        const card = document.getElementById(`stop-${s.id}`);
        mapOverlay.hidden = true;
        if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    setTimeout(() => leafletMap?.invalidateSize(), 200);
  }
  mapToggle.addEventListener("click", () => {
    mapOverlay.hidden = false;
    ensureMap();
  });
  mapClose.addEventListener("click", () => { mapOverlay.hidden = true; });
  mapOverlay.addEventListener("click", (e) => {
    if (e.target === mapOverlay) mapOverlay.hidden = true;
  });

  // ── Layer 6: Audio toggle (ambient rain, off by default) ──
  // Plays a soft rain-on-window loop (media/audio/rain.mp3). The file is
  // lazy-loaded on first click so the page weight stays the same for users
  // who never turn audio on. Fade in/out via WebAudio's GainNode for a
  // gentle on/off rather than an abrupt mute.
  const audioBtn = document.getElementById("audio-toggle");
  const TARGET_GAIN = 0.55;  // 0..1; the mp3 itself is fairly quiet
  let audioCtx = null;
  let audioEl  = null;
  let audioGain = null;

  audioBtn.addEventListener("click", () => {
    const on = audioBtn.getAttribute("aria-pressed") === "true";
    if (on) {
      audioBtn.setAttribute("aria-pressed", "false");
      if (audioGain) {
        audioGain.gain.cancelScheduledValues(audioCtx.currentTime);
        audioGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        // pause once the fade-out completes so the tab doesn't keep decoding
        setTimeout(() => audioEl?.pause(), 600);
      }
      return;
    }
    audioBtn.setAttribute("aria-pressed", "true");
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioEl = new Audio("media/audio/cheers.mp3");
      audioEl.loop = true;
      audioEl.crossOrigin = "anonymous";
      audioEl.preload = "auto";
      const src = audioCtx.createMediaElementSource(audioEl);
      audioGain = audioCtx.createGain();
      audioGain.gain.value = 0;
      src.connect(audioGain).connect(audioCtx.destination);
    }
    // Resume context (browsers require a user gesture before audio plays)
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioEl.play().catch(err => console.warn("audio play failed:", err));
    audioGain.gain.cancelScheduledValues(audioCtx.currentTime);
    audioGain.gain.linearRampToValueAtTime(TARGET_GAIN, audioCtx.currentTime + 0.7);
  });

  // ── Layer 7: Live ratings ─────────────────────────────────────────
  let latestRatings = new Map();
  subscribeAll((map) => {
    latestRatings = map;
    for (const stop of stops) {
      const summary = map.get(stop.id) || { my: null, avg: null, count: 0, by: {} };
      applyRatingForStop(stop.id, summary);
    }
    applyClosingStats(stops, map);
  });

  // Star click → write rating + splash particles at click point
  document.getElementById("scroll").addEventListener("click", (e) => {
    const btn = e.target.closest(".star");
    if (!btn) return;
    const stopId = btn.dataset.id;
    const stars = Number(btn.dataset.star);
    const rect = btn.getBoundingClientRect();
    rate_splash(rect.left + rect.width / 2, rect.top + rect.height / 2);
    setRating(stopId, stars).catch(err => console.error("rating write failed:", err));
  });

  // ── Layer 8: Scroll orchestration & ticker ──────────────────────
  const scrollEl = document.getElementById("scroll");
  const coverEl  = document.getElementById("cover");
  mountTransitions({
    scrollEl, coverEl, cover3D, mapToggleBtn: mapToggle
  });
  mountTicker(document.getElementById("cover-ticker"), () => {
    let raters = 0, totalAvg = 0, totalCount = 0, topAvg = -1, topStop = null;
    const uids = new Set();
    for (const stop of stops) {
      const s = latestRatings.get(stop.id);
      if (!s || s.count === 0) continue;
      if (s.by) for (const u of Object.keys(s.by)) uids.add(u);
      totalAvg += s.avg * s.count;
      totalCount += s.count;
      if (s.avg > topAvg) { topAvg = s.avg; topStop = stop; }
    }
    raters = uids.size;
    return {
      raters,
      avg: totalCount ? totalAvg / totalCount : 0,
      top: topStop ? splitName(topStop.name).main : null
    };
  });

  // ── Layer 9: Konami code easter egg ────────────────────────────
  const konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let kIdx = 0;
  window.addEventListener("keydown", (e) => {
    const key = e.key;
    if (key === konami[kIdx] || key.toLowerCase() === konami[kIdx]) {
      kIdx++;
      if (kIdx === konami.length) {
        document.documentElement.style.setProperty("--vermillion", "#c9962e");
        document.documentElement.style.setProperty("--vermillion-deep", "#a37316");
        burst(window.innerWidth / 2, window.innerHeight / 2, { count: 200, color: "#c9962e", speed: 9, life: 1400 });
        kIdx = 0;
      }
    } else {
      kIdx = 0;
    }
  });

  // ── Smooth-scroll cue: nudge user past the cover after a few seconds ──
  setTimeout(() => {
    const cue = document.querySelector(".cover-cue");
    if (cue) cue.style.fontSize = "22px";
  }, 4000);
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:40px;font-family:serif;font-style:italic;color:#9e2a1e">
       Couldn't paint the postcard: ${err.message}
     </p>`;
});

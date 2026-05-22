import { renderDays, applyRatingForStop } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";
import { mountMap } from "./lib/map.mjs";
import { subscribeAll, setRating } from "./lib/ratings.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  const map = mountMap(document.getElementById("map"), stops, {
    onPinClick: (s) => {
      const card = document.getElementById(`stop-${s.id}`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const mapEl = document.getElementById("map");
  let shrunk = false;
  window.addEventListener("scroll", () => {
    const should = window.scrollY > window.innerHeight * 0.3;
    if (should !== shrunk) {
      shrunk = should;
      mapEl.classList.toggle("shrunk", shrunk);
      if (map) map.invalidateSize();
    }
  }, { passive: true });

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      openLightbox(s.media, i, splitName(s.name).main);
    });
  }

  // Live ratings subscription
  subscribeAll((map) => {
    for (const stop of stops) {
      const summary = map.get(stop.id) || { my: null, avg: null, count: 0 };
      applyRatingForStop(stop.id, summary);
    }
  });

  // Delegated click handler for star buttons
  timeline.addEventListener("click", (e) => {
    const btn = e.target.closest(".star");
    if (!btn) return;
    const stopId = btn.dataset.id;
    const stars = Number(btn.dataset.star);
    setRating(stopId, stars).catch(err => {
      console.error("rating write failed:", err);
    });
  });
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});

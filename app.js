import { renderDays } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";
import { openLightbox } from "./lib/lightbox.mjs";
import { splitName } from "./lib/name.mjs";
import { mountMap } from "./lib/map.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  mountMap(document.getElementById("map"), stops, {
    onPinClick: (s) => {
      const card = document.getElementById(`stop-${s.id}`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      openLightbox(s.media, i, splitName(s.name).main);
    });
  }
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});

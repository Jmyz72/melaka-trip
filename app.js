import { renderDays } from "./lib/render.mjs";
import { mountGallery } from "./lib/gallery.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  const stops = renderDays(memories, timeline);

  for (const stop of stops) {
    const container = timeline.querySelector(`.stop-gallery[data-id="${stop.id}"]`);
    if (container) mountGallery(stop, container, (s, i) => {
      console.log("clicked", s.id, i); // lightbox wires in next task
    });
  }
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});

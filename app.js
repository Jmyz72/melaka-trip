import { renderDays } from "./lib/render.mjs";

async function main() {
  const memories = await fetch("memories.json").then(r => r.json());
  const timeline = document.getElementById("timeline");
  renderDays(memories, timeline);
}

main().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML =
    `<p style="padding:24px;color:#b91c1c">Failed to load: ${err.message}</p>`;
});

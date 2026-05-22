import { splitName } from "./name.mjs";

const DAY_LABELS = {
  1: { eyebrow: "DAY ONE",   date: "Friday, 22 May" },
  2: { eyebrow: "DAY TWO",   date: "Saturday, 23 May" },
  3: { eyebrow: "DAY THREE", date: "Sunday, 24 May" }
};

function stars(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function stopCardHTML(stop) {
  const { main, cn } = splitName(stop.name);
  return `
    <article class="stop" id="stop-${stop.id}">
      <div class="stop-dot" aria-hidden="true"></div>
      <div class="stop-head">
        <span class="stop-time">${stop.time}</span>
        <span class="stop-stars" aria-label="${stop.rating} stars">${stars(stop.rating)}</span>
      </div>
      <h3 class="stop-name">${main}</h3>
      ${cn ? `<p class="stop-cn">${cn}</p>` : ""}
      <div class="stop-gallery" data-id="${stop.id}"></div>
      <a class="stop-maps" href="${stop.mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </article>
  `;
}

function dayHTML(day, stops) {
  const { eyebrow, date } = DAY_LABELS[day];
  const cards = stops.map(stopCardHTML).join("");
  return `
    <section class="day day-${day}">
      <header class="day-head">
        <div class="day-eyebrow">${eyebrow}</div>
        <h2 class="day-date">${date}</h2>
      </header>
      <div class="day-line">${cards}</div>
    </section>
  `;
}

export function renderDays(memories, container) {
  const stops = memories
    .filter(m => m.media.length > 0)
    .sort((a, b) => a.day - b.day || a.order - b.order);
  const byDay = new Map([[1, []], [2, []], [3, []]]);
  for (const s of stops) byDay.get(s.day).push(s);
  container.innerHTML = [...byDay.entries()]
    .filter(([_, list]) => list.length > 0)
    .map(([day, list]) => dayHTML(day, list))
    .join("");
  return stops;
}

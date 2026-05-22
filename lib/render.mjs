import { splitName } from "./name.mjs";

const DAY_LABELS = {
  1: { eyebrow: "DAY ONE",   date: "Friday, 22 May" },
  2: { eyebrow: "DAY TWO",   date: "Saturday, 23 May" },
  3: { eyebrow: "DAY THREE", date: "Sunday, 24 May" }
};

function ratingHTML(stopId) {
  const buttons = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star" data-id="${stopId}" data-star="${n}" aria-label="${n} star${n === 1 ? "" : "s"}">☆</button>`
  ).join("");
  return `
    <div class="rating">
      <div class="rating-stars" role="radiogroup" aria-label="Rate this stop">${buttons}</div>
      <div class="rating-avg" data-id="${stopId}">★ — · 0 ratings</div>
    </div>
  `;
}

function stopCardHTML(stop) {
  const { main, cn } = splitName(stop.name);
  return `
    <article class="stop" id="stop-${stop.id}">
      <div class="stop-dot" aria-hidden="true"></div>
      <div class="stop-head">
        <span class="stop-time">${stop.time}</span>
        ${ratingHTML(stop.id)}
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

// Update star + average rendering for a single stop. Called by app.js on every
// ratings tick. `summary` is { my, avg, count }; element lookup is by data-id.
export function applyRatingForStop(stopId, summary) {
  const root = document.getElementById(`stop-${stopId}`);
  if (!root) return;
  const my = summary.my || 0;
  const stars = root.querySelectorAll(`.star[data-id="${stopId}"]`);
  stars.forEach((btn) => {
    const n = Number(btn.dataset.star);
    btn.textContent = n <= my ? "★" : "☆";
    btn.classList.toggle("filled", n <= my);
  });
  const avgEl = root.querySelector(`.rating-avg[data-id="${stopId}"]`);
  if (avgEl) {
    if (summary.count === 0) {
      avgEl.textContent = `★ — · 0 ratings`;
    } else {
      const avg1 = summary.avg.toFixed(1);
      avgEl.textContent = `★ ${avg1} · ${summary.count} rating${summary.count === 1 ? "" : "s"}`;
    }
  }
}

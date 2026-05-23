import { splitName } from "./name.mjs";

const DAY_LABELS = {
  1: { num: "一", roman: "Day One",   date: "Friday, 22 May 2026" },
  2: { num: "二", roman: "Day Two",   date: "Saturday, 23 May 2026" },
  3: { num: "三", roman: "Day Three", date: "Sunday, 24 May 2026" }
};

function romanize(n) {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n - 1] || String(n);
}

function ratingHTML(stopId) {
  const buttons = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star" data-id="${stopId}" data-star="${n}" aria-label="${n} star${n === 1 ? "" : "s"}">☆</button>`
  ).join("");
  return `
    <div class="rating">
      <div class="rating-label">your rating</div>
      <div class="rating-stars" role="radiogroup" aria-label="Rate this stop">${buttons}</div>
      <div class="rating-avg" data-id="${stopId}">unrated</div>
      <div class="rating-count" data-id="${stopId}-count">0 friends</div>
    </div>
  `;
}

function stopHTML(stop, indexInTrip, totalInTrip) {
  const { main, cn } = splitName(stop.name);
  return `
    <section class="snap stop" id="stop-${stop.id}" data-section="stop" data-stop-id="${stop.id}" data-day="${stop.day}">
      <header class="stop-header">
        <span class="stop-index">${romanize(indexInTrip)} of ${romanize(totalInTrip)} · Day ${["One","Two","Three"][stop.day - 1]}</span>
        <span class="stop-time">${stop.time}</span>
      </header>
      <div class="stop-title-wrap">
        <h2 class="stop-title">${main}${cn ? `<span class="stop-title-cn">${cn}</span>` : ""}</h2>
        <svg class="stop-brush-rule" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2,9 C 40,3 80,12 120,6 C 170,2 210,11 260,5 C 290,3 310,8 318,7" />
        </svg>
      </div>
      <div class="stop-gallery" data-id="${stop.id}"></div>
      <footer class="stop-footer">
        <a class="stop-maps" href="${stop.mapsUrl}" target="_blank" rel="noopener">View in Maps ↗</a>
        ${ratingHTML(stop.id)}
      </footer>
    </section>
  `;
}

function dayInterstitialHTML(day) {
  const { num, roman, date } = DAY_LABELS[day];
  return `
    <section class="snap day-interstitial" data-section="day-interstitial" data-day="${day}">
      <h2 class="day-interstitial-num">${num}<span>${roman}</span></h2>
      <div class="day-interstitial-rule" aria-hidden="true"></div>
      <p class="day-interstitial-date">${date}</p>
    </section>
  `;
}

function closingHTML(stops, ratingsSummary = null) {
  const totalStops = stops.length;
  // The "top moment" + raters count are filled in by applyClosingStats() at runtime.
  return `
    <section class="snap closing" data-section="closing">
      <h2 class="closing-title">三日</h2>
      <p class="closing-sub">three days, painted</p>
      <div class="closing-stats">
        <div>
          <span class="closing-stat-num" id="closing-stops">${totalStops}</span>
          stops
        </div>
        <div>
          <span class="closing-stat-num" id="closing-raters">—</span>
          friends rated
        </div>
        <div>
          <span class="closing-stat-top" id="closing-top">—</span>
          favourite
        </div>
      </div>
      <svg class="closing-seal" viewBox="0 0 100 100" aria-hidden="true">
        <use href="#seal"/>
      </svg>
      <p class="closing-sign">— RSD3S2, with friends</p>
    </section>
  `;
}

// Renders the full timeline: day interstitial → stops → day interstitial → … → closing.
// Returns the ordered stop list (same shape as before).
export function renderDays(memories, container) {
  const stops = memories
    .filter(m => m.media.length > 0)
    .sort((a, b) => a.day - b.day || a.order - b.order);

  const byDay = new Map([[1, []], [2, []], [3, []]]);
  for (const s of stops) byDay.get(s.day).push(s);

  const total = stops.length;
  const html = [];
  let runningIndex = 0;

  for (const [day, list] of byDay) {
    if (list.length === 0) continue;
    html.push(dayInterstitialHTML(day));
    for (const stop of list) {
      runningIndex += 1;
      html.push(stopHTML(stop, runningIndex, total));
    }
  }
  html.push(closingHTML(stops));

  container.innerHTML = html.join("");
  return stops;
}

// Update star + average + count for a single stop. Called on every Firestore tick.
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
      avgEl.textContent = "unrated";
    } else {
      avgEl.textContent = `${summary.avg.toFixed(1)} ★`;
    }
  }
  const countEl = root.querySelector(`.rating-count[data-id="${stopId}-count"]`);
  if (countEl) {
    countEl.textContent = summary.count === 1
      ? "1 friend"
      : `${summary.count} friends`;
  }
}

// Recompute and display closing-screen aggregates: total raters (unique uids
// across all stops), and the top-rated stop name. Called whenever ratings tick.
export function applyClosingStats(stops, ratingsMap) {
  const ratersEl = document.getElementById("closing-raters");
  const topEl    = document.getElementById("closing-top");
  if (!ratersEl || !topEl) return;

  const uids = new Set();
  let topStop = null;
  let topAvg  = -1;

  for (const stop of stops) {
    const summary = ratingsMap.get(stop.id);
    if (!summary || summary.count === 0) continue;
    if (summary.avg > topAvg || (summary.avg === topAvg && summary.count > (topStop?.count || 0))) {
      topAvg = summary.avg;
      topStop = { stop, count: summary.count };
    }
    if (summary.by) for (const uid of Object.keys(summary.by)) uids.add(uid);
    else for (let i = 0; i < summary.count; i++) uids.add(`${stop.id}-${i}`);
  }

  ratersEl.textContent = uids.size > 0 ? String(uids.size) : "0";
  if (topStop) {
    const { main } = splitName(topStop.stop.name);
    topEl.textContent = main;
  } else {
    topEl.textContent = "—";
  }
}

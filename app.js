import { groupByDay, sortDaySchedule, getAlternatives } from "./lib/grouping.mjs";

const places = await fetch("./places.json").then(r => r.json());

// --- icons (inline SVGs) ---
const ICON = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14"/><path d="M5 17v-4l2-5h10l2 5v4"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>'
};

// --- tab switching ---
const tabs = document.querySelectorAll(".tab");
const views = {
  map: document.getElementById("view-map"),
  day1: document.getElementById("view-day1"),
  day2: document.getElementById("view-day2"),
  day3: document.getElementById("view-day3"),
  all: document.getElementById("view-all")
};

function selectTab(name) {
  for (const t of tabs) {
    t.setAttribute("aria-selected", t.dataset.view === name ? "true" : "false");
  }
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("active", key === name);
  }
  if (name === "map" && window.__map) window.__map.invalidateSize();
}

for (const t of tabs) {
  t.addEventListener("click", () => selectTab(t.dataset.view));
}

// --- map ---
const DAY_COLOR = { 1: "#ea580c", 2: "#0891b2", 3: "#65a30d" };
const AIRBNB_COLOR = "#d97706";
const UNASSIGNED_COLOR = "#94a3b8";

function colorFor(p) {
  if (p.category === "airbnb") return AIRBNB_COLOR;
  if (p.day === 1 || p.day === 2 || p.day === 3) return DAY_COLOR[p.day];
  return UNASSIGNED_COLOR;
}

function makeIcon(p) {
  const color = colorFor(p);
  const isAirbnb = p.category === "airbnb";
  const size = isAirbnb ? 26 : 22;
  return L.divIcon({
    className: "pin",
    html: `<span class="pin-inner${isAirbnb ? ' airbnb' : ''}" style="background:${color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

const map = L.map("leaflet-map", { zoomControl: true });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "© OpenStreetMap contributors"
}).addTo(map);
window.__map = map;

const withCoords = places.filter(p => typeof p.lat === "number" && typeof p.lng === "number");
const markers = withCoords.map(p => {
  const m = L.marker([p.lat, p.lng], { icon: makeIcon(p) }).addTo(map);
  m.on("click", () => openSheet(p));
  return m;
});
map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [30, 30] });

// --- bottom sheet ---
const sheet = document.getElementById("sheet");
const sheetBody = document.getElementById("sheet-body");
document.getElementById("sheet-close").addEventListener("click", closeSheet);

function openSheet(p) {
  sheetBody.innerHTML = renderCardHtml(p, { showDayBadge: true });
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
}
function closeSheet() {
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
}

const SLOT_LABEL = {
  breakfast: "Breakfast 早餐",
  lunch: "Lunch 午餐",
  dinner: "Dinner 晚餐",
  snack: "Snack",
  dessert: "Dessert 蛋糕",
  "late-night": "Late-night 宵夜",
  drinks: "Drinks",
  souvenir: "Souvenir 手信",
  entertainment: "Entertainment 玩",
  stay: "Stay 住宿"
};

function dayLabelFor(p) {
  if (p.category === "airbnb") return "Airbnb";
  if (!p.day) return "Anytime";
  return `Day ${p.day}`;
}

function renderCardHtml(p, { showDayBadge = false, hideKicker = false } = {}) {
  const dayClass = p.category === "airbnb" ? "airbnb" : (p.day ? `day-${p.day}` : "");
  const slot = SLOT_LABEL[p.mealType] || p.mealType;
  let kicker = "";
  if (!hideKicker) {
    const kickerParts = [];
    if (showDayBadge) kickerParts.push(dayLabelFor(p));
    kickerParts.push(slot);
    kicker = `
      <div class="kicker">
        <span class="dot"></span>
        ${kickerParts.map(escapeHtml).join(" · ")}
      </div>`;
  }
  const metaParts = [];
  if (p.hours) {
    metaParts.push(`<span class="meta-item">${ICON.clock}${escapeHtml(p.hours)}</span>`);
  }
  if (p.durationFromAirbnbMin != null) {
    metaParts.push(`<span class="meta-item">${ICON.car}${p.durationFromAirbnbMin} min from Airbnb</span>`);
  }
  const meta = metaParts.length ? `<div class="meta">${metaParts.join("")}</div>` : "";
  const remarks = p.remarks ? `<p class="remarks">${highlightReservation(escapeHtml(p.remarks))}</p>` : "";
  return `
    <article class="card ${dayClass}">
      ${kicker}
      <h3>${escapeHtml(p.name)}</h3>
      ${meta}
      ${remarks}
      <div class="actions">
        <a class="btn" href="${p.mapsUrl}" target="_blank" rel="noopener">
          Open in Google Maps ${ICON.external}
        </a>
      </div>
    </article>
  `;
}

function highlightReservation(s) {
  return s.replace(/RESERVATION NEEDED/g, "<strong>RESERVATION NEEDED</strong>");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// --- day views ---
const DAY_SUBTITLE = {
  1: "Arrival · check-in 3pm",
  2: "Full day · explore",
  3: "Final morning · check-out 11am"
};

function renderDayView(dayNumber, containerEl) {
  const dayPlaces = sortDaySchedule(groupByDay(places)[dayNumber]);
  const intro = `
    <div class="day-intro">
      <p class="day-title">Day ${dayNumber}</p>
      <p class="day-sub">${DAY_SUBTITLE[dayNumber] || ""}</p>
    </div>
  `;

  const seenMeal = new Set();
  const primaries = [];
  const altsByMeal = {};
  for (const p of dayPlaces) {
    if (seenMeal.has(p.mealType)) {
      (altsByMeal[p.mealType] ||= []).push(p);
    } else {
      seenMeal.add(p.mealType);
      primaries.push(p);
    }
  }

  const body = primaries.length === 0
    ? `<p class="empty">No places assigned to Day ${dayNumber}.</p>`
    : primaries.map(p => {
        const alts = altsByMeal[p.mealType] || [];
        const altsHtml = alts.length === 0 ? "" : `
          <details class="alternatives">
            <summary>${alts.length} alternative${alts.length > 1 ? "s" : ""}</summary>
            ${alts.map(a => renderCardHtml(a, { hideKicker: true })).join("")}
          </details>
        `;
        return `
          <div class="slot">
            <div class="slot-heading">
              <span class="slot-dot"></span>
              <span class="slot-label">${escapeHtml(SLOT_LABEL[p.mealType] || p.mealType)}</span>
            </div>
            ${renderCardHtml(p, { hideKicker: true })}
            ${altsHtml}
          </div>
        `;
      }).join("");

  containerEl.innerHTML = intro + body;
}

renderDayView(1, views.day1);
renderDayView(2, views.day2);
renderDayView(3, views.day3);

// --- all view ---
const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "entertainment", label: "Entertainment" },
  { key: "souvenir", label: "Souvenir" },
  { key: "airbnb", label: "Stay" }
];

let allFilter = "all";

function countFor(key) {
  return key === "all" ? places.length : places.filter(p => p.category === key).length;
}

function renderAllView() {
  const filtered = allFilter === "all"
    ? places
    : places.filter(p => p.category === allFilter);
  const chips = CATEGORIES.map(c => `
    <button class="chip" data-cat="${c.key}" aria-pressed="${c.key === allFilter}">
      ${c.label}<span class="count">${countFor(c.key)}</span>
    </button>
  `).join("");
  views.all.innerHTML = `
    <div class="filters">${chips}</div>
    <div class="list">${filtered.map(p => renderCardHtml(p, { showDayBadge: true })).join("")}</div>
  `;
  for (const chip of views.all.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      allFilter = chip.dataset.cat;
      renderAllView();
    });
  }
}

renderAllView();

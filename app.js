import { groupByDay, sortDaySchedule, getAlternatives } from "./lib/grouping.mjs";

const places = await fetch("./places.json").then(r => r.json());

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
    const isActive = t.dataset.view === name;
    t.setAttribute("aria-selected", isActive ? "true" : "false");
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
const DAY_COLOR = { 1: "#d64545", 2: "#3672c3", 3: "#2f9e44" };
const AIRBNB_COLOR = "#d4a017";
const UNASSIGNED_COLOR = "#9a9a9a";

function colorFor(p) {
  if (p.category === "airbnb") return AIRBNB_COLOR;
  if (p.day === 1 || p.day === 2 || p.day === 3) return DAY_COLOR[p.day];
  return UNASSIGNED_COLOR;
}

function makeIcon(color) {
  return L.divIcon({
    className: "pin",
    html: `<span style="
      display:block;width:22px;height:22px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
}

const map = L.map("leaflet-map", { zoomControl: true });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "© OpenStreetMap contributors"
}).addTo(map);
window.__map = map;

const withCoords = places.filter(p => typeof p.lat === "number" && typeof p.lng === "number");
const markers = withCoords.map(p => {
  const m = L.marker([p.lat, p.lng], { icon: makeIcon(colorFor(p)) }).addTo(map);
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

function renderCardHtml(p, { showDayBadge = false } = {}) {
  const dayClass = p.category === "airbnb"
    ? "airbnb"
    : (p.day ? `day-${p.day}` : "");
  const dayBadge = showDayBadge && p.day ? `<span>Day ${p.day}</span>` : "";
  const dur = p.durationFromAirbnbMin != null
    ? `<span>${p.durationFromAirbnbMin} min from Airbnb</span>` : "";
  const hours = p.hours ? `<span>${escapeHtml(p.hours)}</span>` : "";
  const remarks = p.remarks ? `<p class="remarks">${escapeHtml(p.remarks)}</p>` : "";
  return `
    <article class="card ${dayClass}">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta">${dayBadge}${hours}${dur}</div>
      ${remarks}
      <div class="actions">
        <a class="btn" href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// --- day views ---
const SLOT_LABEL = {
  breakfast: "Breakfast 早餐",
  lunch: "Lunch 午餐",
  dinner: "Dinner 晚餐",
  snack: "Snack",
  dessert: "Dessert / 蛋糕",
  "late-night": "Late-night 宵夜",
  drinks: "Drinks",
  souvenir: "Souvenir 手信",
  entertainment: "Entertainment 玩",
  stay: "Stay"
};

function renderDayView(dayNumber, containerEl) {
  const dayPlaces = sortDaySchedule(groupByDay(places)[dayNumber]);

  // Pick one primary per mealType; rest become alternatives.
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

  containerEl.innerHTML = primaries.map(p => {
    const alts = altsByMeal[p.mealType] || [];
    const altsHtml = alts.length === 0 ? "" : `
      <details class="alternatives">
        <summary>${alts.length} alternative${alts.length > 1 ? "s" : ""}</summary>
        ${alts.map(a => renderCardHtml(a)).join("")}
      </details>
    `;
    return `
      <div class="slot">
        <div class="meta" style="margin:14px 0 6px;font-weight:600;color:#444">
          ${SLOT_LABEL[p.mealType] || p.mealType}
        </div>
        ${renderCardHtml(p)}
        ${altsHtml}
      </div>
    `;
  }).join("") || `<p style="color:#666">No places assigned to Day ${dayNumber}.</p>`;
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
  { key: "airbnb", label: "Airbnb" }
];

let allFilter = "all";

function renderAllView() {
  const filtered = allFilter === "all"
    ? places
    : places.filter(p => p.category === allFilter);
  const chips = CATEGORIES.map(c => `
    <button class="chip" data-cat="${c.key}" aria-pressed="${c.key === allFilter}">${c.label}</button>
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

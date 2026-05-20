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

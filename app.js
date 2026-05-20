import { groupByDay, sortDaySchedule } from "./lib/grouping.mjs";
import { buildSchedule, fmtTime } from "./lib/timeline.mjs";

const places = await fetch("./places.json").then(r => r.json());

const ICON = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14"/><path d="M5 17v-4l2-5h10l2 5v4"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"/></svg>'
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
  for (const t of tabs) t.setAttribute("aria-selected", t.dataset.view === name ? "true" : "false");
  for (const [key, el] of Object.entries(views)) el.classList.toggle("active", key === name);
  if (name === "map" && window.__map) window.__map.invalidateSize();
}
for (const t of tabs) t.addEventListener("click", () => selectTab(t.dataset.view));

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
  sheetBody.innerHTML = renderCardHtml(p, { showDayBadge: true, large: true });
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

function renderPhoto(p, large = false) {
  if (!p.photo) return "";
  return `<div class="photo${large ? ' photo-lg' : ''}" style="background-image:url('${p.photo}')"></div>`;
}

function renderCardHtml(p, { showDayBadge = false, hideKicker = false, large = false, time = null } = {}) {
  const dayClass = p.category === "airbnb" ? "airbnb" : (p.day ? `day-${p.day}` : "");
  const slot = SLOT_LABEL[p.mealType] || p.mealType;
  let kicker = "";
  if (!hideKicker) {
    const parts = [];
    if (showDayBadge) parts.push(dayLabelFor(p));
    parts.push(slot);
    kicker = `<div class="kicker"><span class="dot"></span>${parts.map(escapeHtml).join(" · ")}</div>`;
  }
  const timeBadge = time ? `<div class="time-badge">${escapeHtml(time)}</div>` : "";
  const metaParts = [];
  if (p.hours) metaParts.push(`<span class="meta-item">${ICON.clock}${escapeHtml(p.hours)}</span>`);
  if (p.durationFromAirbnbMin != null) metaParts.push(`<span class="meta-item">${ICON.car}${p.durationFromAirbnbMin} min from Airbnb</span>`);
  const meta = metaParts.length ? `<div class="meta">${metaParts.join("")}</div>` : "";
  const remarks = p.remarks ? `<p class="remarks">${highlightReservation(escapeHtml(p.remarks))}</p>` : "";
  return `
    <article class="card ${dayClass}">
      ${renderPhoto(p, large)}
      <div class="card-body">
        ${timeBadge}
        ${kicker}
        <h3>${escapeHtml(p.name)}</h3>
        ${meta}
        ${remarks}
        <div class="actions">
          <a class="btn" href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Google Maps ${ICON.external}</a>
        </div>
      </div>
    </article>
  `;
}

function highlightReservation(s) {
  return s.replace(/RESERVATION NEEDED/g, "<strong>RESERVATION NEEDED</strong>");
}

function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- day views (timeline) ---
const DAY_SUBTITLE = {
  1: "Meet in Seremban · check in Melaka 3pm",
  2: "Full day · explore",
  3: "Final morning · check-out 11am"
};

function googleMapsRouteUrl(stops) {
  // https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=...&destination=...&waypoints=...
  if (stops.length < 2) return null;
  const coord = p => `${p.lat},${p.lng}`;
  const origin = coord(stops[0]);
  const destination = coord(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(coord).join("|");
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin,
    destination
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function renderDayView(dayNumber, containerEl) {
  const dayPlaces = sortDaySchedule(groupByDay(places)[dayNumber]);
  // Pick one primary per mealType; rest become alternatives.
  const seenMeal = new Set();
  const primaries = [];
  const altsByMeal = {};
  for (const p of dayPlaces) {
    if (seenMeal.has(p.mealType)) (altsByMeal[p.mealType] ||= []).push(p);
    else { seenMeal.add(p.mealType); primaries.push(p); }
  }

  const schedule = buildSchedule(primaries, dayNumber);

  // Route button: include airbnb as origin and/or destination depending on day.
  // Day 1 starts in Seremban (not Airbnb), so first primary is the origin.
  // If airbnb is already among the primaries (e.g. Day 1 check-in stop), don't duplicate.
  const airbnb = places.find(p => p.category === "airbnb");
  const airbnbInPrimaries = primaries.some(p => p.category === "airbnb");
  let stopsForRoute = primaries.slice();
  if (airbnb) {
    if (dayNumber !== 1 && !airbnbInPrimaries) stopsForRoute = [airbnb, ...stopsForRoute];
    if (!airbnbInPrimaries) stopsForRoute.push(airbnb);
  }
  const routeUrl = googleMapsRouteUrl(stopsForRoute);
  const totalMin = schedule.endMin - schedule.startMin;
  const totalHrs = Math.floor(totalMin / 60);
  const totalRemainder = totalMin % 60;
  const totalStr = `${totalHrs}h ${totalRemainder}m`;

  const intro = `
    <div class="day-intro">
      <div class="day-intro-row">
        <div>
          <p class="day-title">Day ${dayNumber}</p>
          <p class="day-sub">${escapeHtml(DAY_SUBTITLE[dayNumber] || "")}</p>
        </div>
        <div class="day-stats">
          <div class="day-stat">
            <div class="day-stat-num">${primaries.length}</div>
            <div class="day-stat-label">stops</div>
          </div>
          <div class="day-stat">
            <div class="day-stat-num">${totalStr}</div>
            <div class="day-stat-label">total</div>
          </div>
        </div>
      </div>
      ${routeUrl ? `<a class="route-btn" href="${routeUrl}" target="_blank" rel="noopener">${ICON.route} Open full day route in Google Maps</a>` : ""}
    </div>
  `;

  if (primaries.length === 0) {
    containerEl.innerHTML = intro + `<p class="empty">No places assigned to Day ${dayNumber}.</p>`;
    return;
  }

  const body = schedule.steps.map(step => {
    const p = step.place;
    const alts = altsByMeal[p.mealType] || [];
    const choices = [p, ...alts];
    const driveChip = step.driveToNext != null ? `
      <div class="drive-chip">${ICON.car}<span>${step.driveToNext} min drive</span></div>
    ` : "";
    const waitChip = step.waitMin > 0 ? `
      <div class="wait-chip"><span>Free time · ${fmtDuration(step.waitMin)} until ${fmtTime(step.arriveMin)}</span></div>
    ` : "";
    const choicesLabel = choices.length > 1
      ? `<span class="slot-choices">${choices.length} choices</span>`
      : "";
    return `
      <div class="slot timeline-slot">
        ${waitChip}
        <div class="slot-heading">
          <span class="slot-dot"></span>
          <span class="slot-label">${escapeHtml(SLOT_LABEL[p.mealType] || p.mealType)}</span>
          ${choicesLabel}
          <span class="slot-time">${escapeHtml(fmtTime(step.arriveMin))}</span>
        </div>
        ${choices.map(c => renderCardHtml(c, { hideKicker: true })).join("")}
        ${driveChip}
      </div>
    `;
  }).join("");

  containerEl.innerHTML = intro + `<div class="timeline">${body}</div>`;
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
function countFor(key) { return key === "all" ? places.length : places.filter(p => p.category === key).length; }
function renderAllView() {
  const filtered = allFilter === "all" ? places : places.filter(p => p.category === allFilter);
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
    chip.addEventListener("click", () => { allFilter = chip.dataset.cat; renderAllView(); });
  }
}
renderAllView();

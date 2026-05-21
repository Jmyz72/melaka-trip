import { groupByDay, sortDaySchedule } from "./lib/grouping.mjs";
import { buildSchedule, fmtTime, haversineKm, setDriveTable } from "./lib/timeline.mjs";
import { parseHours, checkVisit, fmtClock } from "./lib/hours.mjs";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const places = await fetch("./places.json").then(r => r.json());

// Optional: load real Google drive times if a precomputed table is present.
// Built by `node tools/precompute-drives.mjs` with GOOGLE_MAPS_API_KEY set.
// Absence is fine — driveMinutes() falls back to the haversine heuristic.
try {
  const r = await fetch("./lib/drives.json", { cache: "no-store" });
  if (r.ok) setDriveTable(await r.json());
} catch { /* offline / not built — use haversine */ }

// ─── Firebase (voting) ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAQyLGKURTB64x_a038gdYTxCGHYDszhj4",
  authDomain: "project-21c844a6-e5cc-4a62-920.firebaseapp.com",
  projectId: "project-21c844a6-e5cc-4a62-920",
  storageBucket: "project-21c844a6-e5cc-4a62-920.firebasestorage.app",
  messagingSenderId: "810424813381",
  appId: "1:810424813381:web:a390e6227e83c3be2be02c"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

function getUserId() {
  let uid = localStorage.getItem("melaka_uid");
  if (!uid) {
    uid = crypto.randomUUID ? crypto.randomUUID() : "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("melaka_uid", uid);
  }
  return uid;
}
const userId = getUserId();

let votesByPlace = {};
function updateAllVoteButtons() {
  for (const btn of document.querySelectorAll("[data-vote-place]")) {
    const placeId = btn.dataset.votePlace;
    const v = votesByPlace[placeId] || { count: 0, voted: false };
    btn.setAttribute("aria-pressed", v.voted ? "true" : "false");
    const countEl = btn.querySelector(".vote-count");
    if (countEl) countEl.textContent = v.count;
  }
}
onSnapshot(collection(db, "votes"), (snap) => {
  votesByPlace = {};
  snap.forEach(d => {
    const voters = d.data().voters || [];
    votesByPlace[d.id] = { count: voters.length, voted: voters.includes(userId) };
  });
  applyVoteSnapshot();
});

function votesOf(id) { return votesByPlace[id]?.count || 0; }

// Tracks the currently rendered leader per (day:mealType). Used by the
// snapshot handler to decide between a cheap vote-button refresh and a full
// re-render (only needed when a leader actually flips).
const currentLeaders = new Map();
function leaderKey(dayNum, meal) { return `${dayNum}:${meal}`; }

// Compute what the leader would be RIGHT NOW for a given (day, meal),
// using current votesByPlace.
function computeLeaderId(dayNum, meal) {
  const candidates = (groupByDay(places)[dayNum] || []).filter(p => p.mealType === meal);
  if (candidates.length === 0) return null;
  const closedScore = p => contenderStatus(p, dayNum) === "closed" ? 1 : 0;
  candidates.sort((a, b) => {
    const dv = votesOf(b.id) - votesOf(a.id);
    if (dv !== 0) return dv;
    const dc = closedScore(a) - closedScore(b);
    if (dc !== 0) return dc;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  return candidates[0].id;
}

// On every snapshot: always refresh button counts (cheap). Only re-render
// the day/index views if a slot leader has flipped (expensive — destroys
// and rebuilds ~120 DOM nodes plus images).
function applyVoteSnapshot() {
  updateAllVoteButtons();
  let leaderFlipped = false;
  for (const [key, leaderId] of currentLeaders) {
    const [d, meal] = key.split(":");
    if (computeLeaderId(Number(d), meal) !== leaderId) { leaderFlipped = true; break; }
  }
  if (leaderFlipped) rerenderAll();
}

function rerenderAll() {
  renderDayView(1, views.day1);
  renderDayView(2, views.day2);
  renderDayView(3, views.day3);
  renderAllView();
  updateAllVoteButtons();
}
async function toggleVote(placeId) {
  const ref = doc(db, "votes", placeId);
  const v = votesByPlace[placeId] || { count: 0, voted: false };
  try {
    if (v.voted) await updateDoc(ref, { voters: arrayRemove(userId) });
    else await setDoc(ref, { voters: arrayUnion(userId) }, { merge: true });
  } catch (e) { console.error("vote failed", e); }
}
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-vote-place]");
  if (btn) { e.preventDefault(); e.stopPropagation(); toggleVote(btn.dataset.votePlace); }
});

// ─── Icons ──────────────────────────────────────────────────────
const ICON = {
  clock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  car:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14"/><path d="M5 17v-4l2-5h10l2 5v4"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  arrowDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  route:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"/></svg>',
  heart:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
};

const SLOT_LABEL = {
  breakfast: "Breakfast · 早餐",
  lunch:     "Lunch · 午餐",
  dinner:    "Dinner · 晚餐",
  snack:     "Snack",
  dessert:   "Dessert · 蛋糕",
  "late-night": "Late-night · 宵夜",
  drinks:    "Drinks",
  souvenir:  "Souvenir · 手信",
  entertainment: "An outing · 玩",
  stay:      "Stay · 住宿"
};

const DAY_DEK = {
  1: "Meeting in Seremban; the long drive south; first dinner by the sea.",
  2: "A full day, mostly unhurried. Jonker, satay celup, dessert at dusk.",
  3: "One final breakfast. A round of souvenirs. The road home before noon."
};
const DAY_ROMAN = { 1: "One", 2: "Two", 3: "Three" };

// Trip is 22-24 May 2026 (Fri/Sat/Sun). dow is 1=Mon … 7=Sun.
const TRIP_DAYS = {
  1: { date: "22 May", dowName: "Friday",   dow: 5 },
  2: { date: "23 May", dowName: "Saturday", dow: 6 },
  3: { date: "24 May", dowName: "Sunday",   dow: 7 }
};

// Pre-parse hours once at load time so we don't re-parse on every render.
const hoursById = Object.fromEntries(places.map(p => [p.id, parseHours(p.hours)]));

// ─── String utilities ───────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// Split a bilingual place name into { cn, main }. Handles common patterns:
//   "芙蓉大巴刹 Seremban Central Market" → { cn: "芙蓉大巴刹", main: "Seremban Central Market" }
//   "Seremban Central Market"             → { cn: null, main: "Seremban Central Market" }
//   "大树下鸭面"                            → { cn: "大树下鸭面", main: "Duck Noodles" } ← falls back to main = original
// If the split would be lossy (mixed CJK + latin in messy ways), return cn:null, main:original.
const CJK = "\\u3400-\\u9FFF\\u3000-\\u303F";
const CJK_RE = new RegExp(`[${CJK}]`);
function splitName(name) {
  // Leading CJK run followed by latin script — clean split.
  const leading = name.match(new RegExp(`^([${CJK}][${CJK} ·]*?)\\s+([A-Za-z].+)$`));
  if (leading && !CJK_RE.test(leading[2])) return { cn: leading[1].trim(), main: leading[2].trim() };
  // Trailing CJK run after latin script — clean split.
  const trailing = name.match(new RegExp(`^([A-Za-z][^${CJK}]*?)\\s+([${CJK}][${CJK} ·]*)$`));
  if (trailing) return { cn: trailing[2].trim(), main: trailing[1].trim() };
  return { cn: null, main: name };
}

function fmtTimeRich(min) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "pm" : "am";
  let h = h24 % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")}<small>${period}</small>`;
}

// ─── Tabs ───────────────────────────────────────────────────────
const tabs = document.querySelectorAll(".contents .tab");
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
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
for (const t of tabs) t.addEventListener("click", () => selectTab(t.dataset.view));

// ─── Map ────────────────────────────────────────────────────────
const DAY_COLOR = { 1: "#a83423", 2: "#2f5e4a", 3: "#2c3e63" };
const AIRBNB_COLOR = "#8a6618";
const UNASSIGNED_COLOR = "#9b8458";
function colorFor(p) {
  if (p.category === "airbnb") return AIRBNB_COLOR;
  if (p.day === 1 || p.day === 2 || p.day === 3) return DAY_COLOR[p.day];
  return UNASSIGNED_COLOR;
}
function makeIcon(p) {
  const color = colorFor(p);
  const isAirbnb = p.category === "airbnb";
  const size = isAirbnb ? 30 : 22;
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
map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [40, 40] });

// ─── Place renderers ────────────────────────────────────────────
function dayKickerLabel(p) {
  if (p.category === "airbnb") return "Airbnb · home base";
  return `Day ${p.day || "—"} · ${SLOT_LABEL[p.mealType] || p.mealType}`;
}

function isReservation(text) {
  return /RESERVATION NEEDED/i.test(text || "");
}

function renderFacts(p) {
  const facts = [];
  if (p.hours) facts.push(`<span class="place-fact">${ICON.clock}<span>${escapeHtml(p.hours)}</span></span>`);
  if (p.durationFromAirbnbMin != null) facts.push(`<span class="place-fact">${ICON.car}<span><b>${p.durationFromAirbnbMin} min</b> from Airbnb</span></span>`);
  return facts.length ? `<div class="place-facts">${facts.join("")}</div>` : "";
}

// Render a hours-vs-arrival warning for the leader card. Returns "" when
// the visit looks fine (open with healthy margin) or the hours weren't
// parseable. The warning sits above the place card so it's hard to miss.
function renderHoursWarning(p, dayNumber, arriveMin, departMin) {
  const hours = hoursById[p.id];
  const trip = TRIP_DAYS[dayNumber];
  if (!hours || !trip) return "";
  const v = checkVisit(hours, trip.dow, arriveMin, departMin);
  switch (v.status) {
    case "closed-today":
      return `<div class="hours-warning sev-bad"><b>Closed ${escapeHtml(trip.dowName)}</b> — pick another option in this slot.</div>`;
    case "arrive-before-open":
      return `<div class="hours-warning sev-warn"><b>Opens at ${fmtClock(v.openMin)}</b> — you arrive ${v.opensIn} min early. Plan a buffer.</div>`;
    case "arrive-after-close":
      return `<div class="hours-warning sev-bad"><b>Already closed</b> by the time you arrive (closes ${fmtClock(v.closeMin)}).</div>`;
    case "closing-soon":
      return `<div class="hours-warning sev-warn"><b>Closing soon</b> — only ${v.marginMin} min before they shut at ${fmtClock(v.closeMin)}.</div>`;
    case "between-service":
      return `<div class="hours-warning sev-bad"><b>Between service hours</b> — they reopen at ${fmtClock(v.opensAt)} (in ${v.opensIn} min). Pick another option or shift the time.</div>`;
    case "unknown":
    case "open":
    default:
      return "";
  }
}

// Quick "is this contender closed today?" check — used to dim the photo
// and overlay a CLOSED ribbon so voters don't promote something shut.
function contenderStatus(p, dayNumber) {
  const hours = hoursById[p.id];
  const trip = TRIP_DAYS[dayNumber];
  if (!hours || !trip || !hours.parsed) return null;
  const intervals = hours.byDow[trip.dow];
  if (intervals == null) return null;
  if (intervals.length === 0) return "closed";
  return "open";
}

// Pretty-print a duration in minutes: 75 → "1h 15m", 25 → "25m"
function fmtDuration(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Informational closing-margin chip beneath the place name (only when the
// warning didn't already fire). Tells you "you leave 3h before they shut".
function renderClosingMargin(p, dayNumber, arriveMin, departMin) {
  const hours = hoursById[p.id];
  const trip = TRIP_DAYS[dayNumber];
  if (!hours || !hours.parsed || !trip) return "";
  const v = checkVisit(hours, trip.dow, arriveMin, departMin);
  if (v.status !== "open") return ""; // bad cases handled by the warning
  return `
    <div class="closes-at">
      Closes <b>${fmtClock(v.closeMin)}</b> · ${fmtDuration(v.marginMin)} margin after we leave
    </div>
  `;
}

function renderRemark(p, { drop = false } = {}) {
  if (!p.remarks) return "";
  if (isReservation(p.remarks)) {
    const clean = p.remarks.replace(/RESERVATION NEEDED/gi, "A reservation is required");
    return `<p class="editor-note">${escapeHtml(clean)}</p>`;
  }
  return `<p class="place-remark${drop ? ' dropcap' : ''}">${escapeHtml(p.remarks)}</p>`;
}

// Full editorial place card (used in itinerary and sheet)
function renderPlace(p, { dropcap = false, leading = false } = {}) {
  const { cn, main } = splitName(p.name);
  const badge = leading ? `<span class="leading-badge">★ Leading choice</span>` : "";
  const photo = p.photo
    ? `<figure class="place-photo">
         <img src="${escapeHtml(p.photo)}" alt="${escapeHtml(main)}" loading="lazy"/>
         ${badge}
       </figure>`
    : "";
  const heading = `
    <h3 class="place-name">${escapeHtml(main)}${cn ? `<span class="cn">${escapeHtml(cn)}</span>` : ""}</h3>
  `;
  return `
    <article class="place">
      ${photo}
      ${heading}
      ${renderRemark(p, { drop: dropcap })}
      ${renderFacts(p)}
      <div class="place-actions">
        <a class="action-link" href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Maps ${ICON.external}</a>
        <button class="vote-btn" data-vote-place="${p.id}" aria-pressed="false" aria-label="Vote for ${escapeHtml(main)}">
          ${ICON.heart}<span class="vote-count">0</span>
        </button>
      </div>
    </article>
  `;
}

// Horizontal row of other choices in the same slot. Voting on a card
// promotes it — if its vote count overtakes the leader, the next render
// makes it the featured (big) card.
function renderOthers(others, dayNumber) {
  return `
    <div class="contenders">
      <div class="contenders-head">
        <span class="contenders-label">Other choices for this slot</span>
        <span class="contenders-hint">vote to feature →</span>
      </div>
      <div class="contenders-rail">
        ${others.map(p => renderContender(p, dayNumber)).join("")}
      </div>
    </div>
  `;
}

function renderContender(p, dayNumber) {
  const { cn, main } = splitName(p.name);
  const photoStyle = p.photo ? `background-image:url('${escapeHtml(p.photo)}')` : "";
  const remarkLine = p.remarks ? `<p class="contender-remark">${escapeHtml(p.remarks)}</p>` : "";
  const status = contenderStatus(p, dayNumber);
  const closedBadge = status === "closed"
    ? `<span class="contender-closed">Closed ${escapeHtml(TRIP_DAYS[dayNumber].dowName)}</span>`
    : "";
  const photoCls = status === "closed" ? "contender-photo is-closed" : "contender-photo";
  return `
    <article class="contender">
      <button class="${photoCls}" data-vote-place="${p.id}" aria-pressed="false" aria-label="Vote for ${escapeHtml(main)}" style="${photoStyle}">
        ${closedBadge}
        <span class="contender-vote">${ICON.heart}<span class="vote-count">0</span></span>
      </button>
      <h4 class="contender-name">${escapeHtml(main)}${cn ? `<span class="cn">${escapeHtml(cn)}</span>` : ""}</h4>
      ${remarkLine}
      <a class="contender-map" href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </article>
  `;
}

// ─── Route helpers ──────────────────────────────────────────────
function googleMapsRouteUrl(stops) {
  if (stops.length < 2) return null;
  const coord = p => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: coord(stops[0]),
    destination: coord(stops[stops.length - 1])
  });
  const wp = stops.slice(1, -1).map(coord).join("|");
  if (wp) params.set("waypoints", wp);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function bridgeText(driveMin, fromPlace, toPlace) {
  let km = null;
  if (fromPlace && toPlace && typeof fromPlace.lat === "number" && typeof toPlace.lat === "number") {
    km = haversineKm(fromPlace, toPlace);
  }
  const kmStr = km != null && km >= 0.1 ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : null;
  let phrase;
  if (km != null && km < 0.1) phrase = "the very same spot";
  else if (driveMin <= 3) phrase = "a quick hop next door";
  else if (driveMin <= 15) phrase = `a ${driveMin}-minute drive`;
  else if (driveMin < 60) phrase = `a ${driveMin}-minute drive across town`;
  else phrase = `a ${Math.floor(driveMin/60)}h ${driveMin%60}m drive south`;
  return `
    <div class="bridge">
      ${ICON.arrowDown}<span>${phrase}</span>${kmStr ? `<span class="km">${kmStr}</span>` : ""}
    </div>
  `;
}

// ─── Day View ───────────────────────────────────────────────────
function renderDayView(dayNumber, containerEl) {
  const dayPlaces = sortDaySchedule(groupByDay(places)[dayNumber]);

  // Group by mealType; preserve slot order from sorted day list.
  const slotOrder = [];
  const slotsByMeal = new Map();
  for (const p of dayPlaces) {
    if (!slotsByMeal.has(p.mealType)) {
      slotsByMeal.set(p.mealType, []);
      slotOrder.push(p.mealType);
    }
    slotsByMeal.get(p.mealType).push(p);
  }

  // Within each slot, the leader is whichever option has the most votes.
  // Tiebreaks: prefer a place that isn't closed today, then lowest `order`
  // (so the planner's default wins when nobody voted).
  const closedScore = p => contenderStatus(p, dayNumber) === "closed" ? 1 : 0;
  const slots = slotOrder.map(meal => {
    const list = slotsByMeal.get(meal);
    const sorted = [...list].sort((a, b) => {
      const dv = votesOf(b.id) - votesOf(a.id);
      if (dv !== 0) return dv;
      const dc = closedScore(a) - closedScore(b);
      if (dc !== 0) return dc;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    return { meal, leader: sorted[0], others: sorted.slice(1), total: sorted.length };
  });

  const primaries = slots.map(s => s.leader);
  const schedule = buildSchedule(primaries, dayNumber);

  // Remember who's currently leading each slot so snapshot handler can detect flips.
  for (const s of slots) currentLeaders.set(leaderKey(dayNumber, s.meal), s.leader.id);

  // Route stops: include Airbnb origin/dest where appropriate
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
  const totalRem = totalMin % 60;

  // Total drive minutes
  const totalDrive = schedule.steps.reduce((s, step) => s + (step.driveToNext || 0), 0);

  const headerHtml = `
    <header class="day-header">
      <div class="day-folio">Day <span class="accent">${String(dayNumber).padStart(2, "0")}</span> of 03 · ${escapeHtml(TRIP_DAYS[dayNumber]?.dowName || "")}</div>
      <h2 class="day-title">Day <span class="accent">${DAY_ROMAN[dayNumber]}</span></h2>
      <p class="day-dek">${escapeHtml(DAY_DEK[dayNumber] || "")}</p>
      <div class="day-meta">
        <div class="day-meta-cell">
          <div class="day-meta-num">${primaries.length}</div>
          <span class="day-meta-label">Stops</span>
        </div>
        <div class="day-meta-cell">
          <div class="day-meta-num">${totalHrs}<small>h</small> ${totalRem}<small>m</small></div>
          <span class="day-meta-label">Total</span>
        </div>
        <div class="day-meta-cell">
          <div class="day-meta-num">${totalDrive}<small>min</small></div>
          <span class="day-meta-label">Driving</span>
        </div>
      </div>
      ${routeUrl ? `<div class="day-route-wrap"><a class="day-route" href="${routeUrl}" target="_blank" rel="noopener">${ICON.route} Map the full day's route</a></div>` : ""}
    </header>
  `;

  if (primaries.length === 0) {
    containerEl.innerHTML = `<div class="day-spread">${headerHtml}<p class="empty">No places assigned to Day ${dayNumber}.</p></div>`;
    return;
  }

  const entries = schedule.steps.map((step, idx) => {
    const p = step.place;
    const slot = slots[idx];
    const others = slot.others;
    const warning = renderHoursWarning(p, dayNumber, step.arriveMin, step.departMin);
    const margin = renderClosingMargin(p, dayNumber, step.arriveMin, step.departMin);
    const next = schedule.steps[idx + 1];
    const driveHtml = step.driveToNext != null && next
      ? bridgeText(step.driveToNext, p, next.place)
      : "";

    // Free-time band: when the next stop's arrival was pushed back by a
    // meal anchor, you have idle time after the drive until that anchor.
    let freeBand = "";
    if (next && next.waitMin > 30) {
      const freeStart = step.departMin + (step.driveToNext || 0);
      const freeEnd = next.arriveMin;
      const freeMin = freeEnd - freeStart;
      freeBand = `
        <li class="entry entry-free" aria-label="Free time">
          <div class="entry-rail">
            <time class="entry-time">${fmtTimeRich(freeStart)}</time>
            <span class="entry-slot">Free time</span>
          </div>
          <div class="entry-body">
            <div class="free-band">
              <span class="free-band-duration">${fmtDuration(freeMin)}</span>
              <span class="free-band-detail">until ${fmtClock(freeEnd)} — coffee, rest, or improvise.</span>
            </div>
          </div>
        </li>
      `;
    }

    return `
      <li class="entry">
        <div class="entry-rail">
          <time class="entry-time">${fmtTimeRich(step.arriveMin)}</time>
          <span class="entry-slot">${escapeHtml(SLOT_LABEL[p.mealType] || p.mealType)}</span>
          ${others.length ? `<span class="entry-choices">${slot.total} choices</span>` : ""}
        </div>
        <div class="entry-body">
          ${warning}
          ${renderPlace(p, { dropcap: idx === 0, leading: others.length > 0 })}
          ${margin}
          ${others.length ? renderOthers(others, dayNumber) : ""}
        </div>
        ${driveHtml}
      </li>
      ${freeBand}
    `;
  }).join("");

  containerEl.innerHTML = `
    <div class="day-spread">
      ${headerHtml}
      <ol class="itinerary">${entries}</ol>
    </div>
  `;
}

renderDayView(1, views.day1);
renderDayView(2, views.day2);
renderDayView(3, views.day3);

// ─── Index (all places) view — grouped by meal/course ───────────
// Each group has: key, label (display), match (place predicate).
// Order matters — top to bottom matches the rhythm of a day.
const MEAL_GROUPS = [
  { key: "breakfast",     label: "Breakfast · 早餐",      match: p => p.mealType === "breakfast" },
  { key: "lunch",         label: "Lunch · 午餐",          match: p => p.mealType === "lunch" },
  { key: "dinner",        label: "Dinner · 晚餐",         match: p => p.mealType === "dinner" },
  { key: "supper",        label: "Late-night · 宵夜",     match: p => p.mealType === "late-night" },
  { key: "drinks",        label: "Drinks",                match: p => p.mealType === "drinks" },
  { key: "dessert",       label: "Dessert · 蛋糕",        match: p => p.mealType === "dessert" },
  { key: "snack",         label: "Snacks",                match: p => p.mealType === "snack" },
  { key: "entertainment", label: "Outings · 玩",          match: p => p.category === "entertainment" },
  { key: "souvenir",      label: "Souvenirs · 手信",      match: p => p.category === "souvenir" },
  { key: "stay",          label: "Stay · 住宿",           match: p => p.category === "airbnb" }
];

function renderIndexItem(p) {
  const { cn, main } = splitName(p.name);
  const dayCls = p.category === "airbnb" ? "" : (p.day ? `day-${p.day}` : "");
  return `
    <article class="index-item ${dayCls}">
      <div class="index-item-photo" style="${p.photo ? `background-image:url('${escapeHtml(p.photo)}')` : ""}"></div>
      <div class="index-item-body">
        <div class="index-item-kicker">${escapeHtml(dayKickerLabel(p))}</div>
        <h4>${escapeHtml(main)}${cn ? `<span class="cn">${escapeHtml(cn)}</span>` : ""}</h4>
        ${p.remarks ? `<p class="remark">${escapeHtml(p.remarks)}</p>` : ""}
        <div class="index-item-foot">
          <a href="${p.mapsUrl}" target="_blank" rel="noopener">Maps ↗</a>
          <button class="vote-btn" data-vote-place="${p.id}" aria-pressed="false" aria-label="Vote for ${escapeHtml(main)}">
            ${ICON.heart}<span class="vote-count">0</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderAllView() {
  const seen = new Set();
  const sections = MEAL_GROUPS.map(g => {
    const items = places
      .filter(p => g.match(p) && !seen.has(p.id))
      .sort((a, b) => (a.day ?? 9) - (b.day ?? 9) || (a.order ?? 0) - (b.order ?? 0));
    items.forEach(p => seen.add(p.id));
    if (items.length === 0) return "";
    return `
      <section class="index-day group-${g.key}">
        <header class="index-day-head">
          <h3>${escapeHtml(g.label)}</h3>
          <span class="index-day-count">${items.length} ${items.length === 1 ? "place" : "places"}</span>
        </header>
        <div class="index-list">${items.map(renderIndexItem).join("")}</div>
      </section>
    `;
  }).join("");

  // Any remaining unmatched places
  const leftovers = places.filter(p => !seen.has(p.id));
  const leftoverSection = leftovers.length ? `
    <section class="index-day">
      <header class="index-day-head">
        <h3>Other</h3>
        <span class="index-day-count">${leftovers.length}</span>
      </header>
      <div class="index-list">${leftovers.map(renderIndexItem).join("")}</div>
    </section>
  ` : "";

  views.all.innerHTML = `
    <div class="index-intro">
      <h2>The Index</h2>
      <p>Every place, sorted by course — breakfast through bedtime.</p>
    </div>
    ${sections}
    ${leftoverSection}
  `;
  updateAllVoteButtons();
}
renderAllView();
updateAllVoteButtons();

// ─── Sheet (place detail modal) ─────────────────────────────────
const sheet = document.getElementById("sheet");
const sheetBackdrop = document.getElementById("sheet-backdrop");
const sheetBody = document.getElementById("sheet-body");
const sheetKicker = document.getElementById("sheet-kicker");

function openSheet(p) {
  sheetKicker.textContent = dayKickerLabel(p);
  sheetBody.innerHTML = renderPlace(p);
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => sheetBackdrop.classList.add("open"));
  updateAllVoteButtons();
}
function closeSheet() {
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
  sheetBackdrop.classList.remove("open");
  setTimeout(() => { sheetBackdrop.hidden = true; }, 250);
}
document.getElementById("sheet-close").addEventListener("click", closeSheet);
sheetBackdrop.addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

// Leaflet wrapper for the memory book's sticky map header.
// Exports mountMap(container, stops, { onPinClick }).

import { splitName } from "./name.mjs";

// No-auth tile source so the map works on GitHub Pages (Stadia 401s without a
// key). CartoDB Voyager is free, no-auth, and the watercolor look is layered on
// top via the SVG `watercolor-edge` filter applied to the .map element in CSS.
const TILE_URL  = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Co-located moments (e.g. the same Airbnb base, returned to six times) sit on
// the same pixel and pile into an unreadable knot of pins + labels. Group any
// stops within ~80 m of one another into a single "home base" marker instead.
// 80 m ≈ 0.00072° at this latitude — tight enough to catch only true repeats.
const CLUSTER_RADIUS_DEG = 0.00072;

// Greedy proximity grouping, preserving trip order. Each cluster anchors on its
// first stop's coordinates (the stops are within metres, so the choice is
// cosmetic) and carries every stop that landed there. Pure — Node-testable.
export function clusterStops(stops, radiusDeg = CLUSTER_RADIUS_DEG) {
  const clusters = [];
  for (const stop of stops) {
    let target = null;
    for (const c of clusters) {
      if (Math.abs(c.lat - stop.lat) < radiusDeg &&
          Math.abs(c.lng - stop.lng) < radiusDeg) { target = c; break; }
    }
    if (target) target.stops.push(stop);
    else clusters.push({ lat: stop.lat, lng: stop.lng, stops: [stop] });
  }
  return clusters;
}

// The route line should still loop back to the base each time the trip returns
// there, so map every stop to its cluster anchor (in order) and drop only the
// consecutive repeats (a stay at one place is a point, not a segment). Pure.
export function routeLine(stops, clusters) {
  const anchorOf = new Map();
  for (const c of clusters) for (const s of c.stops) anchorOf.set(s, [c.lat, c.lng]);
  const path = [];
  for (const s of stops) {
    const a = anchorOf.get(s);
    const last = path[path.length - 1];
    if (!last || last[0] !== a[0] || last[1] !== a[1]) path.push(a);
  }
  return path;
}

function pinIcon(number) {
  return L.divIcon({
    className: "trip-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="trip-pin-inner">${number}</div>`
  });
}

// A distinct marker for the home base: a little house glyph + a ×N count chip.
function homeIcon(count) {
  return L.divIcon({
    className: "trip-pin trip-pin--home",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="trip-pin-inner trip-pin-inner--home">
             <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
               <path d="M3.5 11.5 12 4.5l8.5 7" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M5.5 10.2V19.5h13V10.2" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
             <span class="trip-pin-count">${count}</span>
           </div>`
  });
}

function tooltipHTML(stop) {
  const { main, cn } = splitName(stop.name);
  const cnPart = cn ? `<span class="trip-tip-cn">${cn}</span>` : "";
  return `
    <span class="trip-tip-time">${stop.time}</span>
    <span class="trip-tip-name">${main}${cnPart ? " " + cnPart : ""}</span>
  `;
}

// Concise permanent label for the base — one line, e.g. "Airbnb 民宿 · ×6".
function homeTooltipHTML(cluster) {
  const { main, cn } = splitName(cluster.stops[0].name);
  const cnPart = cn ? `<span class="trip-tip-cn">${cn}</span>` : "";
  return `
    <span class="trip-tip-name">${main}${cnPart ? " " + cnPart : ""}</span>
    <span class="trip-tip-count">×${cluster.stops.length}</span>
  `;
}

// Click-to-expand list of every moment spent at the base, each row scrolls to
// its stop. Rows carry data-stop-id; the map container delegates the clicks.
function homePopupHTML(cluster) {
  const { main, cn } = splitName(cluster.stops[0].name);
  const head = `${main}${cn ? ` <span class="trip-tip-cn">${cn}</span>` : ""}`;
  const rows = cluster.stops
    .map(s => {
      const { main: m } = splitName(s.name);
      return `<button type="button" class="trip-moment" data-stop-id="${s.id}">
                <span class="trip-moment-time">${s.time}</span>
                <span class="trip-moment-name">${m}</span>
              </button>`;
    })
    .join("");
  return `<div class="trip-pop">
            <div class="trip-pop-head">${head} <span class="trip-pop-base">home base</span></div>
            ${rows}
          </div>`;
}

// Cluster detection for the few non-base pins that still sit near each other:
// fan their permanent labels so they don't stack.
const FAN_DIRECTIONS = ["right", "top", "left", "bottom"];
function pickDirection(stop, placed) {
  let nearby = 0;
  for (const p of placed) {
    if (Math.abs(p.lat - stop.lat) < CLUSTER_RADIUS_DEG &&
        Math.abs(p.lng - stop.lng) < CLUSTER_RADIUS_DEG) nearby++;
  }
  return nearby === 0 ? "right" : FAN_DIRECTIONS[nearby % FAN_DIRECTIONS.length];
}

const DIR_OFFSETS = {
  right:  [14, 0],
  left:   [-14, 0],
  top:    [0, -14],
  bottom: [0, 14]
};

export function mountMap(container, stops, { onPinClick } = {}) {
  if (!stops.length) return null;

  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    zoomSnap: 0.25
  }).setView([2.1956, 102.2486], 13);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

  const numbered = stops.map((s, i) => ({ ...s, n: i + 1 }));
  const clusters = clusterStops(numbered);
  const byId = new Map(numbered.map(s => [s.id, s]));

  const placed = [];
  for (const c of clusters) {
    if (c.stops.length === 1) {
      const s = c.stops[0];
      const dir = pickDirection(s, placed);
      L.marker([s.lat, s.lng], { icon: pinIcon(s.n) })
        .addTo(map)
        .bindTooltip(tooltipHTML(s), {
          permanent: true,
          direction: dir,
          offset: DIR_OFFSETS[dir],
          className: "trip-tooltip",
          opacity: 1,
          interactive: false
        })
        .on("click", () => onPinClick && onPinClick(s));
      placed.push(s);
    } else {
      // Home base: one marker, concise label, click opens the moments popup.
      L.marker([c.lat, c.lng], { icon: homeIcon(c.stops.length), zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip(homeTooltipHTML(c), {
          permanent: true,
          direction: "right",
          offset: [16, 0],
          className: "trip-tooltip trip-tooltip--home",
          opacity: 1,
          interactive: false
        })
        .bindPopup(homePopupHTML(c), { className: "trip-popup", closeButton: true, offset: [0, -8] });
      placed.push({ lat: c.lat, lng: c.lng });
    }
  }

  // Moment rows inside the home popup scroll to their stop (popup content lives
  // inside the map container, so a single delegated listener covers it).
  container.addEventListener("click", (e) => {
    const row = e.target.closest(".trip-moment");
    if (!row) return;
    const s = byId.get(row.dataset.stopId);
    if (s && onPinClick) onPinClick(s);
  });

  L.polyline(routeLine(numbered, clusters), {
    color: "#b91c1c", weight: 2, opacity: 0.55, dashArray: "4,4"
  }).addTo(map);

  // Keep the existing framing: fit to every stop, padded so edge labels show.
  map.fitBounds(numbered.map(s => [s.lat, s.lng]), { padding: [70, 70] });
  return map;
}

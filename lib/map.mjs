// Leaflet wrapper for the memory book's sticky map header.
// Exports mountMap(container, stops, { onPinClick }).

import { splitName } from "./name.mjs";

// No-auth tile source so the map works on GitHub Pages (Stadia 401s without a
// key). CartoDB Voyager is free, no-auth, and the watercolor look is layered on
// top via the SVG `watercolor-edge` filter applied to the .map element in CSS.
const TILE_URL  = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function pinIcon(number) {
  return L.divIcon({
    className: "trip-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="trip-pin-inner">${number}</div>`
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

// Cluster detection: stops within ~80 m of an already-placed marker get a
// staggered direction so their permanent labels fan out instead of stacking.
// (80 m ≈ 0.00072° at this latitude — enough to catch the airbnb cluster
// while leaving distant stops alone.)
const CLUSTER_RADIUS_DEG = 0.00072;
const FAN_DIRECTIONS = ["right", "top", "left", "bottom"];

function pickDirection(stop, placed) {
  // Default: prefer right (label trails behind the pin), free of collisions.
  let nearby = 0;
  for (const p of placed) {
    const dLat = Math.abs(p.lat - stop.lat);
    const dLng = Math.abs(p.lng - stop.lng);
    if (dLat < CLUSTER_RADIUS_DEG && dLng < CLUSTER_RADIUS_DEG) nearby++;
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
    // Bumped from 13 — needed so the airbnb cluster pins resolve apart at
    // first paint instead of stacking. fitBounds later overrides this.
    zoomSnap: 0.25
  }).setView([2.1956, 102.2486], 13);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

  const numbered = stops.map((s, i) => ({ ...s, n: i + 1 }));
  const placed = [];
  for (const s of numbered) {
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
  }

  L.polyline(numbered.map(s => [s.lat, s.lng]), {
    color: "#b91c1c", weight: 2, opacity: 0.55, dashArray: "4,4"
  }).addTo(map);

  // Larger padding so permanent labels at the edge stops aren't clipped.
  map.fitBounds(numbered.map(s => [s.lat, s.lng]), { padding: [70, 70] });
  return map;
}

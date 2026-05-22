// Leaflet wrapper for the memory book's sticky map header.
// Exports mountMap(container, stops, { onPinClick }).

// No-auth tile source so the map works on GitHub Pages (Stadia 401s without a
// key). CartoDB Voyager is free, no-auth, and the watercolor look is layered on
// top via the SVG `watercolor-edge` filter applied to the .map element in CSS.
const TILE_URL  = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function pinIcon(number) {
  return L.divIcon({
    className: "trip-pin",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="trip-pin-inner">${number}</div>`
  });
}

export function mountMap(container, stops, { onPinClick } = {}) {
  if (!stops.length) return null;

  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([2.1956, 102.2486], 13);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);

  const numbered = stops.map((s, i) => ({ ...s, n: i + 1 }));
  for (const s of numbered) {
    L.marker([s.lat, s.lng], { icon: pinIcon(s.n) })
      .addTo(map)
      .on("click", () => onPinClick && onPinClick(s));
  }
  L.polyline(numbered.map(s => [s.lat, s.lng]), {
    color: "#b91c1c", weight: 2, opacity: 0.6, dashArray: "4,4"
  }).addTo(map);

  map.fitBounds(numbered.map(s => [s.lat, s.lng]), { padding: [30, 30] });
  return map;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterStops, routeLine } from "../lib/map.mjs";

// Six "moments" at one base + two distant stops, in trip order.
const base = (id, lat, lng) => ({ id, lat, lng });
const stops = [
  base("jinbo", 2.71268, 101.91184),   // far north outlier
  base("arrive", 2.19706, 102.23151),  // home base ×1
  base("dinner", 2.19700, 102.23133),  // home base ×2
  base("wildseed", 2.18196, 102.26271),// distinct
  base("late", 2.19666, 102.23116),    // home base ×3
  base("morning", 2.19690, 102.23130), // home base ×4
];

test("clusterStops groups co-located stops and keeps the rest separate", () => {
  const clusters = clusterStops(stops);
  // jinbo | home(4) | wildseed  → 3 clusters
  assert.equal(clusters.length, 3);
  const home = clusters.find(c => c.stops.length > 1);
  assert.equal(home.stops.length, 4);
  assert.deepEqual(
    home.stops.map(s => s.id),
    ["arrive", "dinner", "late", "morning"]
  );
});

test("clusterStops anchors on the first stop's coordinates", () => {
  const [, home] = clusterStops(stops);
  assert.equal(home.lat, 2.19706);
  assert.equal(home.lng, 102.23151);
});

test("routeLine threads through anchors and drops consecutive repeats", () => {
  const clusters = clusterStops(stops);
  const path = routeLine(stops, clusters);
  // jinbo → base → wildseed → base : the base's internal repeats collapse,
  // but it reappears after wildseed (the trip returned home).
  assert.deepEqual(path, [
    [2.71268, 101.91184],
    [2.19706, 102.23151],
    [2.18196, 102.26271],
    [2.19706, 102.23151],
  ]);
});

test("a trip with no repeats yields one route point per stop", () => {
  const spread = [
    base("a", 2.10, 102.10),
    base("b", 2.20, 102.20),
    base("c", 2.30, 102.30),
  ];
  const clusters = clusterStops(spread);
  assert.equal(clusters.length, 3);
  assert.equal(routeLine(spread, clusters).length, 3);
});

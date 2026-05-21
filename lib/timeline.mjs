// Dwell minutes per meal type — rough sit-down + eat / activity time.
export const DWELL_MIN = {
  breakfast: 45,
  lunch: 60,
  dinner: 75,
  snack: 20,
  dessert: 25,
  "late-night": 45,
  drinks: 60,
  souvenir: 20,
  entertainment: 90,
  "night-market": 90,
  stay: 0
};

// Day start clock (minutes from midnight). The actual arrival time of the first
// stop is max(this, MEAL_START_MIN[firstMealType]).
export const DAY_START_MIN = {
  1: 8 * 60,       // 8:00 AM (drive from Seremban begins early; breakfast still at 10)
  2: 9 * 60,       // 9:00 AM
  3: 11 * 60       // 11:00 AM (Airbnb checkout deadline — pack/sleep-in before)
};

// Fixed meal slot anchors — meals never start earlier than these clocks. If the
// schedule arrives early, a "free time" buffer appears. Mealtypes not listed
// keep flowing from the previous stop.
export const MEAL_START_MIN = {
  breakfast: 10 * 60,       // 10:00 AM
  lunch: 13 * 60,           // 1:00 PM
  dinner: 19 * 60,          // 7:00 PM
  "late-night": 22 * 60,    // 10:00 PM
  "night-market": 18 * 60   // 6:00 PM (Jonker opens then; before is daylight)
};

// Haversine distance in km between two lat/lng pairs.
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Optional override table populated from a precomputed `lib/drives.json`
// (built by tools/precompute-drives.mjs against the Google Distance Matrix).
// Keyed by `${fromId}__${toId}` → minutes.
let driveOverride = new Map();
export function setDriveTable(table) {
  driveOverride = new Map(Object.entries(table || {}));
}
export function hasDriveTable() { return driveOverride.size > 0; }

// Drive time. If a precomputed Google estimate exists for this pair, use it
// (much more accurate than geometry). Otherwise fall back to a haversine
// heuristic: short distances assume Melaka city driving (~17 km/h with
// winding factor + parking buffer); long distances (>15km) assume mostly
// highway (~90 km/h with on/off ramp + traffic buffer).
export function driveMinutes(a, b) {
  if (!a || !b) return null;
  if (a.id && b.id) {
    const key = `${a.id}__${b.id}`;
    if (driveOverride.has(key)) return driveOverride.get(key);
  }
  if (typeof a.lat !== "number" || typeof b.lat !== "number") return null;
  const km = haversineKm(a, b);
  if (km > 15) {
    return Math.max(20, Math.round((km / 90) * 60 + 10));
  }
  return Math.max(2, Math.round(km * 1.4 * 2.5 + 1));
}

// Format minutes-from-midnight as "9:00am" / "12:30pm" / "10:15pm".
export function fmtTime(min) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "pm" : "am";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")}${period}`;
}

// Build a schedule for a day: arrival/departure per stop, drive minutes between
// consecutive stops, and optional wait time before a stop when its `minArriveMin`
// forces a later arrival (e.g. Airbnb check-in is no earlier than 3pm).
// Per-place overrides: `dwellMin` (custom dwell), `minArriveMin` (hard arrive floor).
export function buildSchedule(dayPlaces, dayNumber) {
  const startMin = DAY_START_MIN[dayNumber] ?? 9 * 60;
  let clock = startMin;
  const steps = [];
  for (let i = 0; i < dayPlaces.length; i++) {
    const p = dayPlaces[i];
    const dwell = p.dwellMin ?? DWELL_MIN[p.mealType] ?? 30;
    const earliestArrive = Math.max(
      p.minArriveMin ?? 0,
      MEAL_START_MIN[p.mealType] ?? 0
    );
    const waitMin = Math.max(0, earliestArrive - clock);
    const arriveMin = clock + waitMin;
    const departMin = arriveMin + dwell;
    steps.push({ place: p, arriveMin, departMin, dwell, waitMin });
    clock = departMin;
    const next = dayPlaces[i + 1];
    if (next) {
      const drive = driveMinutes(p, next);
      if (drive != null) {
        steps[steps.length - 1].driveToNext = drive;
        clock += drive;
      }
    }
  }
  return { startMin, endMin: clock, steps };
}

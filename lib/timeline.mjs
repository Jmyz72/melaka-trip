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
  stay: 0
};

// Day start clock (minutes from midnight).
export const DAY_START_MIN = {
  1: 8 * 60,       // 8:00 AM (meet in Seremban for breakfast)
  2: 8 * 60 + 30,  // 8:30 AM
  3: 7 * 60 + 30   // 7:30 AM
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

// Drive time heuristic. Short distances assume Melaka city driving (~17 km/h with
// winding factor + parking buffer). Long distances (>15km) assume mostly highway
// (~90 km/h with on/off ramp + traffic buffer).
export function driveMinutes(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof b.lat !== "number") return null;
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

// Build a schedule for a day: arrival time + departure time per stop, plus drive
// minutes between consecutive stops. Skips the airbnb (treated as start anchor).
export function buildSchedule(dayPlaces, dayNumber) {
  const startMin = DAY_START_MIN[dayNumber] ?? 9 * 60;
  let clock = startMin;
  const steps = [];
  for (let i = 0; i < dayPlaces.length; i++) {
    const p = dayPlaces[i];
    const dwell = DWELL_MIN[p.mealType] ?? 30;
    const arriveMin = clock;
    const departMin = clock + dwell;
    steps.push({ place: p, arriveMin, departMin, dwell });
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

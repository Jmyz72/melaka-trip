// Pure recommendation logic for the "Now" view. Given the current time
// (and optionally GPS coords), rank all places by openness + meal-fit
// + proximity + votes, and return the top pick plus alternatives.
//
// Times are minutes-from-midnight everywhere, matching lib/hours.mjs
// and lib/timeline.mjs. Day-of-week is 1=Mon … 7=Sun.

const BANDS = [
  { name: "breakfast",   from:  7 * 60, to: 11 * 60 },
  { name: "lunch",       from: 11 * 60, to: 14 * 60 + 30 },
  { name: "dessert",     from: 14 * 60 + 30, to: 17 * 60 + 30 },
  { name: "dinner",      from: 17 * 60 + 30, to: 21 * 60 + 30 },
  { name: "late-night",  from: 21 * 60 + 30, to: 24 * 60 + 2 * 60 } // wraps past midnight
];

export function currentMealBand(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  for (const b of BANDS) {
    if (b.to <= 1440) {
      if (m >= b.from && m < b.to) return b.name;
    } else {
      if (m >= b.from || m < b.to - 1440) return b.name;
    }
  }
  return null;
}

// Trip is 22-24 May 2026, Asia/Kuala_Lumpur (UTC+8). Pre-trip ends at the
// start of 22 May local; post-trip begins after end-of-day on 24 May local.
const TRIP_START_MS = Date.UTC(2026, 4, 22, -8, 0, 0); // 22 May 2026 00:00 +08:00
const TRIP_END_MS   = Date.UTC(2026, 4, 25, -8, 0, 0); // 25 May 2026 00:00 +08:00 (exclusive)

export function tripPhase(now) {
  const t = now.getTime();
  if (t < TRIP_START_MS) return { phase: "pre-trip", dayNumber: null, dow: null };
  if (t >= TRIP_END_MS)  return { phase: "post-trip", dayNumber: null, dow: null };
  const dayMs = 24 * 60 * 60 * 1000;
  const dayNumber = Math.floor((t - TRIP_START_MS) / dayMs) + 1;
  const dow = 4 + dayNumber; // Fri=5, Sat=6, Sun=7
  return { phase: "in-trip", dayNumber, dow };
}

export function minutesInKL(now) {
  const klMs = now.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(klMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

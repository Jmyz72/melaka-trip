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

import { parseHours, checkVisit } from "./hours.mjs";
import { haversineKm } from "./timeline.mjs";

// Score weights — tweakable in one place.
const W_MEAL_EXACT     = 1.0;
const W_MEAL_ADJACENT  = 0.2;
const W_VOTES_CAP      = 4;
const W_VOTES_PER      = 0.1;
const W_CLOSING_SOON   = -0.3;
const W_DIST_MAX       = 1.0;
const DIST_FALLOFF_KM  = 8;

const ADJ = {
  breakfast:    ["lunch"],
  lunch:        ["breakfast", "dessert"],
  dessert:      ["lunch", "dinner", "snack"],
  snack:        ["dessert", "lunch"],
  dinner:       ["dessert", "drinks", "late-night"],
  drinks:       ["dinner", "late-night"],
  "late-night": ["drinks", "dinner"]
};

function mealFitScore(placeMeal, currentBand) {
  if (!currentBand) return 0;
  if (placeMeal === currentBand) return W_MEAL_EXACT;
  if (placeMeal === "souvenir" || placeMeal === "entertainment") return W_MEAL_ADJACENT;
  if ((ADJ[currentBand] || []).includes(placeMeal)) return W_MEAL_ADJACENT;
  return 0;
}

function distanceScore(distKm) {
  if (distKm == null) return 0;
  const t = Math.max(0, 1 - distKm / DIST_FALLOFF_KM);
  return W_DIST_MAX * t;
}

export function recommendNow(places, opts = {}) {
  const now = opts.now || new Date();
  const phase = tripPhase(now);
  const empty = (reason, extra = {}) => ({
    context: { phase: phase.phase, dayNumber: phase.dayNumber, currentMealBand: null },
    top: null,
    alternatives: [],
    empty: { reason, ...extra }
  });
  if (phase.phase === "pre-trip")  return empty("pre-trip");
  if (phase.phase === "post-trip") return empty("post-trip");

  const minute = minutesInKL(now);
  const band = currentMealBand(minute);
  const filter = opts.filter || null;
  const { lat, lng } = opts;
  const haveGps = typeof lat === "number" && typeof lng === "number";

  const ranked = [];
  for (const p of places) {
    if (p.category === "airbnb") continue;
    if (filter === "food" && p.category !== "food") continue;
    if (filter === "non-food" && p.category === "food") continue;

    const parsed = parseHours(p.hours);
    const check = checkVisit(parsed, phase.dow, minute);
    if (check.status === "closed-today" ||
        check.status === "arrive-before-open" ||
        check.status === "arrive-after-close" ||
        check.status === "between-service") {
      continue;
    }

    const distKm = haveGps ? haversineKm({ lat, lng }, p) : null;
    if (filter === "walking" && (distKm == null || distKm > 1.5)) continue;

    let score = 0;
    score += mealFitScore(p.mealType, band);
    score += distanceScore(distKm);
    score += Math.min(p.votes ?? 0, W_VOTES_CAP) * W_VOTES_PER;
    if (check.status === "closing-soon") score += W_CLOSING_SOON;

    ranked.push({
      place: p,
      score,
      distKm,
      checkStatus: check.status,
      closeMin: check.closeMin ?? null
    });
  }

  ranked.sort((a, b) =>
    b.score - a.score ||
    (a.place.order ?? 999) - (b.place.order ?? 999) ||
    a.place.id.localeCompare(b.place.id)
  );

  if (ranked.length === 0) {
    return empty("nothing-open", { tripDay: phase.dayNumber });
  }

  return {
    context: {
      phase: phase.phase,
      dayNumber: phase.dayNumber,
      currentMealBand: band,
      minute,
      dow: phase.dow,
      haveGps
    },
    top: ranked[0],
    alternatives: ranked.slice(1, 6),
    empty: null
  };
}

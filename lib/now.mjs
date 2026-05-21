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

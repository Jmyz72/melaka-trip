// A place's primary `day` plus any optional `extraDays` it's also eligible
// for. Multi-day candidates show up in every eligible day's bucket; the
// leader-resolution layer enforces "leader on one day only".
function eligibleDays(p) {
  const days = new Set();
  if (p.day === 1 || p.day === 2 || p.day === 3) days.add(p.day);
  if (Array.isArray(p.extraDays)) {
    for (const d of p.extraDays) {
      if (d === 1 || d === 2 || d === 3) days.add(d);
    }
  }
  return days;
}

export function groupByDay(places) {
  const out = { 1: [], 2: [], 3: [] };
  for (const p of places) {
    for (const d of eligibleDays(p)) out[d].push(p);
  }
  return out;
}

export function sortDaySchedule(places) {
  return [...places].sort((a, b) => a.order - b.order);
}

export function getAlternatives(dayPlaces, primary) {
  return dayPlaces.filter(p => p.mealType === primary.mealType && p.id !== primary.id);
}

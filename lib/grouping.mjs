export function groupByDay(places) {
  const out = { 1: [], 2: [], 3: [] };
  for (const p of places) {
    if (p.day === 1 || p.day === 2 || p.day === 3) out[p.day].push(p);
  }
  return out;
}

export function sortDaySchedule(places) {
  return [...places].sort((a, b) => a.order - b.order);
}

export function getAlternatives(dayPlaces, primary) {
  return dayPlaces.filter(p => p.mealType === primary.mealType && p.id !== primary.id);
}

// Pure helper: take a `by` map (uid → 1..5) and your uid,
// return { my, avg, count } display data. No Firebase dep so Node can test it.
export function summarize(by, myUid) {
  const safe = (by && typeof by === "object") ? by : {};
  const values = Object.values(safe).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
  const count = values.length;
  const avg = count ? values.reduce((a, b) => a + b, 0) / count : null;
  const my = (myUid && safe[myUid] != null) ? safe[myUid] : null;
  return { my, avg, count };
}

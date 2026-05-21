// Parses free-text opening hours strings (as found in places.json) into a
// per-day-of-week (1=Mon … 7=Sun) map of [open, close] intervals expressed
// in minutes-from-midnight. Returns { parsed: false } if the string is
// too messy to interpret.
//
// Supported shapes (intentionally pragmatic; not exhaustive):
//   "4am-2pm (Tue closed)"                      → all days 4am-2pm, except Tue
//   "Fri 8am-2:30pm; Sat-Sun 7:30am-2:30pm"     → per-day
//   "Fri 11am-12:30am; Sat-Sun 10am-12:30am"    → spans midnight
//   "5pm-2am"                                   → all days, spans midnight
//   "until 5pm"                                 → all days, treated as 8am-5pm
//   "Not stated" / "Best arrival 10:30-11am"    → { parsed: false }
//
// Intervals that span midnight are returned as a single interval where
// `close > 24*60` (e.g. 5pm-2am → open=1020, close=26*60=1560). Comparators
// at the call site should treat `close > 1440` as "still open past midnight".

const DOW_NAMES = {
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7
};
const DOW_ALL = [1, 2, 3, 4, 5, 6, 7];

function parseDayRange(token) {
  // "fri", "sat-sun", "mon-fri", "tue closed" (just the day part)
  const t = token.trim().toLowerCase();
  const m = t.match(/^(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?$/);
  if (!m) return null;
  const start = DOW_NAMES[m[1]];
  const end = m[2] ? DOW_NAMES[m[2]] : start;
  const out = [];
  // Allow wraparound (e.g. "sat-mon")
  let i = start;
  while (true) {
    out.push(i);
    if (i === end) break;
    i = i === 7 ? 1 : i + 1;
    if (out.length > 7) break;
  }
  return out;
}

function parseTime(token) {
  // "8am", "2:30pm", "12pm", "11:45pm"
  const t = token.trim().toLowerCase().replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3];
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function parseInterval(token) {
  // "8am-2:30pm", "5pm-2am", "until 5pm"
  let t = token.trim().toLowerCase();
  if (t.startsWith("until ")) {
    const close = parseTime(t.slice(6));
    if (close == null) return null;
    return { open: 8 * 60, close }; // assume 8am-X if just "until X"
  }
  const m = t.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (!m) return null;
  const open = parseTime(m[1]);
  let close = parseTime(m[2]);
  if (open == null || close == null) return null;
  // Wrap past midnight: if close <= open, add 24h
  if (close <= open) close += 24 * 60;
  return { open, close };
}

// Split chunks like "Fri 8am-2:30pm" → { days:[5], interval }
// or "Tue closed" → { days:[2], closed:true }
function parseChunk(chunk) {
  const c = chunk.trim();
  if (!c) return null;
  // Try "<dayrange> closed"
  const closedMatch = c.match(/^([\w-]+)\s+closed$/i);
  if (closedMatch) {
    const days = parseDayRange(closedMatch[1]);
    if (!days) return null;
    return { days, closed: true };
  }
  // Try "<dayrange> <interval>"
  const m = c.match(/^([\w-]+)\s+(.+)$/i);
  if (m) {
    const days = parseDayRange(m[1]);
    if (days) {
      const interval = parseInterval(m[2]);
      if (interval) return { days, interval };
    }
  }
  // Fallback: chunk is just an interval, applies to all days
  const interval = parseInterval(c);
  if (interval) return { days: DOW_ALL, interval };
  return null;
}

export function parseHours(raw) {
  const fallback = { raw, parsed: false, byDow: {} };
  if (!raw || typeof raw !== "string") return fallback;
  let text = raw.trim();
  if (!text) return fallback;
  if (/^not stated$/i.test(text)) return fallback;
  if (/best arrival/i.test(text)) return fallback;
  if (/check-?in|check-?out/i.test(text)) return fallback;

  // Extract parenthesized exclusions like "(Tue closed)" or "(Sun closed)"
  const exclusions = [];
  text = text.replace(/\(([^)]+)\)/g, (_, inside) => {
    inside.split(/[;,]/).forEach(part => {
      const ex = parseChunk(part);
      if (ex && ex.closed) exclusions.push(ex);
    });
    return "";
  }).trim();

  const chunks = text.split(/\s*[;,]\s*/).filter(Boolean);
  const byDow = {};
  for (const c of chunks) {
    const parsed = parseChunk(c);
    if (!parsed) return fallback;
    for (const d of parsed.days) {
      if (parsed.closed) {
        byDow[d] = []; // explicitly closed
      } else {
        (byDow[d] ||= []).push(parsed.interval);
      }
    }
  }
  for (const ex of exclusions) {
    for (const d of ex.days) byDow[d] = [];
  }
  if (Object.keys(byDow).length === 0) return fallback;
  return { raw, parsed: true, byDow };
}

// Check a place's parsed hours against an arrival/departure window on a
// specific day-of-week. Returns one of:
//   { status: 'unknown' }                       — hours couldn't be parsed
//   { status: 'closed-today' }                  — explicitly closed that DOW
//   { status: 'open',   closeMin, marginMin }   — open through the visit
//   { status: 'arrive-before-open', opensIn }   — arrive before first opening
//   { status: 'between-service', opensIn, opensAt } — split hours; arrive during a gap
//   { status: 'closing-soon', closeMin, marginMin } — open but margin < 30 min
//   { status: 'arrive-after-close', closedFor } — past the last close of the day
export function checkVisit(hours, dow, arriveMin, departMin) {
  if (!hours || !hours.parsed) return { status: "unknown" };
  const intervals = hours.byDow[dow];
  if (intervals == null) return { status: "unknown" };
  if (intervals.length === 0) return { status: "closed-today" };

  const sorted = [...intervals].sort((a, b) => a.open - b.open);
  // 1. Are we inside any interval?
  for (const iv of sorted) {
    if (arriveMin >= iv.open && arriveMin < iv.close) {
      const marginMin = iv.close - (departMin ?? arriveMin);
      if (marginMin < 30) return { status: "closing-soon", closeMin: iv.close, marginMin };
      return { status: "open", closeMin: iv.close, marginMin };
    }
  }
  // 2. Is there a later interval today we could wait for?
  const next = sorted.find(iv => iv.open > arriveMin);
  if (next) {
    // If nothing closed before us yet, it's just "arrive before they open."
    const anyClosedBefore = sorted.some(iv => iv.close <= arriveMin);
    if (anyClosedBefore) {
      return { status: "between-service", opensIn: next.open - arriveMin, opensAt: next.open };
    }
    return { status: "arrive-before-open", opensIn: next.open - arriveMin, openMin: next.open };
  }
  // 3. Past every close — done for the day.
  const lastClose = Math.max(...sorted.map(iv => iv.close));
  return { status: "arrive-after-close", closedFor: arriveMin - lastClose, closeMin: lastClose };
}

export function fmtClock(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const period = h24 >= 12 ? "pm" : "am";
  let h = h24 % 12; if (h === 0) h = 12;
  return mm === 0 ? `${h}${period}` : `${h}:${String(mm).padStart(2, "0")}${period}`;
}

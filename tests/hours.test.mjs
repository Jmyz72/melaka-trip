import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHours, checkVisit } from "../lib/hours.mjs";

test("parseHours: simple all-day range", () => {
  const h = parseHours("9am-5pm");
  assert.equal(h.parsed, true);
  // Every day same
  for (const d of [1, 2, 3, 4, 5, 6, 7]) {
    assert.deepEqual(h.byDow[d], [{ open: 9 * 60, close: 17 * 60 }]);
  }
});

test("parseHours: spans midnight", () => {
  const h = parseHours("5pm-2am");
  assert.equal(h.parsed, true);
  assert.deepEqual(h.byDow[3], [{ open: 17 * 60, close: 17 * 60 + 9 * 60 }]); // 26:00 = 1560
});

test("parseHours: parenthesized closed exclusion", () => {
  const h = parseHours("4am-2pm (Tue closed)");
  assert.equal(h.parsed, true);
  assert.deepEqual(h.byDow[1], [{ open: 4 * 60, close: 14 * 60 }]); // Mon open
  assert.deepEqual(h.byDow[2], []); // Tue explicitly closed
  assert.deepEqual(h.byDow[7], [{ open: 4 * 60, close: 14 * 60 }]); // Sun open
});

test("parseHours: per-day with semicolon", () => {
  const h = parseHours("Fri 8am-2:30pm; Sat-Sun 7:30am-2:30pm");
  assert.equal(h.parsed, true);
  assert.deepEqual(h.byDow[5], [{ open: 8 * 60, close: 14 * 60 + 30 }]); // Fri
  assert.deepEqual(h.byDow[6], [{ open: 7 * 60 + 30, close: 14 * 60 + 30 }]); // Sat
  assert.deepEqual(h.byDow[7], [{ open: 7 * 60 + 30, close: 14 * 60 + 30 }]); // Sun
  assert.equal(h.byDow[1], undefined); // Mon — no info
});

test("parseHours: per-day with midnight wrap", () => {
  const h = parseHours("Fri 11am-12:30am; Sat-Sun 10am-12:30am");
  assert.equal(h.parsed, true);
  // Fri: 11am to 12:30am next day = 11*60 to (24+0.5)*60 = 660 to 1470
  assert.deepEqual(h.byDow[5], [{ open: 11 * 60, close: 24 * 60 + 30 }]);
  assert.deepEqual(h.byDow[6], [{ open: 10 * 60, close: 24 * 60 + 30 }]);
});

test("parseHours: Sun closed alongside default", () => {
  const h = parseHours("5:30pm-11:30pm (Sun closed)");
  assert.equal(h.parsed, true);
  assert.deepEqual(h.byDow[5], [{ open: 17 * 60 + 30, close: 23 * 60 + 30 }]); // Fri
  assert.deepEqual(h.byDow[7], []); // Sun
});

test("parseHours: returns unparsed for opaque strings", () => {
  for (const s of ["Not stated", "Best arrival 10:30-11am", "Check-in after 3pm; Check-out 11am"]) {
    assert.equal(parseHours(s).parsed, false, `Should not parse: ${s}`);
  }
});

test("checkVisit: open with healthy margin", () => {
  const h = parseHours("9am-5pm");
  const v = checkVisit(h, 5, 13 * 60, 14 * 60); // Friday 1pm-2pm
  assert.equal(v.status, "open");
  assert.equal(v.marginMin, 3 * 60);
});

test("checkVisit: closed today (explicit)", () => {
  const h = parseHours("5:30pm-11:30pm (Sun closed)");
  const v = checkVisit(h, 7, 19 * 60, 20 * 60); // Sun 7-8pm
  assert.equal(v.status, "closed-today");
});

test("checkVisit: closing soon", () => {
  const h = parseHours("9am-5pm");
  const v = checkVisit(h, 5, 16 * 60 + 40, 17 * 60 - 5); // arrive 4:40, depart 4:55
  assert.equal(v.status, "closing-soon");
  assert.ok(v.marginMin < 30);
});

test("checkVisit: arrive after close", () => {
  const h = parseHours("9am-5pm");
  const v = checkVisit(h, 5, 18 * 60, 19 * 60); // arrive 6pm
  assert.equal(v.status, "arrive-after-close");
});

test("checkVisit: arrive before open", () => {
  const h = parseHours("9am-5pm");
  const v = checkVisit(h, 5, 8 * 60, 8 * 60 + 30); // arrive 8am
  assert.equal(v.status, "arrive-before-open");
  assert.equal(v.opensIn, 60);
});

test("checkVisit: unknown when hours not parsed", () => {
  const h = parseHours("Not stated");
  assert.equal(checkVisit(h, 5, 10 * 60, 11 * 60).status, "unknown");
});

test("checkVisit: split-service detects gap between intervals (Baba Ang case)", () => {
  // "11am-2pm; 6pm-9pm" — arriving 2pm lands in the gap
  const h = parseHours("11am-2pm; 6pm-9pm");
  const v = checkVisit(h, 5, 14 * 60, 15 * 60); // arrive 2pm
  assert.equal(v.status, "between-service");
  assert.equal(v.opensAt, 18 * 60);
  assert.equal(v.opensIn, 4 * 60);
});

test("checkVisit: midnight-wrap interval covers post-midnight arrival", () => {
  const h = parseHours("5pm-2am");
  // arrive 9pm (still day-of), checking against same DOW
  const v = checkVisit(h, 5, 21 * 60, 22 * 60);
  assert.equal(v.status, "open");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDay, sortDaySchedule, getAlternatives } from "../lib/grouping.mjs";

const sample = [
  { id: "a", day: 1, mealType: "breakfast", order: 10 },
  { id: "b", day: 1, mealType: "dinner", order: 40 },
  { id: "c", day: 1, mealType: "dinner", order: 41 },
  { id: "d", day: 2, mealType: "breakfast", order: 10 },
  { id: "e", day: null, mealType: "stay", order: 0 }
];

test("groupByDay buckets places into days 1/2/3 and skips null", () => {
  const g = groupByDay(sample);
  assert.equal(g[1].length, 3);
  assert.equal(g[2].length, 1);
  assert.equal(g[3].length, 0);
});

test("sortDaySchedule sorts by order ascending", () => {
  const sorted = sortDaySchedule([
    { id: "z", order: 50 }, { id: "a", order: 10 }, { id: "m", order: 30 }
  ]);
  assert.deepEqual(sorted.map(p => p.id), ["a", "m", "z"]);
});

test("getAlternatives returns places of same mealType on same day, excluding the primary", () => {
  const day1 = sample.filter(p => p.day === 1);
  const primary = day1.find(p => p.id === "b");
  const alts = getAlternatives(day1, primary);
  assert.deepEqual(alts.map(p => p.id), ["c"]);
});

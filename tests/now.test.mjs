import { test } from "node:test";
import assert from "node:assert/strict";
import { currentMealBand } from "../lib/now.mjs";

test("currentMealBand: breakfast window", () => {
  assert.equal(currentMealBand(7 * 60), "breakfast");
  assert.equal(currentMealBand(10 * 60 + 30), "breakfast");
});

test("currentMealBand: lunch window", () => {
  assert.equal(currentMealBand(11 * 60), "lunch");
  assert.equal(currentMealBand(14 * 60), "lunch");
});

test("currentMealBand: dinner window", () => {
  assert.equal(currentMealBand(18 * 60), "dinner");
  assert.equal(currentMealBand(21 * 60), "dinner");
});

test("currentMealBand: dessert/snack window", () => {
  assert.equal(currentMealBand(15 * 60), "dessert");
});

test("currentMealBand: late-night window", () => {
  assert.equal(currentMealBand(23 * 60), "late-night");
  assert.equal(currentMealBand(1 * 60), "late-night");
});

test("currentMealBand: dead-of-night returns null", () => {
  assert.equal(currentMealBand(4 * 60), null);
});

import { tripPhase } from "../lib/now.mjs";

test("tripPhase: pre-trip", () => {
  const r = tripPhase(new Date("2026-05-21T22:00:00+08:00"));
  assert.equal(r.phase, "pre-trip");
  assert.equal(r.dayNumber, null);
});

test("tripPhase: during Day 1", () => {
  const r = tripPhase(new Date("2026-05-22T14:00:00+08:00"));
  assert.equal(r.phase, "in-trip");
  assert.equal(r.dayNumber, 1);
  assert.equal(r.dow, 5);
});

test("tripPhase: during Day 2", () => {
  const r = tripPhase(new Date("2026-05-23T09:00:00+08:00"));
  assert.equal(r.phase, "in-trip");
  assert.equal(r.dayNumber, 2);
  assert.equal(r.dow, 6);
});

test("tripPhase: post-trip", () => {
  const r = tripPhase(new Date("2026-05-25T08:00:00+08:00"));
  assert.equal(r.phase, "post-trip");
  assert.equal(r.dayNumber, null);
});

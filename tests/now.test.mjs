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

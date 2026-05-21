import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const places = JSON.parse(await readFile("places.json", "utf8"));

const VALID_CATEGORIES = ["food", "entertainment", "souvenir", "airbnb"];
const VALID_SECTIONS = ["entertainment", "zapbalang", "jonker", "airbnb"];
const VALID_MEAL_TYPES = [
  "breakfast", "lunch", "dinner", "snack", "dessert",
  "late-night", "drinks", "souvenir", "entertainment", "stay",
  "night-market"
];

test("every place has the required fields", () => {
  for (const p of places) {
    assert.ok(p.id, `missing id: ${JSON.stringify(p)}`);
    assert.ok(p.name, `missing name on ${p.id}`);
    assert.ok(p.mapsUrl, `missing mapsUrl on ${p.id}`);
    assert.ok(VALID_CATEGORIES.includes(p.category), `bad category on ${p.id}: ${p.category}`);
    assert.ok(VALID_SECTIONS.includes(p.section), `bad section on ${p.id}: ${p.section}`);
    assert.ok(VALID_MEAL_TYPES.includes(p.mealType), `bad mealType on ${p.id}: ${p.mealType}`);
  }
});

test("every non-airbnb place has GPS coordinates", () => {
  for (const p of places) {
    if (p.category === "airbnb") continue;
    assert.equal(typeof p.lat, "number", `lat not a number on ${p.id}`);
    assert.equal(typeof p.lng, "number", `lng not a number on ${p.id}`);
    // Covers Melaka + Seremban (trip meetup) area on Peninsular Malaysia.
    assert.ok(p.lat > 2 && p.lat < 3, `lat out of expected range on ${p.id}: ${p.lat}`);
    assert.ok(p.lng > 101 && p.lng < 103, `lng out of expected range on ${p.id}: ${p.lng}`);
  }
});

test("place ids are unique", () => {
  const ids = places.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
});

test("each day 1/2/3 has at least one dinner OR is the half-day check-out", () => {
  for (const day of [1, 2]) {
    const dinners = places.filter(p => p.day === day && p.mealType === "dinner");
    assert.ok(dinners.length >= 1, `day ${day} has no dinner`);
  }
});

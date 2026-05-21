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

import { recommendNow } from "../lib/now.mjs";

const FIXTURE = [
  { id: "lunch-place", name: "Lunch Place", category: "food",
    mealType: "lunch", hours: "11am-3pm",
    lat: 2.197, lng: 102.252, mapsUrl: "https://example/1", order: 1 },
  { id: "dinner-place", name: "Dinner Place", category: "food",
    mealType: "dinner", hours: "6pm-10pm",
    lat: 2.198, lng: 102.253, mapsUrl: "https://example/2", order: 2 },
  { id: "closed-place", name: "Closed Place", category: "food",
    mealType: "lunch", hours: "Mon closed; Tue-Sun 12pm-2pm",
    lat: 2.199, lng: 102.254, mapsUrl: "https://example/3", order: 3 },
  { id: "souvenir-place", name: "Souvenir Place", category: "souvenir",
    mealType: "souvenir", hours: "9am-9pm",
    lat: 2.200, lng: 102.255, mapsUrl: "https://example/4", order: 4 }
];

test("recommendNow: lunch time ranks lunch-typed above dinner-typed", () => {
  const r = recommendNow(FIXTURE, { now: new Date("2026-05-22T12:30:00+08:00") });
  assert.equal(r.empty, null);
  assert.equal(r.top.place.id, "lunch-place");
});

test("recommendNow: pre-trip empty state", () => {
  const r = recommendNow(FIXTURE, { now: new Date("2026-05-21T22:00:00+08:00") });
  assert.equal(r.empty.reason, "pre-trip");
  assert.equal(r.top, null);
  assert.equal(r.alternatives.length, 0);
});

test("recommendNow: pre-trip on May 18", () => {
  const r = recommendNow(FIXTURE, { now: new Date("2026-05-18T13:00:00+08:00") });
  assert.equal(r.empty.reason, "pre-trip");
});

test("recommendNow: post-trip empty state", () => {
  const r = recommendNow(FIXTURE, { now: new Date("2026-05-30T10:00:00+08:00") });
  assert.equal(r.empty.reason, "post-trip");
});

test("recommendNow: with GPS, closer place wins ties on meal-fit", () => {
  const places = [
    { id: "near", name: "Near", category: "food", mealType: "lunch",
      hours: "11am-3pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/n", order: 1 },
    { id: "far",  name: "Far",  category: "food", mealType: "lunch",
      hours: "11am-3pm", lat: 2.250, lng: 102.300,
      mapsUrl: "https://x/f", order: 2 }
  ];
  const r = recommendNow(places, {
    now: new Date("2026-05-22T12:30:00+08:00"),
    lat: 2.197, lng: 102.252
  });
  assert.equal(r.top.place.id, "near");
});

test("recommendNow: closing-soon place demoted below fully-open peer", () => {
  const places = [
    { id: "lunch-soon", name: "Closing", category: "food", mealType: "lunch",
      hours: "11am-3pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/c", order: 1 },
    { id: "open-wide", name: "Wide Open", category: "food", mealType: "lunch",
      hours: "11am-9pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/w", order: 2 }
  ];
  const r = recommendNow(places, {
    now: new Date("2026-05-22T14:55:00+08:00")
  });
  assert.equal(r.top.place.id, "open-wide");
});

test("recommendNow: filter 'food' excludes souvenir", () => {
  const places = [
    { id: "shop", name: "Shop", category: "souvenir", mealType: "souvenir",
      hours: "9am-9pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/s", order: 1 },
    { id: "eat", name: "Eat", category: "food", mealType: "lunch",
      hours: "11am-3pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/e", order: 2 }
  ];
  const r = recommendNow(places, {
    now: new Date("2026-05-22T12:30:00+08:00"),
    filter: "food"
  });
  assert.equal(r.alternatives.find(a => a.place.id === "shop"), undefined);
  assert.equal(r.top.place.id, "eat");
});

test("recommendNow: nothing-open empty state during trip", () => {
  const places = [
    { id: "x", name: "X", category: "food", mealType: "lunch",
      hours: "11am-3pm", lat: 2.197, lng: 102.252,
      mapsUrl: "https://x/x", order: 1 }
  ];
  const r = recommendNow(places, { now: new Date("2026-05-22T05:00:00+08:00") });
  assert.equal(r.empty.reason, "nothing-open");
});

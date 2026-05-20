import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, driveMinutes, fmtTime, buildSchedule, DWELL_MIN } from "../lib/timeline.mjs";

test("haversineKm: ~0 for same point", () => {
  assert.ok(haversineKm({ lat: 2.2, lng: 102.25 }, { lat: 2.2, lng: 102.25 }) < 0.001);
});

test("haversineKm: ~1km for 0.009 deg latitude apart at equator-ish", () => {
  const km = haversineKm({ lat: 2.2, lng: 102.25 }, { lat: 2.209, lng: 102.25 });
  assert.ok(km > 0.9 && km < 1.1, `got ${km}`);
});

test("driveMinutes: returns sane value for short trip", () => {
  const d = driveMinutes({ lat: 2.2, lng: 102.25 }, { lat: 2.21, lng: 102.26 });
  assert.ok(d >= 2 && d <= 15, `got ${d}`);
});

test("driveMinutes: null for missing coords", () => {
  assert.equal(driveMinutes(null, { lat: 2.2, lng: 102.25 }), null);
});

test("fmtTime: noon / midnight / regular", () => {
  assert.equal(fmtTime(12 * 60), "12:00pm");
  assert.equal(fmtTime(0), "12:00am");
  assert.equal(fmtTime(9 * 60 + 5), "9:05am");
  assert.equal(fmtTime(22 * 60 + 30), "10:30pm");
});

test("buildSchedule: advances clock by dwell + drive between stops", () => {
  // Use mealTypes that don't have fixed-time anchors so we exercise the
  // pure dwell + drive math.
  const day = [
    { id: "a", mealType: "snack", lat: 2.2, lng: 102.25 },
    { id: "b", mealType: "dessert", lat: 2.21, lng: 102.26 }
  ];
  const { startMin, steps } = buildSchedule(day, 2);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].arriveMin, startMin);
  assert.equal(steps[0].dwell, DWELL_MIN.snack);
  assert.equal(steps[0].departMin, startMin + DWELL_MIN.snack);
  assert.ok(steps[0].driveToNext > 0);
  assert.equal(steps[1].arriveMin, steps[0].departMin + steps[0].driveToNext);
});

test("buildSchedule: fixed meal anchors delay arrival when day start is early", () => {
  const day = [{ id: "a", mealType: "breakfast", lat: 2.2, lng: 102.25 }];
  const { steps } = buildSchedule(day, 2); // day 2 starts at 9am
  assert.equal(steps[0].arriveMin, 10 * 60, "breakfast should be anchored to 10am");
  assert.equal(steps[0].waitMin, 60, "1h wait between 9am day start and 10am breakfast");
});

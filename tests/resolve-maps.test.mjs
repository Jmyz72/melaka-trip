import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLatLng } from "../tools/lib/resolve-maps.mjs";

test("extracts !3d / !4d from a resolved URL", () => {
  const url = "https://www.google.com/maps/place/Jonker+Walk/@2.1956,102.2486,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d2.1956!4d102.2486!16s%2Fg%2F1tdwm6lc";
  assert.deepEqual(extractLatLng(url), { lat: 2.1956, lng: 102.2486 });
});

test("extracts from @lat,lng,zoom form if !3d/!4d absent", () => {
  const url = "https://www.google.com/maps/@2.1956,102.2486,17z";
  assert.deepEqual(extractLatLng(url), { lat: 2.1956, lng: 102.2486 });
});

test("returns null for an unparseable URL", () => {
  assert.equal(extractLatLng("https://example.com/no/coords/here"), null);
});

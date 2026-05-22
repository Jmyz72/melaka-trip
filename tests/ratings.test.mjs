import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../lib/ratings-summary.mjs";

test("empty map → null avg, 0 count, null my", () => {
  assert.deepEqual(summarize({}, "uid-mine"), { my: null, avg: null, count: 0 });
});

test("three ratings without my uid", () => {
  const r = summarize({ a: 4, b: 5, c: 4 }, "uid-mine");
  assert.equal(r.my, null);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("three ratings including mine", () => {
  const r = summarize({ a: 4, "uid-mine": 5, c: 4 }, "uid-mine");
  assert.equal(r.my, 5);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.avg - 13/3) < 1e-9);
});

test("only my rating", () => {
  assert.deepEqual(summarize({ "uid-mine": 4 }, "uid-mine"), { my: 4, avg: 4, count: 1 });
});

test("missing/undefined map argument", () => {
  assert.deepEqual(summarize(undefined, "uid-mine"), { my: null, avg: null, count: 0 });
});

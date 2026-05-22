import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeFor } from "../lib/gallery.mjs";

test("landscape image gets span-2 columns", () => {
  assert.deepEqual(sizeFor({ w: 1600, h: 900 }), { colSpan: 2, rowSpan: 1 });
});

test("portrait image gets span-2 rows", () => {
  assert.deepEqual(sizeFor({ w: 900, h: 1600 }), { colSpan: 1, rowSpan: 2 });
});

test("near-square stays 1x1", () => {
  assert.deepEqual(sizeFor({ w: 1000, h: 1000 }), { colSpan: 1, rowSpan: 1 });
  assert.deepEqual(sizeFor({ w: 1200, h: 1000 }), { colSpan: 1, rowSpan: 1 });
});

test("missing dimensions default to 1x1", () => {
  assert.deepEqual(sizeFor({}), { colSpan: 1, rowSpan: 1 });
  assert.deepEqual(sizeFor({ w: 0, h: 0 }), { colSpan: 1, rowSpan: 1 });
});

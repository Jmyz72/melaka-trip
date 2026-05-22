import { test } from "node:test";
import assert from "node:assert/strict";
import { splitName } from "../lib/name.mjs";

test("leading CJK then Latin splits cleanly", () => {
  assert.deepEqual(
    splitName("芙蓉大巴刹 Seremban Central Market"),
    { cn: "芙蓉大巴刹", main: "Seremban Central Market" }
  );
});

test("Latin then trailing CJK splits cleanly", () => {
  assert.deepEqual(
    splitName("Jonker Walk 鸡场街"),
    { cn: "鸡场街", main: "Jonker Walk" }
  );
});

test("Latin-only returns cn:null", () => {
  assert.deepEqual(
    splitName("Seremban Central Market"),
    { cn: null, main: "Seremban Central Market" }
  );
});

test("CJK-only falls back to main = original", () => {
  assert.deepEqual(
    splitName("大树下鸭面"),
    { cn: null, main: "大树下鸭面" }
  );
});

test("messy mixed-middle falls back to main = original", () => {
  const raw = "Foo 中文 Bar";
  assert.deepEqual(splitName(raw), { cn: null, main: raw });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const memories = JSON.parse(await readFile("memories.json", "utf8"));

const ID_RE = /^[a-z0-9-]{1,40}$/;
const TIME_RE = /^[0-2]\d:[0-5]\d$/;

test("every entry has required scalar fields with valid values", () => {
  for (const m of memories) {
    assert.ok(ID_RE.test(m.id), `bad id: ${m.id}`);
    assert.ok(typeof m.name === "string" && m.name.length > 0, `bad name on ${m.id}`);
    assert.ok([1, 2, 3].includes(m.day), `bad day on ${m.id}: ${m.day}`);
    assert.equal(typeof m.order, "number", `bad order on ${m.id}`);
    assert.ok(TIME_RE.test(m.time), `bad time on ${m.id}: ${m.time}`);
    assert.equal(typeof m.lat, "number", `bad lat on ${m.id}`);
    assert.equal(typeof m.lng, "number", `bad lng on ${m.id}`);
    assert.ok(m.lat > 2 && m.lat < 3, `lat out of range on ${m.id}: ${m.lat}`);
    assert.ok(m.lng > 101 && m.lng < 103, `lng out of range on ${m.id}: ${m.lng}`);
    assert.ok(typeof m.mapsUrl === "string" && m.mapsUrl.startsWith("https://"), `bad mapsUrl on ${m.id}`);
    assert.ok([1, 2, 3, 4, 5].includes(m.rating), `bad rating on ${m.id}: ${m.rating}`);
    assert.ok(Array.isArray(m.media), `media not an array on ${m.id}`);
  }
});

test("ids are unique", () => {
  const ids = memories.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
});

test("every media entry points to an existing file", async () => {
  for (const m of memories) {
    for (const item of m.media) {
      assert.ok(item.src.startsWith(`media/${m.id}/`), `bad src path on ${m.id}: ${item.src}`);
      assert.ok(["photo", "video"].includes(item.type), `bad type on ${m.id}: ${item.type}`);
      assert.equal(typeof item.w, "number", `missing w on ${m.id}/${item.src}`);
      assert.equal(typeof item.h, "number", `missing h on ${m.id}/${item.src}`);
      await stat(resolve(item.src)); // throws if missing
      if (item.type === "video") {
        assert.ok(typeof item.poster === "string", `video missing poster on ${m.id}/${item.src}`);
        await stat(resolve(item.poster));
      }
    }
  }
});

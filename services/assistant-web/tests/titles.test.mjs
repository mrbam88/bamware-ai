import { test } from "node:test";
import assert from "node:assert/strict";
import { createTitleReader, withTitles } from "../lib/titles.mjs";

test("titles are fetched once, cached, and only for real ticket references", async () => {
  let calls = 0;
  const titles = createTitleReader({ fetchTitle: async (ref) => { calls++; return `Title of ${ref}`; } });
  const refs = ["mrbam88/bamware-ai#85", "mrbam88/bamware-ai#85", "smoke-test", null];
  assert.deepEqual(await titles(refs), { "mrbam88/bamware-ai#85": "Title of mrbam88/bamware-ai#85" });
  await titles(refs);
  assert.equal(calls, 1);
});

test("a slow lookup never blocks the page for long, and fills in on a later load", async () => {
  let release;
  const titles = createTitleReader({ fetchTitle: () => new Promise((r) => { release = () => r("Shared signup and password recovery"); }) });
  const first = await titles(["mrbam88/bamware-ai#85"], { waitMs: 20 });
  assert.deepEqual(first, {}, "falls back after the wait instead of hanging");
  release();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(await titles(["mrbam88/bamware-ai#85"]), { "mrbam88/bamware-ai#85": "Shared signup and password recovery" });
});

test("a failed lookup falls back quietly and keeps any title it had", async () => {
  let t = 0, fail = false;
  const titles = createTitleReader({ clock: () => t, ttlMs: 10, fetchTitle: async () => { if (fail) throw new Error("gh down"); return "Kept title"; } });
  await titles(["o/r#1"]);
  t = 100; fail = true;
  assert.deepEqual(await titles(["o/r#1"]), { "o/r#1": "Kept title" });
});

test("withTitles fills only missing titles and never overwrites a task's own", () => {
  const now = { running: [{ ticket: "o/r#1" }], recent: [{ ticket: "o/r#2", title: "From the batch" }, { ticket: null, task: "smoke" }] };
  const out = withTitles(now, { "o/r#1": "One", "o/r#2": "Two" });
  assert.deepEqual([out.running[0].title, out.recent[0].title, out.recent[1].title], ["One", "From the batch", undefined]);
});

test("a failed lookup is retried after minutes, not hours", async () => {
  let t = 0, calls = 0;
  const titles = createTitleReader({ clock: () => t, fetchTitle: async () => { calls++; if (calls === 1) throw new Error("gh down"); return "Back"; } });
  assert.deepEqual(await titles(["o/r#1"]), {});
  t = 6 * 60_000;
  assert.deepEqual(await titles(["o/r#1"]), { "o/r#1": "Back" });
});


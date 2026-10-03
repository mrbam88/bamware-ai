import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveNow, deriveNeedsYou, deriveCapacity, deriveSystem, buildAgentsSnapshot, processState, workerAlive } from "../lib/agents-status.mjs";
import { summarizeBoard, createBoardReader } from "../lib/board.mjs";

const NOW = 1791010000 * 1000;
const run = (id, phase, tasks, planned = [], smoke = false) => ({ id, status: { phase, started_at: 1791009000, tasks }, batch: { smoke_test: smoke, tasks: planned } });

test("recent tasks show the executor's real state, newest first, with ticket and cost", () => {
  const runs = [run("2", "finished", [{ id: "smoke", state: "verified", exit_code: 0, started_at: 1791009400, finished_at: 1791009403,
      cost: { attribution: "exclusive-local", pools: { "claude-max:weekly": { label: "Claude weekly", delta_pct: 0.4 }, "copilot": { delta_pct: 0 } } } }], [{ id: "smoke", ticket: "smoke-test" }], true),
    run("1", "finished", [{ id: "implementation-75", state: "failed", exit_code: 1, started_at: 1790900000, finished_at: 1790900600 }], [{ id: "implementation-75", ticket: "#75" }])];
  const { running, recent } = deriveNow(runs, NOW);
  assert.equal(running.length, 0);
  assert.deepEqual(recent.map((t) => [t.ticket, t.state]), [["smoke-test", "verified"], ["#75", "failed"]]);
  assert.deepEqual(recent[0].cost, { pool: "Claude weekly", pct: 0.4, attribution: "exclusive-local" });
  assert.equal(deriveNow([run("4", "finished", [{ id: "z", state: "verified", cost: { pools: { p: { delta_pct: 0 } } } }])], NOW).recent[0].cost, null, "zero cost is not shown as a pool share");
  assert.equal(recent[0].smoke, true);
  assert.equal(recent[1].durationMs, 600_000);
});

test("an unfinished run lists its running and queued tasks; a very old one reads as stalled", () => {
  const live = run("3", "running", [{ id: "a", state: "running", started_at: 1791009500 }], [{ id: "a", ticket: "#1" }, { id: "b", ticket: "#2" }]);
  assert.deepEqual(deriveNow([live], NOW).running.map((t) => [t.ticket, t.state]), [["#1", "running"], ["#2", "queued"]]);
  const old = { ...live, status: { ...live.status, started_at: 1791009000 - 13 * 3600 } };
  assert.equal(deriveNow([old], NOW).running[0].state, "stalled");
});

test("needs-you lists waiting blockers by urgency and an unplanned batch checkpoint", () => {
  const blockers = [
    { id: "x", status: "waiting_for_owner", ownerAction: "Grant docker access", checkedAt: "2026-10-03T02:30:00Z", candidate: { title: "Docker access", urgency: "medium", source: { url: "https://github.com/mrbam88/bamware-ai/issues/85" } } },
    { id: "y", status: "resolved", candidate: { title: "done" } },
    { id: "z", status: "waiting_for_owner", candidate: { title: "AWS creds", urgency: "high" } }];
  const batch = { date: "2026-10-03", status: "awaiting-founder-checkpoints", executionAuthorized: false, checkpoints: [{ id: "morning-review-plan", status: "not-started" }] };
  const items = deriveNeedsYou(blockers, batch);
  assert.deepEqual(items.map((i) => i.title), ["AWS creds", "Docker access", "Batch for 2026-10-03 is waiting for your morning review plan"]);
  assert.match(items[2].action, /No work is authorized/);
  const legacy = deriveNeedsYou([{ id: "auth-85", status: "waiting_for_owner", ownerAction: "Run aws login" }], null,
    [{ id: "auth-85", title: "Enable live email", urgency: "high", source: { url: "https://github.com/mrbam88/bamware-ai/issues/85" } }]);
  assert.deepEqual([legacy[0].title, legacy[0].action, legacy[0].urgency], ["Enable live email", "Run aws login", "high"]);
  const bare = deriveNeedsYou([{ id: "x-1", status: "waiting_for_owner", ownerAction: "Do the thing" }], null, []);
  assert.deepEqual([bare[0].title, bare[0].action], ["Do the thing", null], "never shows a raw id when an action exists");
});

test("capacity comes straight from the CFO and goes stale when the CFO stops publishing", () => {
  const cap = { generated_at: NOW / 1000 - 60, policy: { reserve_used_pct: 85 }, sources: { copilot: { last_error: null }, "claude-max": { last_error: "claude samples stale" } },
    pools: [{ key: "openai", label: "OpenAI weekly", used_pct: 95, level: "critical", stale: false, rate_pct_h: null, eta_reserve_h: null, eta_exhaust_h: null, reset_at: 1791580666, observed_at: NOW / 1000 - 300 }] };
  const fresh = deriveCapacity(cap, NOW);
  assert.equal(fresh.state, "fresh");
  assert.equal(fresh.pools[0].level, "critical");
  assert.deepEqual(fresh.problems, ["claude-max: claude samples stale"]);
  assert.equal(deriveCapacity({ ...cap, generated_at: NOW / 1000 - 3600 }, NOW).state, "stale");
  assert.equal(deriveCapacity(null, NOW).state, "unavailable");
});

test("system state: paused beats running beats waiting beats idle", () => {
  const work = { running: [{ state: "running", task: "a", ticket: "#1", startedAt: NOW }], recent: [] };
  const idleWork = { running: [], recent: [] };
  assert.equal(deriveSystem({ estop: { reason: "r", pausedAt: 1, processStates: ["frozen", "gone"] } }, work, []).state, "paused");
  assert.equal(deriveSystem({ estop: { reason: "r", pausedAt: 1, processStates: ["frozen", "gone"] } }, work, []).frozen, 1);
  assert.equal(deriveSystem({ estop: { reason: "r", resumedAt: 2 } }, work, []).state, "running");
  assert.equal(deriveSystem({}, idleWork, [{ title: "x" }]).state, "awaiting");
  assert.equal(deriveSystem({}, idleWork, []).state, "idle");
});

test("snapshot tolerates entirely missing state", () => {
  const snap = buildAgentsSnapshot({ estop: null, batch: null, runs: [], blockers: [], capacity: null }, NOW);
  assert.equal(snap.system.state, "idle");
  assert.equal(snap.capacity.state, "unavailable");
});

test("emergency-stop process check distinguishes frozen, running and reused pids", async () => {
  const stat = (state, ticks) => async () => `123 (claude) ${state} 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 ${ticks} 0`;
  assert.equal(await processState(123, "99", stat("T", "99")), "frozen");
  assert.equal(await processState(123, "99", stat("S", "99")), "running");
  assert.equal(await processState(123, "99", stat("T", "42")), "gone");
  assert.equal(await processState(123, "99", async () => { throw new Error("ENOENT"); }), "gone");
});

test("board summary counts by status and lists in-progress items by priority", () => {
  const items = [{ status: "Done", title: "a" }, { status: "In Progress", title: "b", priority: "P2", content: { url: "u2", repository: "mrbam88/x", number: 2 } },
    { status: "In Progress", title: "c", priority: "P0", content: { url: "u3", repository: "mrbam88/y", number: 3 } }, { title: "d" }];
  const s = summarizeBoard(items, 1);
  assert.deepEqual(s.counts, { Done: 1, "In Progress": 2, "No status": 1 });
  assert.deepEqual(s.inProgress.map((i) => [i.title, i.repo]), [["c", "y"], ["b", "x"]]);
});

test("board reader caches, serves the last good read on failure, and reports the error", async () => {
  let t = 0, calls = 0, fail = false;
  const read = createBoardReader({ clock: () => t, ttlMs: 100, fetchItems: async () => { calls++; if (fail) throw new Error("gh timed out"); return [{ status: "Todo", title: "x" }]; } });
  assert.equal((await read()).counts.Todo, 1);
  await read();
  assert.equal(calls, 1, "cached within ttl");
  t = 500; fail = true;
  const stale = await read();
  await new Promise((r) => setImmediate(r));
  const after = await read();
  assert.equal(stale.counts.Todo, 1, "last good read still served");
  assert.equal(after.error, "gh timed out");
});

test("a run whose worker died shows interrupted work, never 'running' or inflated queues", () => {
  const live = run("5", "running", [{ id: "a", state: "running", started_at: 1791009500 }], [{ id: "a", ticket: "#1" }, { id: "b", ticket: "#2" }]);
  const dead = deriveNow([{ ...live, workerAlive: false }], NOW);
  assert.deepEqual(dead.running, []);
  assert.deepEqual(dead.recent.map((t) => [t.ticket, t.state]), [["#1", "interrupted"]]);
  assert.equal(deriveSystem({}, dead, []).state, "idle", "a dead run must not keep the banner on Working");
  assert.equal(deriveNow([{ ...live, workerAlive: true }], NOW).running.length, 2, "a live worker is still running");
  assert.equal(deriveNow([{ ...live, workerAlive: null }], NOW).running.length, 2, "unknown liveness keeps the old behaviour");
});

test("worker liveness requires this run's runner.py worker, not any process with that pid", async () => {
  const cmd = (args) => async () => args.join("\0");
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/python3", "/x/services/overnight/runner.py", "worker", "/s/overnight/179"])), true);
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/python3", "/x/runner.py", "worker", "/s/overnight/180"])), false, "another run");
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/vim"])), false, "pid reused");
  assert.equal(await workerAlive(42, "179", async () => { throw new Error("ENOENT"); }), false);
  assert.equal(await workerAlive(undefined, "179"), null);
});

test("a capacity file without a readable timestamp is stale, not fresh", () => {
  assert.equal(deriveCapacity({ pools: [], sources: {} }, NOW).state, "stale");
  assert.equal(deriveCapacity({ generated_at: "garbage", pools: [], sources: {} }, NOW).state, "stale");
});

test("capacity passes the CFO's before-reset answers through untouched", () => {
  const cap = { generated_at: NOW / 1000, sources: {}, pools: [{ key: "k", label: "L", used_pct: 40, level: "warn", stale: false, rate_pct_h: 5,
    eta_reserve_h: 9, eta_exhaust_h: 12, reserve_before_reset: true, exhaust_before_reset: false, reset_at: 1, observed_at: 1 }] };
  const [p] = deriveCapacity(cap, NOW).pools;
  assert.deepEqual([p.reserveBeforeReset, p.exhaustBeforeReset], [true, false]);
});

test("board reader exposes the configured board link", async () => {
  const read = createBoardReader({ owner: "acme", project: "7", fetchItems: async () => [] });
  assert.equal((await read()).url, "https://github.com/users/acme/projects/7");
});


import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveNow, deriveNeedsYou, deriveCapacity, deriveSystem, buildAgentsSnapshot, processState, workerAlive, promptLabel, readAgentsState } from "../lib/agents-status.mjs";
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
  const live = { ...run("3", "running", [{ id: "a", state: "running", started_at: 1791009500 }], [{ id: "a", ticket: "#1" }, { id: "b", ticket: "#2" }]), workerAlive: true };
  assert.deepEqual(deriveNow([live], NOW).running.map((t) => [t.ticket, t.state]), [["#1", "running"], ["#2", "queued"]]);
  const old = { ...live, status: { ...live.status, started_at: 1791009000 - 13 * 3600 } };
  assert.equal(deriveNow([old], NOW).running[0].state, "stalled");
});

test("worker liveness null or missing never reads as running or stalled, even on an old run", () => {
  const live = run("3", "running", [{ id: "a", state: "running", started_at: 1791009500 }], [{ id: "a", ticket: "#1" }, { id: "b", ticket: "#2" }]);
  assert.deepEqual(deriveNow([live], NOW).running.map((t) => [t.ticket, t.state]), [["#1", "unverified"], ["#2", "queued"]], "no workerAlive field at all");
  const unknown = { ...live, workerAlive: null };
  assert.deepEqual(deriveNow([unknown], NOW).running.map((t) => [t.ticket, t.state]), [["#1", "unverified"], ["#2", "queued"]]);
  const old = { ...unknown, status: { ...unknown.status, started_at: 1791009000 - 13 * 3600 } };
  assert.equal(deriveNow([old], NOW).running[0].state, "unverified", "age alone never promotes unverified evidence to stalled");
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

test("system state: unverified worker activity is its own 'attention' state, never idle, waiting, or building", () => {
  const unverifiedWork = { running: [{ state: "unverified", task: "a", ticket: "#1", startedAt: NOW }], recent: [] };
  const unverifiedOnly = deriveSystem({}, unverifiedWork, []);
  assert.equal(unverifiedOnly.state, "attention");
  assert.equal(unverifiedOnly.title, "Activity unverified");
  const unverifiedWithWaiting = deriveSystem({}, unverifiedWork, [{ title: "x" }]);
  assert.equal(unverifiedWithWaiting.state, "attention", "unverified activity must not be masked by a pending owner decision");
  const paused = deriveSystem({ estop: { reason: "r", pausedAt: 1 } }, unverifiedWork, []);
  assert.equal(paused.state, "paused", "emergency stop still wins over unverified activity");
  const confirmedThenUnverified = { running: [{ state: "running", task: "a", ticket: "#1", startedAt: NOW }, { state: "unverified", task: "b", ticket: "#2", startedAt: NOW }], recent: [] };
  assert.equal(deriveSystem({}, confirmedThenUnverified, []).state, "running", "confirmed running wins when listed before an unverified task");
  const unverifiedThenConfirmed = { running: [{ state: "unverified", task: "b", ticket: "#2", startedAt: NOW }, { state: "running", task: "a", ticket: "#1", startedAt: NOW }], recent: [] };
  assert.equal(deriveSystem({}, unverifiedThenConfirmed, []).state, "running", "confirmed running wins when listed after an unverified task");
});

test("system state: pending owner decisions never claim a block with no dependency evidence", () => {
  const idleWork = { running: [], recent: [] };
  const one = deriveSystem({}, idleWork, [{ title: "x" }]);
  assert.equal(one.title, "Decisions need you");
  assert.equal(one.detail, "1 decision needs your input. No active executor work is confirmed.");
  assert.equal(one.waiting, 1);
  const two = deriveSystem({}, idleWork, [{ title: "x" }, { title: "y" }]);
  assert.equal(two.title, "Decisions need you");
  assert.equal(two.detail, "2 decisions need your input. No active executor work is confirmed.");
  assert.equal(two.waiting, 2);
});

test("system state: idle detail scopes to the observed executor, not a global claim", () => {
  const idleWork = { running: [], recent: [] };
  const idle = deriveSystem({}, idleWork, []);
  assert.equal(idle.title, "Idle");
  assert.equal(idle.detail, "No active executor work is confirmed and no decisions are waiting on you.");
  assert.equal(idle.waiting, 0);
});

test("system state: queued-only work plus pending decisions still reports awaiting, not a false block claim", () => {
  const queuedWork = { running: [{ state: "queued", task: "a", ticket: "#1", startedAt: null }], recent: [] };
  const result = deriveSystem({}, queuedWork, [{ title: "x" }]);
  assert.equal(result.state, "awaiting");
  assert.equal(result.title, "Decisions need you");
  assert.equal(result.detail, "1 decision needs your input. No active executor work is confirmed.");
});

test("system state: confirmed active work beats pending decisions in precedence and copy", () => {
  const work = { running: [{ state: "running", task: "a", ticket: "#1", startedAt: NOW }], recent: [] };
  const result = deriveSystem({}, work, [{ title: "x" }, { title: "y" }]);
  assert.equal(result.state, "running");
  assert.equal(result.title, "FACTORY BUILDING");
  assert.equal(result.waiting, 2, "waiting count still carried even when another state wins");
});

test("system state: unverified activity beats pending decisions in precedence and copy", () => {
  const unverifiedWork = { running: [{ state: "unverified", task: "a", ticket: "#1", startedAt: NOW }], recent: [] };
  const result = deriveSystem({}, unverifiedWork, [{ title: "x" }]);
  assert.equal(result.state, "attention");
  assert.equal(result.title, "Activity unverified");
  assert.equal(result.waiting, 1);
});

test("system state: paused beats pending decisions in precedence and copy", () => {
  const idleWork = { running: [], recent: [] };
  const result = deriveSystem({ estop: { reason: "r", pausedAt: 1 } }, idleWork, [{ title: "x" }]);
  assert.equal(result.state, "paused");
  assert.equal(result.title, "Paused by emergency stop");
  assert.equal(result.waiting, 1);
});

test("buildAgentsSnapshot carries the new pending copy and unchanged items/count end to end", () => {
  const blockers = [{ id: "x", status: "waiting_for_owner", candidate: { title: "Docker access", urgency: "medium" } },
    { id: "z", status: "waiting_for_owner", candidate: { title: "AWS creds", urgency: "high" } }];
  const snap = buildAgentsSnapshot({ estop: null, batch: null, runs: [], blockers, capacity: null }, NOW);
  assert.equal(snap.system.state, "awaiting");
  assert.equal(snap.system.title, "Decisions need you");
  assert.equal(snap.system.detail, "2 decisions need your input. No active executor work is confirmed.");
  assert.equal(snap.system.waiting, 2);
  assert.deepEqual(snap.needsYou.map((i) => i.title), ["AWS creds", "Docker access"]);
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
  assert.equal(dead.recent[0].finishedAt, null, "interrupted work never finished");
  assert.equal(deriveSystem({}, dead, []).state, "idle", "a dead run must not keep the banner on Working");
  const alive = deriveNow([{ ...live, workerAlive: true }], NOW);
  assert.deepEqual(alive.running.map((t) => [t.ticket, t.state]), [["#1", "running"], ["#2", "queued"]], "a live worker is genuinely running");
  assert.equal(deriveSystem({}, alive, []).state, "running");
  const unknown = deriveNow([{ ...live, workerAlive: null }], NOW);
  assert.deepEqual(unknown.running.map((t) => [t.ticket, t.state]), [["#1", "unverified"], ["#2", "queued"]], "unknown liveness is unverified, not running");
  assert.equal(deriveSystem({}, unknown, []).state, "attention");
  const missing = deriveNow([{ ...live, workerAlive: undefined }], NOW);
  assert.deepEqual(missing.running.map((t) => [t.ticket, t.state]), [["#1", "unverified"], ["#2", "queued"]], "missing workerAlive is unverified, not running");
});

test("worker liveness requires this run's runner.py worker, not any process with that pid", async () => {
  const cmd = (args) => async () => args.join("\0");
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/python3", "/x/services/overnight/runner.py", "worker", "/s/overnight/179"])), true);
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/python3", "/x/runner.py", "worker", "/s/overnight/180"])), false, "another run");
  assert.equal(await workerAlive(42, "179", cmd(["/usr/bin/vim"])), false, "pid reused");
  assert.equal(await workerAlive(42, "179", async () => { throw Object.assign(new Error("gone"), { code: "ENOENT" }); }), false);
  assert.equal(await workerAlive(42, "179", async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); }), null, "a sandbox denial is unknown, not dead");
  assert.equal(await workerAlive(undefined, "179"), null);
});

test("worker identity requires the exact runner.py script, an adjacent worker subcommand, and the exact run directory", async () => {
  const cmd = (args) => async () => args.join("\0");
  assert.equal(await workerAlive(42, "179", cmd(["python3", "/x/runner.py", "worker", "/runs/9179"])), false, "run id must match exactly, not just a suffix");
  assert.equal(await workerAlive(42, "179", cmd(["python3", "/x/notrunner.py", "worker", "/runs/179"])), false, "script must be runner.py exactly, not merely end with it");
  assert.equal(await workerAlive(42, "179", cmd(["python3", "/x/runner.py", "/runs/179", "worker"])), false, "worker must immediately follow the script, not appear after the run dir");
  assert.equal(await workerAlive(42, "179", cmd(["python3", "/x/runner.py", "worker", "--extra", "179"])), false, "the run dir must immediately follow worker, not an unrelated later argument");
  assert.equal(await workerAlive(42, "179", cmd(["python3", "/x/runner.py", "worker", "/runs/179/"])), true, "a trailing slash on the run dir is still an exact match");
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

test("a worker prompt names its ticket and title; untitled prompts fall back to the task's first sentence", () => {
  assert.deepEqual(promptLabel('rules\nYOUR TASK:\nTicket: mrbam88/bamware-ai#115 "Delete the orphaned rate-limits stack". Owner: Lead.'),
    { ticket: "mrbam88/bamware-ai#115", title: "Delete the orphaned rate-limits stack" });
  assert.deepEqual(promptLabel("Ticket: mrbam88/bamware-ai#110 item 3 (Claude quota sampler). Owner: Engineering Lead."),
    { ticket: "mrbam88/bamware-ai#110", title: "item 3 (Claude quota sampler)" });
  assert.deepEqual(promptLabel("YOUR TASK:\nReview tonight's PRs. Then report."), { ticket: null, title: "Review tonight's PRs" });
  assert.equal(promptLabel(""), null);
  assert.equal(promptLabel("no markers here"), null);
});

test("recent tasks carry a title, token totals and denied-command count from the worker's own record", () => {
  const r = run("5", "finished", [{ id: "t85", state: "failed", exit_code: 1, started_at: 1791009000, finished_at: 1791009960 },
    { id: "t9", state: "verified", exit_code: 0, started_at: 1791009000, finished_at: 1791009100 }],
  [{ id: "t85" }, { id: "t9", ticket: "#9", title: "Manifest title wins" }]);
  r.workers = {
    t85: { usage: { input_tokens: 116, cache_creation_input_tokens: 77966, cache_read_input_tokens: 3287964, output_tokens: 32079 }, turns: 90, denials: 1,
      label: { ticket: "mrbam88/bamware-ai#85", title: "Shared signup" } },
    t9: { usage: null, turns: null, denials: 0, label: { ticket: "#999", title: "Prompt title loses" } },
  };
  const { recent } = deriveNow([r], NOW);
  const t85 = recent.find((t) => t.task === "t85");
  assert.deepEqual([t85.ticket, t85.title, t85.denials], ["mrbam88/bamware-ai#85", "Shared signup", 1]);
  assert.deepEqual(t85.tokens, { input: 116, cacheWrite: 77966, cacheRead: 3287964, output: 32079, total: 3398125, turns: 90 });
  const t9 = recent.find((t) => t.task === "t9");
  assert.deepEqual([t9.ticket, t9.title, t9.tokens, t9.denials], ["#9", "Manifest title wins", null, 0]);
});

test("reading state picks up each task's result and prompt from the batch work directory", async () => {
  const files = {
    "/s/overnight/7/status.json": JSON.stringify({ phase: "finished", tasks: [{ id: "t1", state: "verified", started_at: 1, finished_at: 2 }] }),
    "/s/overnight/7/batch.json": JSON.stringify({ tasks: [{ id: "t1", argv: ["python3", "run.py", "t1", "--work-dir", "/w"] },
      { id: "../x", argv: ["--work-dir", "/w"] }, { id: "t2", argv: ["--work-dir", "relative/dir"] }] }),
    "/w/t1.result.json": JSON.stringify({ usage: { input_tokens: 5, output_tokens: 7 }, num_turns: 3, permission_denials: [{}, {}] }),
    "/w/t1.prompt": 'Ticket: o/r#4 "Fix it"',
  };
  const readFile = async (f) => {
    if (!(f in files)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return files[f];
  };
  const readdir = async (d) => (d === "/s/overnight" ? ["7"] : []);
  const state = await readAgentsState("/s", { readFile, readdir });
  assert.deepEqual(state.runs[0].workers, { t1: { usage: { input_tokens: 5, output_tokens: 7 }, turns: 3, denials: 2, label: { ticket: "o/r#4", title: "Fix it" } } },
    "unsafe task ids and relative work dirs are skipped");
});


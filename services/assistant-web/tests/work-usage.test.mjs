import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORK_USAGE_CONTRACT_VERSION,
  ATTEMPT_KINDS,
  resolveMachineIdentity,
  deriveTicketFromBranch,
  normalizeUsageEvent,
  wrapSyntheticEventsAdapter,
  dedupeEvents,
  aggregateUsageByScope,
  aggregateTiming,
  aggregateOutcomes,
  deriveActiveAgents,
  evaluateRoutingRules,
  buildWorkUsageSnapshot,
} from "../lib/work-usage.mjs";
import { demoTaskEvents, workUsageDemoAdapter, demoRoutingRules } from "../lib/providers/work-usage-demo-fixtures.mjs";
import { workUsageSelfAdapter, WORK_USAGE_SELF_COVERAGE_NOTE } from "../lib/providers/work-usage-self-adapter.mjs";

const NOW = Date.parse("2026-10-02T12:00:00Z");

// --------------------------------------------------------- machine id ---
test("resolveMachineIdentity: configured id always wins", () => {
  const m = resolveMachineIdentity({ env: { BAMWARE_MACHINE_ID: "thinkpad-x1" }, hostnameOverride: "omarchy" });
  assert.deepEqual(m, { id: "thinkpad-x1", hostname: "omarchy", source: "configured", notes: null });
});

test("resolveMachineIdentity: the shared 'omarchy' hostname is reported ambiguous, never guessed", () => {
  const m = resolveMachineIdentity({ env: {}, hostnameOverride: "omarchy" });
  assert.equal(m.id, null);
  assert.equal(m.source, "hostname-ambiguous");
  assert.match(m.notes, /shared by/);
});

test("resolveMachineIdentity: an unambiguous hostname is used directly", () => {
  const m = resolveMachineIdentity({ env: {}, hostnameOverride: "thinkpad" });
  assert.deepEqual(m, { id: "thinkpad", hostname: "thinkpad", source: "hostname", notes: null });
});

test("resolveMachineIdentity: no hostname at all is honestly unknown", () => {
  const m = resolveMachineIdentity({ env: {}, hostnameOverride: null });
  assert.equal(m.id, null);
  assert.equal(m.source, "unknown");
});

// ------------------------------------------------------------- tickets ---
test("deriveTicketFromBranch mirrors the existing collector's parsing", () => {
  assert.equal(deriveTicketFromBranch("bamware-ai", "feat/12-foo"), "ai#12");
  assert.equal(deriveTicketFromBranch("bamware-web", "fix/bd-97-bar"), "web#97");
  assert.equal(deriveTicketFromBranch(null, "issue-41"), "#41");
  assert.equal(deriveTicketFromBranch("bamware-ai", "main"), null);
  assert.equal(deriveTicketFromBranch("bamware-ai", ""), null);
});

// -------------------------------------------------------- normalization ---
test("normalizeUsageEvent: missing project or task marks the event unallocated, never defaulted to a fake scope", () => {
  const noProject = normalizeUsageEvent({ task: { id: "1" } });
  assert.equal(noProject.unallocated, true);
  const noTask = normalizeUsageEvent({ project: "bamware-ai" });
  assert.equal(noTask.unallocated, true);
  const both = normalizeUsageEvent({ project: "bamware-ai", task: { id: "1" } });
  assert.equal(both.unallocated, false);
});

test("normalizeUsageEvent: usage fields are null (unknown), never coerced to 0", () => {
  const e = normalizeUsageEvent({ project: "p", task: { id: "1" }, usage: { input: 5 } });
  assert.equal(e.usage.input, 5);
  assert.equal(e.usage.output, null);
  assert.equal(e.usage.cacheRead, null);
});

test("normalizeUsageEvent: unrecognized enum values clamp to a declared default, never pass through silently", () => {
  const e = normalizeUsageEvent({ attempt: { kind: "bogus" }, outcome: { state: "bogus" }, classification: { difficulty: "bogus", risk: "bogus" }, cost: { kind: "bogus" } });
  assert.equal(e.attempt.kind, "unknown");
  assert.equal(e.outcome.state, "unknown");
  assert.equal(e.classification.difficulty, "unknown");
  assert.equal(e.classification.risk, "unknown");
  assert.equal(e.cost.kind, "unknown");
  assert.ok(ATTEMPT_KINDS.includes(e.attempt.kind));
});

test("normalizeUsageEvent: cost amount is dropped unless a real cost kind is declared", () => {
  const e = normalizeUsageEvent({ cost: { kind: "unknown", amountUsd: 5 } });
  assert.equal(e.cost.amountUsd, null, "an 'unknown' cost kind must never carry a number");
  const billed = normalizeUsageEvent({ cost: { kind: "billed", amountUsd: 5 } });
  assert.equal(billed.cost.amountUsd, 5);
});

test("wrapSyntheticEventsAdapter forces source.kind=synthetic even if the adapter claims live", async () => {
  const lying = wrapSyntheticEventsAdapter(async () => [{ source: { kind: "live" } }]);
  const [e] = await lying();
  assert.equal(e.source.kind, "synthetic");
});

// ------------------------------------------------------------- dedupe ---
test("dedupeEvents collapses a rewritten-transcript duplicate, keeping the latest reading only", () => {
  const a = normalizeUsageEvent({ id: "x", usage: { input: 10 }, source: { fetchedAt: "2026-10-02T10:00:00Z" } });
  const b = normalizeUsageEvent({ id: "x", usage: { input: 15 }, source: { fetchedAt: "2026-10-02T10:00:01Z" } });
  const { events, duplicatesDropped } = dedupeEvents([a, b]);
  assert.equal(events.length, 1);
  assert.equal(duplicatesDropped, 1);
  assert.equal(events[0].usage.input, 15, "the later reading wins; usage must not be summed across duplicates");
});

test("dedupeEvents never merges events lacking any stable id", () => {
  const a = normalizeUsageEvent({});
  const b = normalizeUsageEvent({});
  const { events, noStableKey } = dedupeEvents([a, b]);
  assert.equal(events.length, 2);
  assert.equal(noStableKey, 2);
});

// --------------------------------------------------------- aggregation ---
test("aggregateUsageByScope: sums per project/task and keeps an explicit unallocated bucket", () => {
  const events = [
    normalizeUsageEvent({ project: "p", task: { id: "1" }, attempt: { kind: "implementation" }, usage: { input: 10, output: 5 } }),
    normalizeUsageEvent({ project: "p", task: { id: "1" }, attempt: { kind: "retry" }, usage: { input: 20, output: null } }),
    normalizeUsageEvent({ usage: { input: 1 } }), // no project/task
  ];
  const { scopes, unallocated } = aggregateUsageByScope(events);
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].usage.input, 30);
  assert.equal(scopes[0].usage.output, 5, "output sums only the known reading");
  assert.equal(scopes[0].partial.output, true, "one contributing event had an unknown output, so the sum is a floor");
  assert.equal(scopes[0].retryCount, 1);
  assert.ok(unallocated);
  assert.equal(unallocated.usage.input, 1);
});

test("aggregateUsageByScope: a scope with no known reading for a field stays null, not 0", () => {
  const events = [normalizeUsageEvent({ project: "p", task: { id: "1" }, usage: {} })];
  const { scopes } = aggregateUsageByScope(events);
  assert.equal(scopes[0].usage.input, null);
});

test("aggregateTiming separates active from wait time and tallies wait reasons", () => {
  const events = [
    normalizeUsageEvent({ timing: { activeMs: 1000, waitMs: 500, waitReason: "qa" } }),
    normalizeUsageEvent({ timing: { activeMs: 2000, waitMs: 300, waitReason: "rate-limit" } }),
    normalizeUsageEvent({}), // no timing at all
  ];
  const t = aggregateTiming(events);
  assert.equal(t.activeMsTotal, 3000);
  assert.equal(t.waitMsTotal, 800);
  assert.deepEqual(t.waitByReason, { qa: 500, "rate-limit": 300 });
  assert.equal(t.unknownTimingCount, 1);
});

test("aggregateOutcomes counts states and retries with an honest sample size", () => {
  const events = [
    normalizeUsageEvent({ attempt: { id: "a1", kind: "implementation" }, outcome: { state: "qa-fail" } }),
    normalizeUsageEvent({ attempt: { id: "a2", kind: "retry" }, outcome: { state: "verified-pass" } }),
  ];
  const o = aggregateOutcomes(events);
  assert.equal(o.counts["qa-fail"], 1);
  assert.equal(o.counts["verified-pass"], 1);
  assert.equal(o.retryCount, 1);
  assert.equal(o.sampleSize, 2);
});

// -------------------------------------------------------------- agents ---
test("deriveActiveAgents: a recent heartbeat is active, an old one is stale, never the reverse", () => {
  const events = [
    normalizeUsageEvent({ agent: { sessionId: "s1" }, timing: { endedAt: new Date(NOW - 60_000).toISOString() } }),
    normalizeUsageEvent({ agent: { sessionId: "s2" }, timing: { endedAt: new Date(NOW - 2 * 60 * 60_000).toISOString() } }),
    normalizeUsageEvent({ agent: { sessionId: "s3" } }), // no timestamp at all
  ];
  const agents = deriveActiveAgents(events, { now: NOW, staleAfterMs: 15 * 60_000 });
  const byId = Object.fromEntries(agents.map((a) => [a.sessionId, a.state]));
  assert.equal(byId.s1, "active");
  assert.equal(byId.s2, "stale");
  assert.equal(byId.s3, "unknown");
});

// ------------------------------------------------------------ routing ---
test("evaluateRoutingRules reports insufficient evidence rather than a recommendation from thin data", () => {
  const events = [normalizeUsageEvent({ classification: { capabilities: ["x"], difficulty: "small", risk: "low" }, outcome: { state: "verified-pass" } })];
  const [r] = evaluateRoutingRules([{ id: "r1", matchCapabilities: ["x"], maxDifficulty: "medium", maxRisk: "medium", recommendedModel: "m" }], events, { minSamples: 3 });
  assert.equal(r.sampleSize, 1);
  assert.equal(r.evidence, "insufficient");
  assert.match(r.note, /need at least 3/);
});

test("evaluateRoutingRules only counts verified/QA-failed attempts as evidence, not unverified noise", () => {
  const events = [
    normalizeUsageEvent({ classification: { capabilities: [], difficulty: "small", risk: "low" }, outcome: { state: "unverified" } }),
    normalizeUsageEvent({ classification: { capabilities: [], difficulty: "small", risk: "low" }, outcome: { state: "verified-pass" } }),
  ];
  const [r] = evaluateRoutingRules([{ id: "r1", recommendedModel: "m" }], events, { minSamples: 1 });
  assert.equal(r.sampleSize, 1);
  assert.equal(r.successRate, 1);
});

// ------------------------------------------------------------ snapshot ---
test("buildWorkUsageSnapshot: a throwing adapter is recorded as a failed note, not a crash", async () => {
  const boom = { name: "boom", run: async () => { throw new Error("nope"); } };
  const snapshot = await buildWorkUsageSnapshot([boom], {}, { now: NOW });
  assert.equal(snapshot.version, WORK_USAGE_CONTRACT_VERSION);
  assert.deepEqual(snapshot.adapterNotes, [{ name: "boom", ok: false, error: "nope" }]);
  assert.equal(snapshot.usageByProjectTask.length, 0);
});

// ------------------------------------------------------ demo fixtures ---
test("demo fixtures cover implementation+retry+qa, dedup, unallocated, active and stale agents", async () => {
  const snapshot = await buildWorkUsageSnapshot([{ name: "demo", run: workUsageDemoAdapter }], { now: NOW }, { now: NOW, mode: "demo", routingRules: demoRoutingRules });
  assert.equal(snapshot.mode, "demo");
  assert.equal(snapshot.duplicatesDropped, 1);
  const task76 = snapshot.usageByProjectTask.find((s) => s.task.id === "76");
  assert.equal(task76.attempts.length, 3);
  assert.equal(task76.retryCount, 1);
  assert.equal(task76.qaAttemptCount, 1);
  for (const a of task76.attempts) assert.equal(a.source.kind, "synthetic");
  assert.ok(snapshot.unallocatedUsage);
  const states = new Set(snapshot.activeAgents.map((a) => a.state));
  assert.ok(states.has("active"));
  assert.ok(states.has("stale"));
});

// ------------------------------------------------------------- self adapter ---
test("self adapter reports repo/branch/machine identity but no usage numbers", async () => {
  const [raw] = await workUsageSelfAdapter({ repoDir: process.cwd(), repoName: "bamware-ai" });
  assert.equal(raw.repo, "bamware-ai");
  assert.equal(raw.usage.input, null);
  assert.equal(raw.usage.output, null);
  assert.equal(raw.outcome.notes, WORK_USAGE_SELF_COVERAGE_NOTE);
  assert.equal(raw.source.kind, "live");
});

test("self adapter degrades to null branch/commit instead of throwing when git is unavailable", async () => {
  const [raw] = await workUsageSelfAdapter({ repoDir: "/nonexistent-dir-for-test", repoName: "bamware-ai" });
  assert.equal(raw.trace.commit, null);
  assert.equal(raw.ticket, null);
});

test("every synthetic fixture event normalizes without throwing", () => {
  for (const raw of demoTaskEvents(NOW)) {
    const e = normalizeUsageEvent(raw);
    assert.ok(e.id);
  }
});

// Synthetic events for the work-usage / Agents-dashboard widgets
// (bamware-ai#76). Every fixture is force-tagged `source.kind: "synthetic"`
// by wrapSyntheticEventsAdapter and uses obviously-fictional ids, so it can
// never be mistaken for real usage even if a caller forgets to check mode.
//
// Covers, in one coherent task: an implementation attempt that fails QA, a
// retry that passes, and a QA attempt — on two machines that legitimately
// share the hostname "omarchy" (bamware-ai#76, docs/machines.md), two
// models, a duplicate line (simulating a rewritten transcript, to exercise
// dedup), an unallocated event with no project/task, and difficulty/risk/
// capability/selection-reason metadata for the routing recommendation view.
import { wrapSyntheticEventsAdapter } from "../work-usage.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;

const THINKPAD = { id: "thinkpad-x1", hostname: "omarchy", source: "configured", notes: null };
const INTEL_SERVER = { id: "omarchy-server", hostname: "omarchy", source: "configured", notes: null };

/** The full fixture set for one demo task: implementation -> retry -> QA. */
export function demoTaskEvents(now = Date.now()) {
  const implStart = now - 3 * HOUR;
  const implEnd = implStart + 25 * MIN;
  const retryStart = implEnd + 10 * MIN; // 10 min QA wait before the retry picked up
  const retryEnd = retryStart + 18 * MIN;
  const qaStart = retryEnd + 2 * MIN;
  const qaEnd = qaStart + 6 * MIN;

  const classification = {
    difficulty: "medium",
    risk: "medium",
    capabilities: ["node-backend", "test-writing"],
    selectionReason: "Demo: backend task with existing test coverage patterns to extend; mid-tier model judged sufficient.",
  };

  const implementation = {
    id: "demo-task-76:attempt-1",
    project: "bamware-ai",
    repo: "bamware-ai",
    ticket: "ai#76",
    batch: "overnight-20261002",
    task: { id: "76", title: "Agents dashboard" },
    attempt: { id: "attempt-1", kind: "implementation", number: 1, retryOfAttemptId: null },
    agent: { provider: "claude-code", model: "claude-sonnet-5", sessionId: "demo-session-1", machine: THINKPAD },
    trace: { commit: "demoabc1", pr: null, langfuseSessionId: "demo-session-1" },
    usage: { input: 42_000, output: 18_500, cacheWrite5m: 5_000, cacheWrite1h: 0, cacheRead: 120_000 },
    timing: { activeMs: implEnd - implStart, waitMs: 0, waitReason: "none", startedAt: new Date(implStart).toISOString(), endedAt: new Date(implEnd).toISOString() },
    outcome: { state: "qa-fail", verified: false, notes: "Demo: QA found a missing edge-case test." },
    classification,
    cost: { kind: "subscription-flat", amountUsd: null, pricingSource: null, pricingVersion: null },
    source: { label: "Synthetic fixture: implementation attempt", fetchedAt: new Date(implEnd).toISOString() },
  };

  // Simulates a rewritten transcript line for the same attempt: same id,
  // later fetchedAt, slightly different usage. dedupeEvents must keep only
  // this one (idempotent overwrite), not add the two together.
  const implementationRewritten = {
    ...implementation,
    usage: { ...implementation.usage, output: 19_000 },
    source: { label: "Synthetic fixture: implementation attempt (rewritten transcript line)", fetchedAt: new Date(implEnd + 1000).toISOString() },
  };

  const retry = {
    id: "demo-task-76:attempt-2",
    project: "bamware-ai",
    repo: "bamware-ai",
    ticket: "ai#76",
    batch: "overnight-20261002",
    task: { id: "76", title: "Agents dashboard" },
    attempt: { id: "attempt-2", kind: "retry", number: 2, retryOfAttemptId: "attempt-1" },
    agent: { provider: "claude-code", model: "claude-sonnet-5", sessionId: "demo-session-2", machine: INTEL_SERVER },
    trace: { commit: "demodef2", pr: 80, langfuseSessionId: "demo-session-2" },
    usage: { input: 31_000, output: 14_200, cacheWrite5m: 2_000, cacheWrite1h: 0, cacheRead: 140_000 },
    timing: {
      activeMs: retryEnd - retryStart,
      waitMs: retryStart - implEnd,
      waitReason: "qa",
      startedAt: new Date(retryStart).toISOString(),
      endedAt: new Date(retryEnd).toISOString(),
    },
    outcome: { state: "verified-pass", verified: true, notes: "Demo: added the missing edge-case test; QA re-run passed." },
    classification,
    cost: { kind: "subscription-flat", amountUsd: null, pricingSource: null, pricingVersion: null },
    source: { label: "Synthetic fixture: retry attempt", fetchedAt: new Date(retryEnd).toISOString() },
  };

  const qa = {
    id: "demo-task-76:attempt-3",
    project: "bamware-ai",
    repo: "bamware-ai",
    ticket: "ai#76",
    batch: "overnight-20261002",
    task: { id: "76", title: "Agents dashboard" },
    attempt: { id: "attempt-3", kind: "qa", number: 3, retryOfAttemptId: null },
    agent: { provider: "claude-code", model: "claude-opus-5", sessionId: "demo-session-3", machine: INTEL_SERVER },
    trace: { commit: "demodef2", pr: 80, langfuseSessionId: "demo-session-3" },
    usage: { input: 9_000, output: 2_100, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 30_000 },
    timing: {
      activeMs: qaEnd - qaStart,
      waitMs: qaStart - retryEnd,
      waitReason: "queue",
      startedAt: new Date(qaStart).toISOString(),
      endedAt: new Date(qaEnd).toISOString(),
    },
    outcome: { state: "verified-pass", verified: true, notes: "Demo: QA reviewer confirmed the fix." },
    classification: { ...classification, selectionReason: "Demo: QA review uses the stronger model regardless of implementation tier." },
    cost: { kind: "estimated", amountUsd: 0.14, pricingSource: "demo-price-table", pricingVersion: "2026-10" },
    source: { label: "Synthetic fixture: QA attempt", fetchedAt: new Date(qaEnd).toISOString() },
  };

  // No project/task at all: must land in the explicit "unallocated" bucket,
  // never silently dropped or merged into task #76's totals.
  const unallocated = {
    id: "demo-unallocated-1",
    project: null,
    repo: "bamware-ai",
    ticket: null,
    batch: "overnight-20261002",
    task: null,
    attempt: { id: "attempt-unalloc-1", kind: "unknown", number: null, retryOfAttemptId: null },
    agent: { provider: "claude-code", model: "claude-haiku-4-5", sessionId: "demo-session-4", machine: THINKPAD },
    trace: { commit: null, pr: null, langfuseSessionId: "demo-session-4" },
    usage: { input: 5_000, output: 900, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 2_000 },
    timing: { activeMs: 4 * MIN, waitMs: 0, waitReason: "none", startedAt: new Date(now - 10 * MIN).toISOString(), endedAt: new Date(now - 6 * MIN).toISOString() },
    outcome: { state: "unknown", verified: false, notes: "Demo: ad-hoc session with no branch ticket to attribute to." },
    classification: { difficulty: "unknown", risk: "unknown", capabilities: [], selectionReason: null },
    cost: { kind: "subscription-flat", amountUsd: null, pricingSource: null, pricingVersion: null },
    source: { label: "Synthetic fixture: unallocated usage", fetchedAt: new Date(now - 6 * MIN).toISOString() },
  };

  // A currently-active agent (recent heartbeat) on a third session, so the
  // active-agents widget has something fresh to show alongside the finished task.
  const activeNow = {
    id: "demo-active-1",
    project: "bamware-ai",
    repo: "bamware-ai",
    ticket: "ai#78",
    batch: "overnight-20261002",
    task: { id: "78", title: "Decisions card MVP" },
    attempt: { id: "attempt-78-1", kind: "implementation", number: 1, retryOfAttemptId: null },
    agent: { provider: "claude-code", model: "claude-sonnet-5", sessionId: "demo-session-5", machine: INTEL_SERVER },
    trace: { commit: null, pr: null, langfuseSessionId: "demo-session-5" },
    usage: { input: 11_000, output: 3_000, cacheWrite5m: 1_000, cacheWrite1h: 0, cacheRead: 9_000 },
    timing: { activeMs: 2 * MIN, waitMs: 0, waitReason: "none", startedAt: new Date(now - 2 * MIN).toISOString(), endedAt: null },
    execution: { version: 1, source: "worker-lifecycle", status: "working", phase: "coding", observedAt: new Date(now-30_000).toISOString(), leaseExpiresAt: new Date(now+60_000).toISOString(), pickupReceiptId: "synthetic-pickup-active" },
    outcome: { state: "unverified", verified: false, notes: null },
    classification: { difficulty: "small", risk: "low", capabilities: ["node-backend"], selectionReason: "Demo: small additive slice." },
    cost: { kind: "subscription-flat", amountUsd: null, pricingSource: null, pricingVersion: null },
    source: { label: "Synthetic fixture: in-progress session", fetchedAt: new Date(now - 30_000).toISOString() },
  };

  // Same session id as an old reading far in the past: proves a stale
  // heartbeat is reported "stale", never "active".
  const staleAgent = {
    id: "demo-stale-1",
    project: "bamware-ai",
    repo: "bamware-ai",
    ticket: "ai#77",
    batch: null,
    task: { id: "77", title: "Backlog planning" },
    attempt: { id: "attempt-77-1", kind: "implementation", number: 1, retryOfAttemptId: null },
    agent: { provider: "codex", model: "gpt-6-astra", sessionId: "demo-session-6", machine: { id: "thinkpad-x1", hostname: "omarchy", source: "configured", notes: null } },
    trace: { commit: null, pr: null, langfuseSessionId: null },
    usage: { input: 2_000, output: 500, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
    timing: { activeMs: 5 * MIN, waitMs: 0, waitReason: "none", startedAt: new Date(now - 5 * HOUR).toISOString(), endedAt: new Date(now - 5 * HOUR + 5 * MIN).toISOString() },
    outcome: { state: "unverified", verified: false, notes: "Demo: session abandoned hours ago." },
    execution: { version: 1, source: "worker-lifecycle", status: "working", phase: "researching", observedAt: new Date(now-5*HOUR).toISOString(), leaseExpiresAt: new Date(now-5*HOUR+60_000).toISOString(), pickupReceiptId: "synthetic-pickup-stale" },
    classification: { difficulty: "unknown", risk: "unknown", capabilities: [], selectionReason: null },
    cost: { kind: "unknown", amountUsd: null, pricingSource: null, pricingVersion: null },
    source: { label: "Synthetic fixture: stale session", fetchedAt: new Date(now - 5 * HOUR + 5 * MIN).toISOString() },
  };

  return [implementation, implementationRewritten, retry, qa, unallocated, activeNow, staleAgent];
}

/** Adapter used by `GET /api/work-usage?mode=demo`. */
export const workUsageDemoAdapter = wrapSyntheticEventsAdapter(async (ctx) => demoTaskEvents(ctx?.now ?? Date.now()));

/** Demo routing rules exercised by the routing-recommendation view in demo mode. */
export const demoRoutingRules = [
  {
    id: "backend-medium-sonnet",
    matchCapabilities: ["node-backend"],
    maxDifficulty: "medium",
    maxRisk: "medium",
    recommendedModel: "claude-sonnet-5",
    reason: "Demo rule: observed backend tasks at medium difficulty/risk.",
  },
  {
    id: "ios-xcode-opus",
    matchCapabilities: ["ios-xcode"],
    maxDifficulty: "large",
    maxRisk: "high",
    recommendedModel: "claude-opus-5",
    reason: "Demo rule: no iOS/Xcode attempts recorded yet, so this stays insufficient-evidence.",
  },
];

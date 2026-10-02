// Work-usage / agent-analytics data contract for the Agents view
// (bamware-ai#76, builds on #75's rate-limits.mjs).
//
// Same discipline as rate-limits.mjs: adapters report raw, honest facts
// (identifiers, token counts, timings, outcomes); this module normalizes,
// deduplicates and aggregates them so a sloppy or lying adapter cannot
// silently double-count usage, invent an "active" agent from a stale signal,
// or claim a model is cheaper/better without enough evidence. Missing data
// stays `null` (unknown) and is never folded into a sum as if it were zero.
//
// No network or filesystem I/O lives here; see lib/providers/*.mjs.

import os from "node:os";

export const WORK_USAGE_CONTRACT_VERSION = "1";

/** @type {readonly string[]} */
export const ATTEMPT_KINDS = Object.freeze(["implementation", "retry", "qa", "unknown"]);
/** @type {readonly string[]} */
export const OUTCOME_STATES = Object.freeze(["verified-pass", "qa-fail", "retry-pending", "unverified", "unknown"]);
/** @type {readonly string[]} */
export const WAIT_REASONS = Object.freeze(["rate-limit", "permission", "dependency", "qa", "queue", "none"]);
/** @type {readonly string[]} */
export const DIFFICULTY_LEVELS = Object.freeze(["trivial", "small", "medium", "large", "unknown"]);
/** @type {readonly string[]} */
export const RISK_LEVELS = Object.freeze(["low", "medium", "high", "unknown"]);
/** @type {readonly string[]} */
export const COST_KINDS = Object.freeze(["billed", "estimated", "subscription-flat", "unknown"]);
/** @type {readonly string[]} */
export const MACHINE_ID_SOURCES = Object.freeze(["configured", "hostname-ambiguous", "hostname", "unknown"]);
/** @type {readonly string[]} */
export const SOURCE_KINDS = Object.freeze(["live", "synthetic"]);
/** @type {readonly string[]} */
export const HEARTBEAT_STATES = Object.freeze(["active", "stale", "unknown"]);

const USAGE_FIELDS = Object.freeze(["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"]);
const DEFAULT_STALE_AFTER_MS = 15 * 60_000;
const DIFFICULTY_ORDER = ["trivial", "small", "medium", "large"];
const RISK_ORDER = ["low", "medium", "high"];

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function numOrNull(n) {
  return isFiniteNumber(n) ? n : null;
}
function enumOr(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function parseMs(iso) {
  if (typeof iso !== "string" || !iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

// ----------------------------------------------------------- machine id ---
/**
 * Resolves a safe machine identity. Hostnames alone are not trustworthy:
 * the ThinkPad X1 and the Intel server both report hostname "omarchy"
 * (docs/machines.md). An explicit `BAMWARE_MACHINE_ID` env var (or config
 * value passed as `hostnameOverride`'s sibling) always wins; otherwise a
 * known-ambiguous hostname is reported as ambiguous rather than guessed.
 * @param {{env?: object, hostnameOverride?: string|null}} [opts]
 */
export function resolveMachineIdentity({ env = process.env, hostnameOverride } = {}) {
  const configured = typeof env.BAMWARE_MACHINE_ID === "string" && env.BAMWARE_MACHINE_ID.trim() ? env.BAMWARE_MACHINE_ID.trim() : null;
  let hostname = hostnameOverride;
  if (hostname === undefined) {
    try {
      hostname = os.hostname() || null;
    } catch {
      hostname = null;
    }
  }
  if (configured) return { id: configured, hostname, source: "configured", notes: null };
  if (hostname === "omarchy") {
    return {
      id: null,
      hostname,
      source: "hostname-ambiguous",
      notes:
        'Hostname "omarchy" is shared by the ThinkPad X1 Carbon and the Intel MacBook Pro server (docs/machines.md). ' +
        "Set BAMWARE_MACHINE_ID to disambiguate; identity left unknown rather than guessed.",
    };
  }
  if (hostname) return { id: hostname, hostname, source: "hostname", notes: null };
  return { id: null, hostname: null, source: "unknown", notes: "Hostname unavailable." };
}

function normalizeMachine(raw) {
  if (!raw || typeof raw !== "object") return { id: null, hostname: null, source: "unknown", notes: null };
  return {
    id: raw.id ?? null,
    hostname: raw.hostname ?? null,
    source: enumOr(raw.source, MACHINE_ID_SOURCES, "unknown"),
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

// --------------------------------------------------------- ticket parse ---
// Mirrors bamware-ai scripts/ai-usage-collect.py's `ticket_of`: a branch like
// feat/12-x -> web#12 style ticket, "" (here: null) when the branch names none.
const TICKET_RE = /(?:^|\/)(?:[a-z]+[-#])?(?!20\d\d-)(\d{1,5})(?=[-_/]|$)/i;

/** Derives a ticket label from a repo name and branch, or null if the branch names none. */
export function deriveTicketFromBranch(repo, branch) {
  if (!branch || branch === "main" || branch === "master" || branch === "HEAD") return null;
  const m = TICKET_RE.exec(branch);
  if (!m) return null;
  const short = repo ? String(repo).replace(/^bamware-/, "") : "";
  return short ? `${short}#${m[1]}` : `#${m[1]}`;
}

// ------------------------------------------------------- normalization ---
/**
 * Raw usage event shape an adapter returns (one per attempt/model/session
 * bucket, analogous to bamware-web's `Rollup`):
 * {
 *   id,                      // stable id for dedup; derived best-effort if absent
 *   project, repo, ticket,   // identity; null/absent -> unallocated
 *   batch,                   // overnight batch id, or null
 *   task: { id, title },
 *   attempt: { id, kind, number, retryOfAttemptId },
 *   agent: { provider, model, sessionId, machine },
 *   trace: { commit, pr, langfuseSessionId },
 *   usage: { input, output, cacheWrite5m, cacheWrite1h, cacheRead },  // numbers or null (unknown, never 0)
 *   timing: { activeMs, waitMs, waitReason, startedAt, endedAt },
 *   outcome: { state, verified, notes },
 *   classification: { difficulty, risk, capabilities, selectionReason },
 *   cost: { kind, amountUsd, pricingSource, pricingVersion },
 *   source: { kind, label, fetchedAt },
 * }
 * @param {object} raw
 */
export function normalizeUsageEvent(raw = {}) {
  const project = typeof raw.project === "string" && raw.project ? raw.project : null;
  const task = raw.task && typeof raw.task === "object" && raw.task.id != null ? { id: String(raw.task.id), title: raw.task.title ?? null } : null;
  const unallocated = !project || !task;

  const usage = {};
  for (const f of USAGE_FIELDS) usage[f] = numOrNull(raw.usage?.[f]);

  const machine = normalizeMachine(raw.agent?.machine);
  const agent = {
    provider: raw.agent?.provider ?? null,
    model: raw.agent?.model ?? null,
    sessionId: raw.agent?.sessionId ?? null,
    machine,
  };

  const attempt = {
    id: raw.attempt?.id ?? null,
    kind: enumOr(raw.attempt?.kind, ATTEMPT_KINDS, "unknown"),
    number: isFiniteNumber(raw.attempt?.number) ? raw.attempt.number : null,
    retryOfAttemptId: raw.attempt?.retryOfAttemptId ?? null,
  };

  const timing = {
    activeMs: numOrNull(raw.timing?.activeMs),
    waitMs: numOrNull(raw.timing?.waitMs),
    waitReason: enumOr(raw.timing?.waitReason, WAIT_REASONS, raw.timing?.waitMs ? null : "none"),
    startedAt: raw.timing?.startedAt ?? null,
    endedAt: raw.timing?.endedAt ?? null,
  };

  const outcome = {
    state: enumOr(raw.outcome?.state, OUTCOME_STATES, "unknown"),
    verified: raw.outcome?.verified === true,
    notes: typeof raw.outcome?.notes === "string" ? raw.outcome.notes : null,
  };

  const classification = {
    difficulty: enumOr(raw.classification?.difficulty, DIFFICULTY_LEVELS, "unknown"),
    risk: enumOr(raw.classification?.risk, RISK_LEVELS, "unknown"),
    capabilities: Array.isArray(raw.classification?.capabilities) ? raw.classification.capabilities.filter((c) => typeof c === "string") : [],
    selectionReason: typeof raw.classification?.selectionReason === "string" ? raw.classification.selectionReason : null,
  };

  const costKind = enumOr(raw.cost?.kind, COST_KINDS, "unknown");
  const cost = {
    kind: costKind,
    amountUsd: costKind !== "unknown" ? numOrNull(raw.cost?.amountUsd) : null,
    pricingSource: typeof raw.cost?.pricingSource === "string" ? raw.cost.pricingSource : null,
    pricingVersion: typeof raw.cost?.pricingVersion === "string" ? raw.cost.pricingVersion : null,
  };

  const source = {
    kind: enumOr(raw.source?.kind, SOURCE_KINDS, "live"),
    label: raw.source?.label ?? null,
    fetchedAt: raw.source?.fetchedAt ?? null,
  };

  const trace = {
    commit: raw.trace?.commit ?? null,
    pr: raw.trace?.pr ?? null,
    langfuseSessionId: raw.trace?.langfuseSessionId ?? null,
  };

  let id = raw.id != null ? String(raw.id) : null;
  let idDerived = false;
  if (!id) {
    const parts = [project, task?.id, attempt.id, agent.sessionId, agent.model, timing.startedAt].filter((p) => p != null && p !== "");
    id = parts.length ? parts.join("|") : null;
    idDerived = true;
  }

  return {
    id,
    idDerived,
    unallocated,
    project,
    repo: raw.repo ?? null,
    ticket: raw.ticket ?? null,
    batch: raw.batch ?? null,
    task,
    attempt,
    agent,
    trace,
    usage,
    timing,
    outcome,
    classification,
    cost,
    source,
  };
}

/**
 * Forces every event's `source.kind` to "synthetic" regardless of what the
 * adapter set, mirroring rate-limits.mjs's wrapSyntheticAdapter: a fixture
 * bug can never make demo data present as live.
 * @param {() => Promise<object[]> | object[]} adapter
 */
export function wrapSyntheticEventsAdapter(adapter) {
  return async (ctx) => {
    const events = await adapter(ctx);
    return events.map((e) => ({ ...e, source: { ...(e.source ?? {}), kind: "synthetic" } }));
  };
}

// -------------------------------------------------------------- dedupe ---
/**
 * Collapses events sharing the same id/dedupe key, keeping the latest by
 * `source.fetchedAt` (ties: last in input order wins) — the same
 * idempotent-overwrite semantics as the existing collector (a changed
 * transcript recomputes and replaces its own rollup, never adds to it).
 * @param {object[]} events normalized events
 */
export function dedupeEvents(events) {
  const byKey = new Map();
  let duplicatesDropped = 0;
  let noStableKey = 0;
  for (const e of events) {
    if (!e.id) {
      noStableKey += 1;
      byKey.set(Symbol(), e); // never collides; can't be deduplicated honestly
      continue;
    }
    const prev = byKey.get(e.id);
    if (!prev) {
      byKey.set(e.id, e);
      continue;
    }
    duplicatesDropped += 1;
    const prevMs = parseMs(prev.source.fetchedAt);
    const curMs = parseMs(e.source.fetchedAt);
    if (curMs == null || (prevMs != null && curMs >= prevMs)) byKey.set(e.id, e);
  }
  return { events: [...byKey.values()], duplicatesDropped, noStableKey };
}

// ----------------------------------------------------------- usage agg ---
function scopeKeyOf(e) {
  return e.unallocated ? "unallocated" : `${e.project}::${e.task.id}`;
}

function emptyUsageTotals() {
  const usage = {};
  const partial = {};
  for (const f of USAGE_FIELDS) {
    usage[f] = null;
    partial[f] = false;
  }
  return { usage, partial };
}

function addUsage(totals, partial, usage) {
  for (const f of USAGE_FIELDS) {
    if (usage[f] == null) {
      partial[f] = true;
      continue;
    }
    totals[f] = (totals[f] ?? 0) + usage[f];
  }
}

/**
 * Sums token usage per project/task scope, keeping an explicit "unallocated"
 * bucket for events with no project or no task (the metadata the dashboard
 * must not silently drop). A scope total field stays `null` until at least
 * one contributing event reports a number for it (missing != zero); `partial`
 * flags a field where at least one contributing event's reading is unknown,
 * so the total is a floor, not a guaranteed exact figure.
 * @param {object[]} events normalized, deduplicated events
 */
export function aggregateUsageByScope(events) {
  const scopes = new Map();
  for (const e of events) {
    const key = scopeKeyOf(e);
    let scope = scopes.get(key);
    if (!scope) {
      const { usage, partial } = emptyUsageTotals();
      scope = {
        key,
        unallocated: e.unallocated,
        project: e.project,
        task: e.task,
        usage,
        partial,
        attempts: [],
        retryCount: 0,
        qaAttemptCount: 0,
      };
      scopes.set(key, scope);
    }
    addUsage(scope.usage, scope.partial, e.usage);
    scope.attempts.push({
      eventId: e.id,
      attemptId: e.attempt.id,
      kind: e.attempt.kind,
      model: e.agent.model,
      machine: e.agent.machine,
      outcome: e.outcome,
      usage: e.usage,
      timing: e.timing,
      trace: e.trace,
      classification: e.classification,
      cost: e.cost,
      source: e.source,
    });
    if (e.attempt.kind === "retry") scope.retryCount += 1;
    if (e.attempt.kind === "qa") scope.qaAttemptCount += 1;
  }
  const all = [...scopes.values()];
  const unallocated = all.find((s) => s.unallocated) ?? null;
  const allocated = all.filter((s) => !s.unallocated);
  return { scopes: allocated, unallocated };
}

// ----------------------------------------------------------- timing agg ---
/**
 * Separates active execution time from queueing/waiting time, broken down by
 * reason. Events with no timing at all are counted but never folded into
 * either total as zero.
 * @param {object[]} events
 */
export function aggregateTiming(events) {
  let activeMsTotal = null;
  let waitMsTotal = null;
  const waitByReason = {};
  let unknownTimingCount = 0;
  for (const e of events) {
    const { activeMs, waitMs, waitReason } = e.timing;
    if (activeMs == null && waitMs == null) unknownTimingCount += 1;
    if (activeMs != null) activeMsTotal = (activeMsTotal ?? 0) + activeMs;
    if (waitMs != null) {
      waitMsTotal = (waitMsTotal ?? 0) + waitMs;
      const reason = waitReason ?? "unknown-reason";
      waitByReason[reason] = (waitByReason[reason] ?? 0) + waitMs;
    }
  }
  return { activeMsTotal, waitMsTotal, waitByReason, unknownTimingCount, totalEvents: events.length };
}

// --------------------------------------------------------- outcomes agg ---
/**
 * Counts verified completions, QA failures and retries. Exposes `sampleSize`
 * so the UI can show coverage rather than imply statistical confidence from
 * a handful of events.
 * @param {object[]} events
 */
export function aggregateOutcomes(events) {
  const counts = Object.fromEntries(OUTCOME_STATES.map((s) => [s, 0]));
  let retryCount = 0;
  const attemptIds = new Set();
  for (const e of events) {
    counts[e.outcome.state] += 1;
    if (e.attempt.kind === "retry") retryCount += 1;
    if (e.attempt.id) attemptIds.add(e.attempt.id);
  }
  return {
    counts,
    retryCount,
    sampleSize: attemptIds.size || events.length,
    totalEvents: events.length,
  };
}

// ------------------------------------------------------------ agents --
/**
 * Derives "active agent" entries from the latest event per agent session
 * (or per provider+machine when no session id exists). A stale heartbeat is
 * reported as "stale", never presented as "active" — the dashboard must not
 * imply an agent is currently working from an old signal.
 * @param {object[]} events
 * @param {{now?: number, staleAfterMs?: number}} [opts]
 */
export function deriveActiveAgents(events, opts = {}) {
  const now = opts.now ?? Date.now();
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const byAgent = new Map();
  for (const e of events) {
    const key = e.agent.sessionId ?? `${e.agent.provider ?? "unknown-provider"}:${e.agent.machine.id ?? e.agent.machine.hostname ?? "unknown-machine"}`;
    const lastSeenMs = parseMs(e.timing.endedAt) ?? parseMs(e.source.fetchedAt);
    const prev = byAgent.get(key);
    if (!prev || (lastSeenMs ?? -Infinity) >= (prev.lastSeenMs ?? -Infinity)) {
      byAgent.set(key, { event: e, lastSeenMs });
    }
  }
  return [...byAgent.entries()].map(([key, { event: e, lastSeenMs }]) => {
    const heartbeatAgeMs = lastSeenMs != null ? Math.max(0, now - lastSeenMs) : null;
    const state = lastSeenMs == null ? "unknown" : heartbeatAgeMs <= staleAfterMs ? "active" : "stale";
    return {
      key,
      provider: e.agent.provider,
      model: e.agent.model,
      sessionId: e.agent.sessionId,
      machine: e.agent.machine,
      project: e.project,
      task: e.task,
      lastSeenAt: lastSeenMs != null ? new Date(lastSeenMs).toISOString() : null,
      heartbeatAgeSec: heartbeatAgeMs != null ? Math.round(heartbeatAgeMs / 1000) : null,
      state,
    };
  });
}

// ----------------------------------------------------------- routing --
/**
 * Evaluates a small set of capability-based routing rules against observed
 * outcomes. This is a recommendation *view*, not automatic switching: it
 * never picks a provider, only reports whether enough verified evidence
 * exists and what it shows so far.
 * @param {Array<{id:string, matchCapabilities?:string[], maxDifficulty?:string, maxRisk?:string, recommendedModel:string, reason?:string}>} rules
 * @param {object[]} events
 * @param {{minSamples?: number}} [opts]
 */
export function evaluateRoutingRules(rules, events, opts = {}) {
  const minSamples = opts.minSamples ?? 3;
  return rules.map((rule) => {
    const matchCaps = rule.matchCapabilities ?? [];
    const maxDifficultyIdx = rule.maxDifficulty ? DIFFICULTY_ORDER.indexOf(rule.maxDifficulty) : DIFFICULTY_ORDER.length - 1;
    const maxRiskIdx = rule.maxRisk ? RISK_ORDER.indexOf(rule.maxRisk) : RISK_ORDER.length - 1;
    const matching = events.filter((e) => {
      const c = e.classification;
      if (!matchCaps.every((cap) => c.capabilities.includes(cap))) return false;
      const dIdx = DIFFICULTY_ORDER.indexOf(c.difficulty);
      const rIdx = RISK_ORDER.indexOf(c.risk);
      if (dIdx === -1 || dIdx > maxDifficultyIdx) return false;
      if (rIdx === -1 || rIdx > maxRiskIdx) return false;
      return e.outcome.state === "verified-pass" || e.outcome.state === "qa-fail";
    });
    const sampleSize = matching.length;
    const successCount = matching.filter((e) => e.outcome.state === "verified-pass").length;
    const evidence = sampleSize >= minSamples ? "sufficient" : "insufficient";
    return {
      ruleId: rule.id,
      recommendedModel: rule.recommendedModel,
      reason: rule.reason ?? null,
      sampleSize,
      successCount,
      successRate: sampleSize > 0 ? Math.round((successCount / sampleSize) * 1000) / 1000 : null,
      evidence,
      note: evidence === "insufficient" ? `Only ${sampleSize} verified/QA-failed attempt(s) observed; need at least ${minSamples} before this is more than a guess.` : null,
    };
  });
}

// ------------------------------------------------------------ snapshot ---
/**
 * Runs adapters, normalizes + dedupes every event, and returns the full
 * versioned snapshot the Agents dashboard widgets read from. A throwing
 * adapter degrades to a recorded note rather than failing the snapshot.
 * @param {Array<{name: string, run: Function}>} adapters
 * @param {object} [ctx]
 * @param {{now?: number, mode?: string, staleAfterMs?: number, routingRules?: object[]}} [opts]
 */
export async function buildWorkUsageSnapshot(adapters, ctx = {}, opts = {}) {
  const now = opts.now ?? Date.now();
  const rawEvents = [];
  const adapterNotes = [];
  for (const { name, run } of adapters) {
    try {
      const events = await run(ctx);
      if (!Array.isArray(events)) throw new Error("adapter did not return an array");
      rawEvents.push(...events);
      adapterNotes.push({ name, ok: true, count: events.length });
    } catch (err) {
      adapterNotes.push({ name, ok: false, error: err.message });
    }
  }
  const normalized = rawEvents.map(normalizeUsageEvent);
  const { events, duplicatesDropped, noStableKey } = dedupeEvents(normalized);
  const usage = aggregateUsageByScope(events);
  const timing = aggregateTiming(events);
  const outcomes = aggregateOutcomes(events);
  const activeAgents = deriveActiveAgents(events, { now, staleAfterMs: opts.staleAfterMs });
  const routing = opts.routingRules ? evaluateRoutingRules(opts.routingRules, events) : [];

  return {
    version: WORK_USAGE_CONTRACT_VERSION,
    generatedAt: new Date(now).toISOString(),
    mode: opts.mode ?? "live",
    adapterNotes,
    duplicatesDropped,
    noStableKey,
    usageByProjectTask: usage.scopes,
    unallocatedUsage: usage.unallocated,
    timing,
    outcomes,
    activeAgents,
    routing,
  };
}
